import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import type { AreaCategory } from '@g88/shared';

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

  /**
   * Looks up the sender's display name then pushes to the recipient.
   * Used by the realtime gateway where only the senderId is available.
   */
  async notifyMessageFrom(
    toUserId: string,
    senderId: string,
    preview: string,
    conversationId: string,
  ): Promise<void> {
    const [sender] = await this.db.query<Array<{ display_name: string }>>(
      `SELECT display_name FROM users WHERE id = $1 LIMIT 1`,
      [senderId],
    );
    const senderName = sender?.display_name ?? 'Someone';
    await this.notifyMessage(toUserId, senderName, preview, conversationId);
  }

  /**
   * Push a "something happened in your watched area" alert to every user whose
   * active geofence contains the alert's H3 r7 cell.
   *
   * The geofence "inside" test is `alertCell ∈ gridDisk(center, radius_rings)`.
   * We pre-filter candidates with a single gridDisk(alertCell, MAX_RINGS) query,
   * then confirm each match in-process (a geofence with radius 1 should not be
   * notified about an alert 3 rings away).
   */
  async notifyGeofenceMatch(
    alertCellH3R7: string | null,
    authorId: string,
    category: AreaCategory,
    body: string,
  ): Promise<void> {
    if (!alertCellH3R7) return; // alert has no location — nothing to match against.

    const MAX_RINGS = 3; // matches geofences.radius_rings CHECK (0..3)
    const candidateCells = h3.gridDisk(alertCellH3R7, MAX_RINGS);

    const rows = await this.db.query<Array<{
      user_id: string; center_h3_r7: string; radius_rings: number;
    }>>(
      `SELECT user_id, center_h3_r7, radius_rings
         FROM geofences
        WHERE active = true
          AND user_id <> $1
          AND center_h3_r7 = ANY($2::text[])`,
      [authorId, candidateCells],
    );

    // Confirm the alert cell really falls inside each geofence's disk.
    const recipientIds = rows
      .filter((g) => h3.gridDisk(g.center_h3_r7, g.radius_rings).includes(alertCellH3R7))
      .map((g) => g.user_id);

    if (recipientIds.length === 0) return;

    const title = category === 'general'
      ? 'New alert nearby'
      : `New ${category} alert nearby`;
    const preview = body.length > 80 ? body.slice(0, 77) + '…' : body;

    for (const recipientId of recipientIds) {
      const tokens = await this.getTokens(recipientId);
      if (!tokens.length) continue;
      await this.sendMulticast(tokens, { title, body: preview }, { type: 'alert' });
    }
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
