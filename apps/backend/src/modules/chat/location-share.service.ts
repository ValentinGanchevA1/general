import {
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  ChatLocation,
  ChatMessage,
  LocationShareDuration,
  LocationShareEndReason,
  LocationShareSession,
} from '@g88/shared';

import { ChatService } from './chat.service';

interface SessionRow {
  id: string;
  conversation_id: string;
  sharer_id: string;
  status: 'active' | 'ended';
  duration: LocationShareDuration;
  started_at: Date | string;
  ends_at: Date | string | null;
  last_lat: number;
  last_lng: number;
  last_updated_at: Date | string;
  ended_at: Date | string | null;
  end_reason: LocationShareEndReason | null;
}

/** One session closed by the sweep job. */
export interface SweptLocationSession {
  id: string;
  conversationId: string;
  reason: Extract<LocationShareEndReason, 'expired' | 'timeout'>;
  endedAt: string;
}

@Injectable()
export class LocationShareService {
  private readonly logger = new Logger(LocationShareService.name);

  /** No update for this long → session ends with reason `timeout`. */
  static readonly STALE_MS = 90_000;
  /** Minimum gap between accepted updates from the same session. */
  static readonly MIN_UPDATE_INTERVAL_MS = 5_000;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly chat: ChatService,
  ) {}

  async start(
    userId: string,
    conversationId: string,
    duration: LocationShareDuration,
    location: ChatLocation,
  ): Promise<{ session: LocationShareSession; message: ChatMessage }> {
    this.assertValidCoords(location);
    await this.assertParticipant(userId, conversationId);
    await this.assertNotBlockedInConversation(userId, conversationId);

    // At most one active session per sharer in this conversation.
    await this.endActiveForSharer(userId, conversationId, 'stopped');

    const endsAt = this.computeEndsAt(duration);

    const [row] = await this.db.query<SessionRow[]>(
      `INSERT INTO chat_location_sessions
         (conversation_id, sharer_id, duration, ends_at, last_lat, last_lng)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [conversationId, userId, duration, endsAt, location.lat, location.lng],
    );
    if (!row) {
      throw new Error('Failed to create location share session');
    }

    const message = await this.chat.persistLocationSession(
      conversationId,
      userId,
      row.id,
      this.bodyForStart(duration),
      location,
    );

    return { session: this.toSession(row), message };
  }

  async update(
    userId: string,
    sessionId: string,
    location: ChatLocation,
  ): Promise<{ updatedAt: string; conversationId: string }> {
    this.assertValidCoords(location);

    const session = await this.getSession(sessionId);
    if (session.sharer_id !== userId) {
      throw new ForbiddenException({
        code: 'location.not_sharer',
        message: 'Only the sharer can update this session',
      });
    }
    if (session.status !== 'active') {
      throw new GoneException({
        code: 'location.ended',
        message: 'Location share session has ended',
      });
    }

    await this.assertUpdateAllowed(session, location);

    const updatedAt = new Date().toISOString();
    await this.db.query(
      `UPDATE chat_location_sessions
          SET last_lat = $2, last_lng = $3, last_updated_at = $4::timestamptz
        WHERE id = $1 AND status = 'active'`,
      [sessionId, location.lat, location.lng, updatedAt],
    );

    return { updatedAt, conversationId: session.conversation_id };
  }

  async stop(userId: string, sessionId: string): Promise<{ conversationId: string; endedAt: string }> {
    const session = await this.getSession(sessionId);
    if (session.sharer_id !== userId) {
      throw new ForbiddenException({
        code: 'location.not_sharer',
        message: 'Only the sharer can stop this session',
      });
    }
    if (session.status !== 'active') {
      throw new GoneException({
        code: 'location.ended',
        message: 'Location share session has ended',
      });
    }

    const endedAt = await this.markEnded(sessionId, 'stopped');
    return { conversationId: session.conversation_id, endedAt };
  }

  /** Active session in a conversation visible to a participant (any sharer). */
  async findActiveForConversation(
    conversationId: string,
    userId: string,
  ): Promise<LocationShareSession | null> {
    if (!(await this.chat.isParticipant(conversationId, userId))) {
      throw new ForbiddenException({
        code: 'location.not_participant',
        message: 'Not a participant',
      });
    }

    const [row] = await this.db.query<SessionRow[]>(
      `SELECT * FROM chat_location_sessions
        WHERE conversation_id = $1 AND status = 'active'
        ORDER BY started_at DESC
        LIMIT 1`,
      [conversationId],
    );
    return row ? this.toSession(row) : null;
  }

  /**
   * End sessions past ends_at or with stale last_updated_at.
   * Returns closed sessions so the caller can fan-out socket events.
   */
  async sweepExpired(): Promise<SweptLocationSession[]> {
    const staleCutoff = new Date(Date.now() - LocationShareService.STALE_MS).toISOString();

    const expired = await this.db.query<
      Array<{ id: string; conversation_id: string; ended_at: Date | string }>
    >(
      `UPDATE chat_location_sessions
          SET status = 'ended', ended_at = NOW(), end_reason = 'expired'
        WHERE status = 'active'
          AND ends_at IS NOT NULL
          AND ends_at <= NOW()
        RETURNING id, conversation_id, ended_at`,
    );

    const timedOut = await this.db.query<
      Array<{ id: string; conversation_id: string; ended_at: Date | string }>
    >(
      `UPDATE chat_location_sessions
          SET status = 'ended', ended_at = NOW(), end_reason = 'timeout'
        WHERE status = 'active'
          AND last_updated_at < $1::timestamptz
        RETURNING id, conversation_id, ended_at`,
      [staleCutoff],
    );

    const closed: SweptLocationSession[] = [
      ...expired.map((r) => ({
        id: r.id,
        conversationId: r.conversation_id,
        reason: 'expired' as const,
        endedAt: this.toIso(r.ended_at),
      })),
      ...timedOut.map((r) => ({
        id: r.id,
        conversationId: r.conversation_id,
        reason: 'timeout' as const,
        endedAt: this.toIso(r.ended_at),
      })),
    ];

    if (closed.length > 0) {
      this.logger.log(
        `sweepExpired closed ${closed.length} sessions (${expired.length} expired, ${timedOut.length} timeout)`,
      );
    }
    return closed;
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async getSession(sessionId: string): Promise<SessionRow> {
    const [row] = await this.db.query<SessionRow[]>(
      `SELECT * FROM chat_location_sessions WHERE id = $1 LIMIT 1`,
      [sessionId],
    );
    if (!row) {
      throw new NotFoundException({
        code: 'location.not_found',
        message: 'Location share session not found',
      });
    }
    return row;
  }

  private async markEnded(sessionId: string, reason: LocationShareEndReason): Promise<string> {
    const endedAt = new Date().toISOString();
    await this.db.query(
      `UPDATE chat_location_sessions
          SET status = 'ended', ended_at = $2::timestamptz, end_reason = $3
        WHERE id = $1 AND status = 'active'`,
      [sessionId, endedAt, reason],
    );
    return endedAt;
  }

  private async endActiveForSharer(
    sharerId: string,
    conversationId: string,
    reason: LocationShareEndReason,
  ): Promise<void> {
    await this.db.query(
      `UPDATE chat_location_sessions
          SET status = 'ended', ended_at = NOW(), end_reason = $3
        WHERE sharer_id = $1
          AND conversation_id = $2
          AND status = 'active'`,
      [sharerId, conversationId, reason],
    );
  }

  private async assertParticipant(userId: string, conversationId: string): Promise<void> {
    if (!(await this.chat.isParticipant(conversationId, userId))) {
      throw new ForbiddenException({
        code: 'location.not_participant',
        message: 'Not a participant',
      });
    }
  }

  private async assertNotBlockedInConversation(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const peers = await this.chat.getParticipantIds(conversationId);
    const otherId = peers.find((id) => id !== userId);
    if (!otherId) return;

    const [row] = await this.db.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM user_blocks ub
          WHERE (ub.blocker_id = $1 AND ub.blocked_id = $2)
             OR (ub.blocker_id = $2 AND ub.blocked_id = $1)
       ) AS exists`,
      [userId, otherId],
    );
    if (row?.exists) {
      throw new ForbiddenException({
        code: 'location.blocked',
        message: 'Cannot share location with this user',
      });
    }
  }

  private assertValidCoords(location: ChatLocation): void {
    const { lat, lng } = location;
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new ForbiddenException({
        code: 'location.invalid_coords',
        message: 'Invalid coordinates',
      });
    }
  }

  private async assertUpdateAllowed(session: SessionRow, _location: ChatLocation): Promise<void> {
    const last = this.toMs(session.last_updated_at);
    const elapsed = Date.now() - last;
    if (elapsed < LocationShareService.MIN_UPDATE_INTERVAL_MS) {
      throw new ForbiddenException({
        code: 'location.rate_limited',
        message: 'Location updates too frequent',
      });
    }
  }

  private computeEndsAt(duration: LocationShareDuration): string | null {
    if (duration === 'until_off') return null;
    const ms = duration === '15m' ? 15 * 60_000 : 60 * 60_000;
    return new Date(Date.now() + ms).toISOString();
  }

  private bodyForStart(duration: LocationShareDuration): string {
    if (duration === '15m') return 'Started sharing live location for 15 minutes';
    if (duration === '60m') return 'Started sharing live location for 1 hour';
    return 'Started sharing live location';
  }

  private toSession(row: SessionRow): LocationShareSession {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      sharerId: row.sharer_id,
      status: row.status,
      duration: row.duration,
      startedAt: this.toIso(row.started_at),
      endsAt: row.ends_at ? this.toIso(row.ends_at) : null,
      lastLocation: { lat: row.last_lat, lng: row.last_lng },
      lastUpdatedAt: this.toIso(row.last_updated_at),
      endedAt: row.ended_at ? this.toIso(row.ended_at) : null,
      endReason: row.end_reason,
    };
  }

  private toIso(v: Date | string): string {
    return v instanceof Date ? v.toISOString() : v;
  }

  private toMs(v: Date | string): number {
    return v instanceof Date ? v.getTime() : new Date(v).getTime();
  }
}
