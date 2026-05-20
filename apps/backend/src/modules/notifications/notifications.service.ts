import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// firebase-admin is initialized once on module load if credentials are present.
// All push calls are no-ops when FIREBASE_CREDENTIALS is absent (local dev).
let firebaseApp: import('firebase-admin/app').App | null = null;

async function getMessaging(): Promise<import('firebase-admin/messaging').Messaging | null> {
  if (!process.env.FIREBASE_CREDENTIALS) return null;
  if (!firebaseApp) {
    const { initializeApp, cert } = await import('firebase-admin/app');
    const creds = JSON.parse(
      Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString('utf-8'),
    );
    firebaseApp = initializeApp({ credential: cert(creds) });
  }
  const { getMessaging } = await import('firebase-admin/messaging');
  return getMessaging(firebaseApp);
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async registerToken(userId: string, token: string, platform: 'ios' | 'android'): Promise<void> {
    await this.db.query(
      `INSERT INTO device_tokens (user_id, platform, token, last_seen_at)
            VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, token) DO UPDATE SET last_seen_at = NOW()`,
      [userId, platform, token],
    );
  }

  async notifyWave(
    toUserId: string,
    fromUser: { id: string; displayName: string },
    context: string,
  ): Promise<void> {
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    await this.sendMulticast(tokens, {
      title: `${fromUser.displayName} waved at you`,
      body: context === 'map' ? 'They saw you on the map' : `From a ${context}`,
    }, { type: 'wave', fromUserId: fromUser.id });
  }

  async notifyMessage(
    toUserId: string,
    senderName: string,
    preview: string,
    conversationId: string,
  ): Promise<void> {
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    await this.sendMulticast(tokens, {
      title: senderName,
      body: preview.length > 80 ? preview.slice(0, 77) + '…' : preview,
    }, { type: 'message', conversationId });
  }

  private async getTokens(userId: string): Promise<string[]> {
    const rows = await this.db.query<Array<{ token: string }>>(
      `SELECT token FROM device_tokens WHERE user_id = $1
         ORDER BY last_seen_at DESC LIMIT 5`,
      [userId],
    );
    return rows.map((r) => r.token);
  }

  private async sendMulticast(
    tokens: string[],
    notification: { title: string; body: string },
    data: Record<string, string>,
  ): Promise<void> {
    const messaging = await getMessaging();
    if (!messaging) {
      this.logger.debug('FCM not configured — skipping push');
      return;
    }
    try {
      await messaging.sendEachForMulticast({ tokens, notification, data });
    } catch (err) {
      this.logger.error(`FCM sendEachForMulticast failed: ${err}`);
    }
  }
}
