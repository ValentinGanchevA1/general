import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, BadRequestException, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import type { ForgotPasswordResponse, ResetPasswordRequest, ResetPasswordResponse } from '@g88/shared';
import { PasswordResetMailer } from './password-reset-mailer';

const GENERIC_RESPONSE: ForgotPasswordResponse = {
  message: 'If this email has a password account, you will receive a reset code shortly. Check your spam folder too.',
  retryAfterSeconds: 60,
};
interface ChallengeRow { id: string; user_id: string; code_hash: string; attempts: number }
interface DeliveryRow { id: string; email: string; delivery_ciphertext: string; delivery_claim: string }

@Injectable()
export class PasswordResetService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PasswordResetService.name);
  private timer?: ReturnType<typeof setInterval>;
  private delivering = false;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly mailer: PasswordResetMailer,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => { void this.deliverPending(); }, 5_000);
    this.timer.unref();
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  /**
   * Durable abuse-control ledger. A Redis restart must not reset the 60-second
   * cooldown or five-per-hour request cap. Only an HMAC digest is persisted and
   * stale rows are opportunistically pruned after the active window is irrelevant.
   */
  private async consumeRequestAllowance(subjectHash: string): Promise<boolean> {
    const rows = await this.db.query<Array<{ allowed: boolean }>>(
      `WITH pruned AS (
         DELETE FROM password_reset_rate_limits
          WHERE updated_at < NOW() - INTERVAL '2 hours'
          RETURNING 1
       ), allowance AS (
         INSERT INTO password_reset_rate_limits
           (subject_hash, window_started_at, request_count, cooldown_until, updated_at)
         VALUES ($1, NOW(), 1, NOW() + INTERVAL '60 seconds', NOW())
         ON CONFLICT (subject_hash) DO UPDATE SET
           window_started_at = CASE
             WHEN password_reset_rate_limits.window_started_at <= NOW() - INTERVAL '1 hour'
               THEN NOW()
             ELSE password_reset_rate_limits.window_started_at
           END,
           request_count = CASE
             WHEN password_reset_rate_limits.window_started_at <= NOW() - INTERVAL '1 hour'
               THEN 1
             ELSE password_reset_rate_limits.request_count + 1
           END,
           cooldown_until = NOW() + INTERVAL '60 seconds',
           updated_at = NOW()
         WHERE password_reset_rate_limits.window_started_at <= NOW() - INTERVAL '1 hour'
            OR (
              password_reset_rate_limits.cooldown_until <= NOW()
              AND password_reset_rate_limits.request_count < 5
            )
         RETURNING 1
       )
       SELECT EXISTS(SELECT 1 FROM allowance) AS allowed`,
      [subjectHash],
    );
    return rows[0]?.allowed === true;
  }

  async request(email: string): Promise<ForgotPasswordResponse> {
    this.mailer.assertConfigured();
    const normalized = email.trim().toLowerCase();
    // HMAC keys hide email addresses in durable abuse-control state. Limits apply to unknown accounts too.
    const key = this.mailer.digest(`rate:${normalized}`);
    if (!(await this.consumeRequestAllowance(key))) return { ...GENERIC_RESPONSE };
    const id = randomUUID();
    const resetCode = String(randomInt(0, 100_000_000)).padStart(8, '0');
    // INSERT SELECT has the same public result for unknown, deleted and Google-only users.
    // A durable encrypted outbox removes provider latency from this response.
    await this.db.query(
      `INSERT INTO password_reset_requests (user_id, id, code_hash, expires_at, delivery_ciphertext)
       SELECT id, $2, $3, NOW() + INTERVAL '15 minutes', $4 FROM users
        WHERE email = $1 AND deleted_at IS NULL AND password_hash IS NOT NULL
       ON CONFLICT (user_id) DO UPDATE SET id = EXCLUDED.id, code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at, requested_at = NOW(), attempts = 0,
         delivery_ciphertext = EXCLUDED.delivery_ciphertext, delivery_attempts = 0,
         next_delivery_at = NOW(), delivery_claim = NULL, delivery_lease_until = NULL`,
      [normalized, id, this.mailer.digest(`code:${id}:${resetCode}`), this.mailer.encrypt(resetCode, id)],
    );
    return { ...GENERIC_RESPONSE };
  }

  async reset(input: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    this.mailer.assertConfigured();
    // Use the user lock before the challenge lock consistently with issuance/reset.
    const outcome = await this.db.transaction(async (tx): Promise<boolean> => {
      const users = await tx.query<Array<{ id: string }>>(
        `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL AND password_hash IS NOT NULL FOR UPDATE`,
        [input.email.trim().toLowerCase()],
      );
      if (!users[0]) return false;
      const rows = await tx.query<ChallengeRow[]>(
        `SELECT id, user_id, code_hash, attempts FROM password_reset_requests
          WHERE user_id = $1 AND expires_at > NOW() AND attempts < 5 FOR UPDATE`, [users[0].id],
      );
      const row = rows[0];
      if (!row) return false;
      const expected = Buffer.from(row.code_hash, 'hex');
      const provided = Buffer.from(this.mailer.digest(`code:${row.id}:${input.resetCode}`), 'hex');
      if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
        await tx.query('UPDATE password_reset_requests SET attempts = attempts + 1 WHERE id = $1', [row.id]);
        return false; // Commit the failed attempt; throwing here would roll it back.
      }
      const hash = await bcrypt.hash(input.newPassword, 12);
      await tx.query('UPDATE users SET password_hash = $2, auth_version = auth_version + 1, updated_at = NOW() WHERE id = $1', [row.user_id, hash]);
      await tx.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id]);
      await tx.query('DELETE FROM password_reset_requests WHERE id = $1', [row.id]);
      return true;
    });
    if (!outcome) throw new BadRequestException({ code: 'auth.invalid_reset_code', message: 'The code is invalid or expired. Request a new code and try again.' });
    return { message: 'Password updated. Sign in with your new password.' };
  }

  /** Multiple API instances safely share the outbox through a bounded claim lease. */
  async deliverPending(): Promise<void> {
    if (this.delivering) return;
    this.delivering = true;
    try {
      try { this.mailer.assertConfigured(); } catch { return; }
      await this.db.query('DELETE FROM password_reset_requests WHERE expires_at <= NOW()');
      for (let count = 0; count < 5; count += 1) {
        const claim = randomUUID();
        const rows = await this.db.query<DeliveryRow[]>(
          `WITH candidate AS (
             SELECT r.user_id FROM password_reset_requests r JOIN users u ON u.id = r.user_id
              WHERE r.delivery_ciphertext IS NOT NULL AND r.delivery_attempts < 3
                AND r.expires_at > NOW() AND r.next_delivery_at <= NOW()
                AND (r.delivery_lease_until IS NULL OR r.delivery_lease_until < NOW())
                AND u.deleted_at IS NULL
              ORDER BY r.next_delivery_at FOR UPDATE OF r SKIP LOCKED LIMIT 1
           ), claimed AS (
             UPDATE password_reset_requests r SET delivery_claim = $1,
               delivery_lease_until = NOW() + INTERVAL '60 seconds', delivery_attempts = delivery_attempts + 1
             FROM candidate c WHERE r.user_id = c.user_id
             RETURNING r.id, r.user_id, r.delivery_ciphertext, r.delivery_claim
           ) SELECT c.*, u.email FROM claimed c JOIN users u ON u.id = c.user_id`, [claim],
        );
        const row = rows[0];
        if (!row) break;
        try {
          await this.mailer.send(row.email, this.mailer.decrypt(row.delivery_ciphertext, row.id));
          await this.db.query('UPDATE password_reset_requests SET delivery_ciphertext = NULL, delivery_claim = NULL, delivery_lease_until = NULL WHERE id = $1 AND delivery_claim = $2', [row.id, row.delivery_claim]);
        } catch {
          this.logger.warn('Password reset email delivery failed; bounded retry scheduled');
          await this.db.query(`UPDATE password_reset_requests SET delivery_claim = NULL, delivery_lease_until = NULL,
            next_delivery_at = NOW() + INTERVAL '30 seconds',
            delivery_ciphertext = CASE WHEN delivery_attempts >= 3 THEN NULL ELSE delivery_ciphertext END
            WHERE id = $1 AND delivery_claim = $2`, [row.id, row.delivery_claim]);
        }
      }
    } catch {
      // No exception objects: provider responses/URLs can contain recipient or auth data.
      this.logger.warn('Password reset outbox processing failed; retrying on next poll');
    } finally { this.delivering = false; }
  }
}
