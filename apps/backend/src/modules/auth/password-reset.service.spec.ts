import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { PasswordResetMailer } from './password-reset-mailer';
import { PasswordResetService } from './password-reset.service';
import { ResetPasswordDto } from './dto';
import { validate } from 'class-validator';

const email = 'person@example.com';
const code = '12345678';
const id = 'a-reset-request';
const savedEnv = { ...process.env };
let mailer: PasswordResetMailer;
let service: PasswordResetService;
let db: { query: jest.Mock; transaction: jest.Mock };
let tx: { query: jest.Mock };

beforeEach(() => {
  process.env.PASSWORD_RESET_SECRET = 'test-recovery-secret-at-least-32-characters';
  process.env.SENDGRID_API_KEY = 'test-only';
  process.env.SENDGRID_FROM_EMAIL = 'nexa@example.com';
  mailer = new PasswordResetMailer();
  tx = { query: jest.fn() };
  db = {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('password_reset_rate_limits')) return Promise.resolve([{ allowed: true }]);
      return Promise.resolve([]);
    }),
    transaction: jest.fn(async (work: (manager: typeof tx) => Promise<unknown>) => work(tx)),
  };
  service = new PasswordResetService(db as unknown as DataSource, mailer);
});
afterEach(() => { process.env = { ...savedEnv }; jest.restoreAllMocks(); });

function challenge(attempts = 0): { id: string; user_id: string; code_hash: string; attempts: number } {
  return { id, user_id: 'u1', code_hash: mailer.digest(`code:${id}:${code}`), attempts };
}

it('returns the same public response for eligible and unknown accounts, without raw codes in storage', async () => {
  const known = await service.request(email);
  const unknown = await service.request('unknown@example.com');
  expect(known).toEqual(unknown);
  expect(known).not.toHaveProperty('resetCode');
  const insertCall = db.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO password_reset_requests')) as [string, string[]] | undefined;
  expect(insertCall).toBeDefined();
  const params = insertCall?.[1] ?? [];
  expect(params[2]).toMatch(/^[a-f0-9]{64}$/);
  const recovered = mailer.decrypt(params[3]!, params[1]!);
  expect(recovered).toMatch(/^\d{8}$/);
  expect(params).not.toContain(recovered);
  expect(params[2]).toBe(mailer.digest(`code:${params[1]}:${recovered}`));

  const limiterCalls = db.query.mock.calls.filter(([sql]) => String(sql).includes('password_reset_rate_limits'));
  expect(limiterCalls).toHaveLength(2);
  expect(limiterCalls[0]?.[1]).toEqual([mailer.digest(`rate:${email}`)]);
  expect(limiterCalls[0]?.[1]).not.toContain(email);
});

it('does not enqueue another email during the durable cooldown or hourly limit', async () => {
  db.query.mockResolvedValueOnce([{ allowed: false }]);
  expect(await service.request(email)).toHaveProperty('retryAfterSeconds', 60);
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(db.query.mock.calls[0]?.[0]).toContain('password_reset_rate_limits');
});

it('keeps the request limiter in shared Postgres state instead of restart-sensitive Redis state', async () => {
  await service.request(email);
  const limiterSql = String(db.query.mock.calls[0]?.[0]);
  expect(limiterSql).toContain('ON CONFLICT (subject_hash) DO UPDATE');
  expect(limiterSql).toContain("INTERVAL '1 hour'");
  expect(limiterSql).toContain('request_count < 5');
  expect(limiterSql).toContain("INTERVAL '60 seconds'");
  expect(limiterSql).toContain("updated_at < NOW() - INTERVAL '2 hours'");
});

it('fails closed for every account when recovery delivery is not configured', async () => {
  delete process.env.SENDGRID_API_KEY;
  await expect(service.request(email)).rejects.toMatchObject({ status: 503 });
  expect(db.query).not.toHaveBeenCalled();
});

it('commits wrong-code attempts and never changes the password or revokes sessions', async () => {
  tx.query.mockResolvedValueOnce([{ id: 'u1' }]).mockResolvedValueOnce([challenge()]).mockResolvedValueOnce([]);
  await expect(service.reset({ email, resetCode: '00000000', newPassword: 'new-password' })).rejects.toBeInstanceOf(BadRequestException);
  expect(tx.query).toHaveBeenLastCalledWith(expect.stringContaining('attempts = attempts + 1'), [id]);
  expect(tx.query).toHaveBeenCalledTimes(3);
  // Transaction callback resolves false; the exception is outside the transaction.
  await expect(db.transaction.mock.results[0]?.value).resolves.toBe(false);
});

it('rejects when no usable challenge exists without mutating credentials', async () => {
  tx.query.mockResolvedValueOnce([{ id: 'u1' }]).mockResolvedValueOnce([]);
  await expect(service.reset({ email, resetCode: code, newPassword: 'new-password' })).rejects.toMatchObject({ status: 400 });
  expect(tx.query.mock.calls[1]?.[0]).toContain('expires_at > NOW() AND attempts < 5');
  expect(tx.query).toHaveBeenCalledTimes(2);
});

it('atomically hashes the new password, rotates auth version, revokes refresh tokens and consumes the code', async () => {
  tx.query.mockResolvedValueOnce([{ id: 'u1' }]).mockResolvedValueOnce([challenge()]).mockResolvedValue([]);
  await expect(service.reset({ email, resetCode: code, newPassword: 'new-password' })).resolves.toHaveProperty('message');
  const update = tx.query.mock.calls[2] as [string, string[]];
  expect(update[0]).toContain('auth_version = auth_version + 1');
  expect(await bcrypt.compare('new-password', update[1][1]!)).toBe(true);
  expect(tx.query.mock.calls[3]?.[0]).toContain('UPDATE refresh_tokens');
  expect(tx.query.mock.calls[4]).toEqual(['DELETE FROM password_reset_requests WHERE id = $1', [id]]);
}, 15_000);

it('binds encrypted outbox payloads to their challenge, rejecting tampering', () => {
  const encrypted = mailer.encrypt(code, id);
  expect(mailer.decrypt(encrypted, id)).toBe(code);
  expect(() => mailer.decrypt(encrypted, 'different-request')).toThrow();
});

it('claims queued mail, sends the code and clears encrypted content after delivery', async () => {
  const send = jest.spyOn(mailer, 'send').mockResolvedValue(undefined);
  db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id, email, delivery_claim: 'claim', delivery_ciphertext: mailer.encrypt(code, id) }]).mockResolvedValue([]);
  await service.deliverPending();
  expect(send).toHaveBeenCalledWith(email, code);
  expect(db.query.mock.calls[1]?.[0]).toContain('FOR UPDATE OF r SKIP LOCKED');
  expect(db.query.mock.calls[2]).toEqual([expect.stringContaining('delivery_ciphertext = NULL'), [id, 'claim']]);
});

it('retries provider failures without consuming the reset challenge', async () => {
  jest.spyOn(mailer, 'send').mockRejectedValue(new Error('private provider details'));
  db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id, email, delivery_claim: 'claim', delivery_ciphertext: mailer.encrypt(code, id) }]).mockResolvedValue([]);
  await service.deliverPending();
  expect(db.query.mock.calls[2]?.[0]).toContain('delivery_attempts >= 3');
  expect(db.query.mock.calls[2]?.[0]).not.toContain('DELETE');
});

it('rejects malformed codes and bcrypt-truncated Unicode passwords through DTO validation', async () => {
  const dto = Object.assign(new ResetPasswordDto(), { email, resetCode: '123', newPassword: '😀'.repeat(20) });
  const errors = await validate(dto);
  expect(errors.map((e) => e.property)).toEqual(expect.arrayContaining(['resetCode', 'newPassword']));
});
