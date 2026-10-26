import { scrubSentryPayload } from '@g88/shared';
import { PasswordResetMailer } from './password-reset-mailer';

const savedEnv = { ...process.env };
beforeEach(() => {
  process.env.PASSWORD_RESET_SECRET = 'test-only-recovery-secret-more-than-32-chars';
  process.env.SENDGRID_API_KEY = 'test-only';
  process.env.SENDGRID_FROM_EMAIL = 'nexa@example.com';
});
afterEach(() => { process.env = { ...savedEnv }; jest.restoreAllMocks(); });

it('sends the configured provider payload without tracking or exposing provider errors', async () => {
  const transport = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
  const mailer = new PasswordResetMailer();
  await mailer.send('person@example.com', '12345678');
  const [url, options] = transport.mock.calls[0]!;
  expect(url).toBe('https://api.sendgrid.com/v3/mail/send');
  const payload = JSON.parse(options?.body as string) as {
    from: { email: string }; personalizations: Array<{ to: Array<{ email: string }> }>;
    tracking_settings: { click_tracking: { enable: boolean } };
  };
  expect(payload.from.email).toBe('nexa@example.com');
  expect(payload.personalizations[0]?.to[0]?.email).toBe('person@example.com');
  expect(payload.tracking_settings.click_tracking.enable).toBe(false);
  transport.mockResolvedValueOnce({ ok: false } as Response);
  await expect(mailer.send('person@example.com', '12345678')).rejects.toThrow('Password reset mail delivery failed');
});

it('scrubs reset codes and passwords from diagnostics', () => {
  expect(scrubSentryPayload({ resetCode: '12345678', newPassword: 'private-password' })).toEqual({
    resetCode: '[redacted]', newPassword: '[redacted]',
  });
});
