import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';
import type Redis from 'ioredis';

import {
  type AreaCategory,
  type NotificationChannel,
  type NotificationPreferences,
  NOTIFICATION_CHANNELS,
} from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';

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

/** Per-channel frequency caps (sends per rolling window). Bounds push spam. */
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

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async registerToken(userId: string, token: string, platform: 'ios' | 'android'): Promise<void> {
    await this.db.query(
      `INSERT INTO device_tokens (user_id, platform, token, last_seen_at)
            VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, token) DO UPDATE SET last_seen_at = NOW()`,
      [userId, platform, token],
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
    const key = `notif:cap:${userId}:${channel}:${bucket}`;
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, cap.windowSec);
    return n <= cap.limit;
  }

  async notifyWave(
    toUserId: string,
    fromUser: { id: string; displayName: string },
    context: string,
  ): Promise<void> {
    if (!(await this.allowed(toUserId, 'waves'))) return;
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    await this.sendMulticast(tokens, {
      title: `${fromUser.displayName} waved at you`,
      body: context === 'map' ? 'They saw you on the map' : `From a ${context}`,
    }, { type: 'wave', fromUserId: fromUser.id });
  }

  async notifyGift(
    toUserId: string,
    fromName: string,
    emoji: string,
    label: string,
  ): Promise<void> {
    if (!(await this.allowed(toUserId, 'gifts'))) return;
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    await this.sendMulticast(tokens, {
      title: `${fromName} sent you a gift ${emoji}`,
      body: `You received a ${label}.`,
    }, { type: 'gift' });
  }

  async notifyMessage(
    toUserId: string,
    senderName: string,
    preview: string,
    conversationId: string,
  ): Promise<void> {
    if (!(await this.allowed(toUserId, 'messages'))) return;
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    await this.sendMulticast(tokens, {
      title: senderName,
      body: preview.length > 80 ? preview.slice(0, 77) + '…' : preview,
    }, { type: 'message', conversationId });
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
    const tokens = await this.getTokens(toUserId);
    if (!tokens.length) return;

    await this.sendMulticast(
      tokens,
      {
        title: decision === 'verified' ? 'ID Verified ✅' : 'Verification not approved',
        body:
          decision === 'verified'
            ? 'Your identity has been verified.'
            : `Verification rejected${reason ? `: ${reason}` : '.'} You can resubmit anytime.`,
      },
      { type: 'id_verification', decision },
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
      {
        title: 'Friend request',
        body: `${fromUser.displayName} wants to be friends`,
      },
      { type: 'friend_request', fromUserId: fromUser.id },
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
      {
        title: 'Friend request accepted',
        body: `${peer.displayName} accepted your friend request`,
      },
      { type: 'friend_accepted', peerUserId: peer.id },
    );
  }

  private async geofenceRecipients(cellH3R7: string, authorId: string): Promise<string[]> {
    const MAX_RINGS = 3;
    const candidateCells = h3.gridDisk(cellH3R7, MAX_RINGS);

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
    if (!alertCellH3R7) return;
    const recipients = await this.geofenceRecipients(alertCellH3R7, authorId);
    if (!recipients.length) return;

    const title = category === 'general' ? 'New alert nearby' : `New ${category} alert nearby`;
    const preview = body.length > 80 ? body.slice(0, 77) + '…' : body;
    await this.fanOut(recipients, 'nearby', { title, body: preview }, { type: 'alert' });
  }

  async notifyEventNearby(
    cellH3R7: string | null,
    hostId: string,
    eventTitle: string,
    eventId: string,
  ): Promise<void> {
    if (!cellH3R7) return;
    const recipients = await this.geofenceRecipients(cellH3R7, hostId);
    if (!recipients.length) return;
    await this.fanOut(
      recipients,
      'events',
      { title: 'New event nearby', body: eventTitle },
      { type: 'event', eventId },
    );
  }

  async notifyListingNearby(
    cellH3R7: string | null,
    sellerId: string,
    listingTitle: string,
    listingId: string,
  ): Promise<void> {
    if (!cellH3R7) return;
    const recipients = await this.geofenceRecipients(cellH3R7, sellerId);
    if (!recipients.length) return;
    await this.fanOut(
      recipients,
      'listings',
      { title: 'New item for sale nearby', body: listingTitle },
      { type: 'listing', listingId },
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

      const parts: string[] = [];
      if (waves) parts.push(`${waves} wave${waves > 1 ? 's' : ''}`);
      if (gifts) parts.push(`${gifts} gift${gifts > 1 ? 's' : ''}`);
      await this.sendMulticast(
        tokens,
        { title: 'Your G88 daily digest', body: `You got ${parts.join(' and ')} today.` },
        { type: 'digest' },
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
      await messaging.sendEachForMulticast({ tokens, notification, data });
    } catch (err) {
      this.logger.error(`FCM sendEachForMulticast failed: ${err}`);
    }
  }
}
