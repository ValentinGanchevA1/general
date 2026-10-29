import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import {
  type AreaCategory,
  type NotificationChannel,
  type NotificationPreferences,
  NOTIFICATION_CHANNELS,
} from '@g88/shared';

import { buildNexaPushData, nexaLockScreenCopy } from './notificationIdentity';

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

/** Per-channel frequency caps (sends per epoch-aligned window). Bounds push spam. */
const CHANNEL_CAPS: Record<NotificationChannel, { limit: number; windowSec: number }> = {
  waves: { limit: 12, windowSec: 3600 },
  messages: { limit: 40, windowSec: 3600 },
  gifts: { limit: 12, windowSec: 3600 },
  friends: { limit: 20, windowSec: 3600 },
  nearby: { limit: 6, windowSec: 3600 },
  events: { limit: 6, windowSec: 3600 },
  listings: { limit: 6, windowSec: 3600 },
  digest: { limit: 1, windowSec: 86_400 },
};

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

  async unregisterToken(userId: string, token: string): Promise<void> {
    await this.db.query(
      `DELETE FROM device_tokens WHERE user_id = $1 AND token = $2`,
      [userId, token],
    );
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const rows = await this.db.query<Array<{ channel: string; enabled: boolean }>>(
      `SELECT channel, enabled FROM notification_preferences WHERE user_id = $1`,
      [userId],
    );
    const prefs = Object.fromEntries(
      NOTIFICATION_CHANNELS.map((c) => [c, true]),
    ) as NotificationPreferences;
    for (const r of rows) {
      if ((NOTIFICATION_CHANNELS as readonly string[]).includes(r.channel)) {
        prefs[r.channel as NotificationChannel] = r.enabled;
      }
    }
    return prefs;
  }

  async setPreferences(
    userId: string,
    updates: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    for (const [channel, enabled] of Object.entries(updates)) {
      if (!(NOTIFICATION_CHANNELS as readonly string[]).includes(channel)) continue;
      if (typeof enabled !== 'boolean') continue;
      await this.db.query(
        `INSERT INTO notification_preferences (user_id, channel, enabled, updated_at)
              VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, channel)
         DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
        [userId, channel, enabled],
      );
    }
    return this.getPreferences(userId);
  }

  private async allowed(userId: string, channel: NotificationChannel): Promise<boolean> {
    const [pref] = await this.db.query<Array<{ enabled: boolean }>>(
      `SELECT enabled FROM notification_preferences WHERE user_id = $1 AND channel = $2`,
      [userId, channel],
    );
    if (pref && pref.enabled === false) return false;

    const cap = CHANNEL_CAPS[channel];
    const bucket = Math.floor(Date.now() / 1000 / cap.windowSec);
    const rows = await this.db.query<Array<{ allowed: boolean }>>(
      `WITH pruned AS (
         DELETE FROM notification_frequency_caps
          WHERE expires_at <= NOW()
          RETURNING 1
       ), consumed AS (
         INSERT INTO notification_frequency_caps
           (user_id, channel, window_bucket, send_count, expires_at, updated_at)
         VALUES ($1, $2, $3, 1, NOW() + ($5 * INTERVAL '1 second'), NOW())
         ON CONFLICT (user_id, channel, window_bucket) DO UPDATE SET
           send_count = LEAST(notification_frequency_caps.send_count + 1, $4 + 1),
           expires_at = GREATEST(notification_frequency_caps.expires_at, EXCLUDED.expires_at),
           updated_at = NOW()
         RETURNING send_count
       )
       SELECT send_count <= $4 AS allowed FROM consumed`,
      [userId, channel, bucket, cap.limit, cap.windowSec * 2],
    );
    return rows[0]?.allowed === true;
  }

  async notifyWave(
    toUserId: string,
    fromUser: { id: string; displayName: string },
    context: string,
  ): Promise<void> {
    void context;
    if (!(await this.allowed(toUserId, 'waves'))) return;
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    await this.sendMulticast(
      tokens,
      nexaLockScreenCopy('interaction.wave'),
      buildNexaPushData('interaction.wave', {
        actorUserId: fromUser.id,
        fromUserId: fromUser.id,
      }),
    );
  }

  async notifyGift(
    toUserId: string,
    fromName: string,
    emoji: string,
    label: string,
  ): Promise<void> {
    void fromName;
    void emoji;
    void label;
    if (!(await this.allowed(toUserId, 'gifts'))) return;
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    await this.sendMulticast(
      tokens,
      nexaLockScreenCopy('interaction.gift'),
      buildNexaPushData('interaction.gift'),
    );
  }

  async notifyMessage(
    toUserId: string,
    senderName: string,
    preview: string,
    conversationId: string,
  ): Promise<void> {
    void senderName;
    void preview;
    if (!(await this.allowed(toUserId, 'messages'))) return;
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    await this.sendMulticast(
      tokens,
      nexaLockScreenCopy('interaction.message'),
      buildNexaPushData('interaction.message', { conversationId }),
    );
  }

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

  async notifyIdVerificationDecided(
    toUserId: string,
    decision: 'verified' | 'rejected',
    reason?: string,
  ): Promise<void> {
    void reason;
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    const kind = decision === 'verified' ? 'trust.id-verified' : 'trust.id-rejected';
    await this.sendMulticast(
      tokens,
      nexaLockScreenCopy(kind),
      buildNexaPushData(kind, { decision }),
    );
  }

  async notifyFriendRequest(
    toUserId: string,
    fromUser: { id: string; displayName: string },
  ): Promise<void> {
    if (!(await this.allowed(toUserId, 'friends'))) return;
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    await this.sendMulticast(
      tokens,
      nexaLockScreenCopy('interaction.connection-request'),
      buildNexaPushData('interaction.connection-request', {
        actorUserId: fromUser.id,
        fromUserId: fromUser.id,
      }),
    );
  }

  async notifyFriendAccepted(
    toUserId: string,
    peer: { id: string; displayName: string },
  ): Promise<void> {
    if (!(await this.allowed(toUserId, 'friends'))) return;
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    await this.sendMulticast(
      tokens,
      nexaLockScreenCopy('interaction.connection-accepted'),
      buildNexaPushData('interaction.connection-accepted', {
        actorUserId: peer.id,
        peerUserId: peer.id,
      }),
    );
  }

  private async geofenceRecipients(cellH3R7: string, authorId: string): Promise<string[]> {
    const MAX_RINGS = 3;
    const candidateCells = h3.gridDisk(cellH3R7, MAX_RINGS);

    const rows = await this.db.query<Array<{
      user_id: string;
      center_h3_r7: string;
      radius_rings: number;
    }>>(
      `SELECT user_id, center_h3_r7, radius_rings
         FROM geofences
        WHERE active = true
          AND user_id <> $1
          AND center_h3_r7 = ANY($2::text[])`,
      [authorId, candidateCells],
    );

    return rows
      .filter((g) => h3.gridDisk(g.center_h3_r7, g.radius_rings).includes(cellH3R7))
      .map((g) => g.user_id);
  }

  private async fanOut(
    recipientIds: string[],
    channel: NotificationChannel,
    notification: { title: string; body: string },
    data: Record<string, string>,
  ): Promise<void> {
    for (const recipientId of recipientIds) {
      if (!(await this.allowed(recipientId, channel))) continue;
      const tokens = await this.getTokens(recipientId);
      if (!tokens.length) continue;
      await this.sendMulticast(tokens, notification, data);
    }
  }

  async notifyGeofenceMatch(
    alertCellH3R7: string | null,
    authorId: string,
    category: AreaCategory,
    body: string,
  ): Promise<void> {
    void category;
    void body;
    if (!alertCellH3R7) return;
    const recipients = await this.geofenceRecipients(alertCellH3R7, authorId);
    if (!recipients.length) return;

    await this.fanOut(
      recipients,
      'nearby',
      nexaLockScreenCopy('live.nearby-alert'),
      buildNexaPushData('live.nearby-alert'),
    );
  }

  async notifyEventNearby(
    cellH3R7: string | null,
    hostId: string,
    eventTitle: string,
    eventId: string,
  ): Promise<void> {
    void eventTitle;
    if (!cellH3R7) return;
    const recipients = await this.geofenceRecipients(cellH3R7, hostId);
    if (!recipients.length) return;
    await this.fanOut(
      recipients,
      'events',
      nexaLockScreenCopy('event.nearby'),
      buildNexaPushData('event.nearby', { entityId: eventId, eventId }),
    );
  }

  async notifyListingNearby(
    cellH3R7: string | null,
    sellerId: string,
    listingTitle: string,
    listingId: string,
  ): Promise<void> {
    void listingTitle;
    if (!cellH3R7) return;
    const recipients = await this.geofenceRecipients(cellH3R7, sellerId);
    if (!recipients.length) return;
    await this.fanOut(
      recipients,
      'listings',
      nexaLockScreenCopy('marketplace.nearby-listing'),
      buildNexaPushData('marketplace.nearby-listing', {
        entityId: listingId,
        listingId,
      }),
    );
  }

  async runDigest(): Promise<{ candidates: number; sent: number }> {
    const rows = await this.db.query<Array<{ user_id: string; waves: string; gifts: string }>>(
      `WITH recipients AS (
         SELECT DISTINCT dt.user_id
           FROM device_tokens dt
          WHERE NOT EXISTS (
            SELECT 1 FROM notification_preferences np
             WHERE np.user_id = dt.user_id AND np.channel = 'digest' AND np.enabled = false)
       )
       SELECT r.user_id,
         (SELECT COUNT(*) FROM waves w
            WHERE w.to_user_id = r.user_id AND w.created_at > NOW() - interval '1 day')::text AS waves,
         (SELECT COUNT(*) FROM gifts g
            WHERE g.recipient_id = r.user_id AND g.created_at > NOW() - interval '1 day')::text AS gifts
       FROM recipients r`,
    );

    let sent = 0;
    for (const row of rows) {
      const waves = Number(row.waves);
      const gifts = Number(row.gifts);
      if (waves + gifts === 0) continue;
      if (!(await this.allowed(row.user_id, 'digest'))) continue;
      const tokens = await this.getTokens(row.user_id);
      if (!tokens.length) continue;

      await this.sendMulticast(
        tokens,
        nexaLockScreenCopy('discovery.daily-recap'),
        buildNexaPushData('discovery.daily-recap'),
      );
      sent++;
    }
    return { candidates: rows.length, sent };
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
      const res = await messaging.sendEachForMulticast({ tokens, notification, data });
      if (res.failureCount > 0) {
        await this.pruneInvalidTokens(tokens, res.responses);
      }
    } catch (err) {
      this.logger.error(`FCM sendEachForMulticast failed: ${err}`);
    }
  }

  /** Drop dead registration tokens so later sends do not burn quota. */
  private async pruneInvalidTokens(
    tokens: string[],
    responses: Array<{ success: boolean; error?: { code?: string } }>,
  ): Promise<void> {
    const deadCodes = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
    ]);
    const dead: string[] = [];
    responses.forEach((r, i) => {
      const code = r.error?.code;
      if (!r.success && code && deadCodes.has(code)) {
        const token = tokens[i];
        if (token) dead.push(token);
      }
    });
    if (dead.length === 0) return;
    try {
      await this.db.query(`DELETE FROM device_tokens WHERE token = ANY($1::text[])`, [dead]);
      this.logger.warn(`Pruned ${dead.length} invalid FCM token(s)`);
    } catch (err) {
      this.logger.error(`Failed to prune invalid FCM tokens: ${err}`);
    }
  }
}
