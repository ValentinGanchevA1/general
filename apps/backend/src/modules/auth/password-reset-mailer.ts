import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';

/** Recovery-specific secrets and mail transport. No dev code or logging fallback. */
@Injectable()
export class PasswordResetMailer {
  assertConfigured(): void {
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL ||
        (process.env.PASSWORD_RESET_SECRET?.length ?? 0) < 32) {
      throw new ServiceUnavailableException({ code: 'auth.recovery_unavailable', message: 'Password recovery is temporarily unavailable. Please try again later.' });
    }
  }

  digest(value: string): string {
    this.assertConfigured();
    return createHmac('sha256', process.env.PASSWORD_RESET_SECRET!).update(value).digest('hex');
  }

  private encryptionKey(): Buffer {
    this.assertConfigured();
    return createHash('sha256').update(`nexa-reset-outbox:${process.env.PASSWORD_RESET_SECRET!}`).digest();
  }

  encrypt(code: string, requestId: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    cipher.setAAD(Buffer.from(requestId));
    const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }

  decrypt(encrypted: string, requestId: string): string {
    const value = Buffer.from(encrypted, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), value.subarray(0, 12));
    decipher.setAAD(Buffer.from(requestId));
    decipher.setAuthTag(value.subarray(12, 28));
    return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8');
  }

  async send(email: string, resetCode: string): Promise<void> {
    this.assertConfigured();
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY!}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: process.env.SENDGRID_FROM_EMAIL!, name: 'NEXA' },
        subject: 'Reset your NEXA password',
        content: [{ type: 'text/plain', value: `Your NEXA password reset code is ${resetCode}.\n\nReturn to NEXA and enter this code with your new password. It expires 15 minutes after your request. Only the latest code works. Never share it.\n\nIf you did not request this, ignore this email. Your password has not changed.` }],
        tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
      }),
    });
    if (!response.ok) throw new Error('Password reset mail delivery failed');
  }
}
