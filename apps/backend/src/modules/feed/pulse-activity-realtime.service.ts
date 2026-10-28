import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import type {
  ActivityItem,
  CheckInAudience,
  PulseActivityEvent,
  PulseActivityRemoveEvent,
} from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { RealtimeEmitterService } from '../../realtime/realtime-emitter.service';

const PULSE_ACTIVITY_CHANNEL = 'pulse:activity:v1';
const PULSE_ACTIVITY_REMOVE_CHANNEL = 'pulse:activity:remove:v1';
const PUBLISHED_DEDUPE_TTL_SECONDS = 120;
const PULSE_CELL_RADIUS = 8;
const MAX_DISTANCE_M = 10_000;
const MAX_RECIPIENTS = 1_000;

interface PulseActivityRecipient {
  userId: string;
  distanceM: number;
}

interface PulseActivityEnvelope {
  item: ActivityItem;
  emittedAt: string;
  recipients: PulseActivityRecipient[];
}

interface PulseActivityRemoveEnvelope {
  activityId: string;
  emittedAt: string;
  recipientIds: string[];
}

interface RecipientLocationRow {
  id: string;
  location_h3_r7: string;
}

export interface PublishCheckInActivityInput {
  checkInId: string;
  actorId: string;
  placeLabel: string;
  audience: CheckInAudience;
  locationH3R7: string;
  createdAt: string;
}

export interface PublishEventJoinActivityInput {
  eventId: string;
  actorId: string;
  eventTitle: string;
  eventHostId: string;
  locationH3R7: string;
  createdAt: string;
}

export interface RemoveEventJoinActivityInput {
  eventId: string;
  actorId: string;
  eventHostId: string;
  locationH3R7: string;
}

/**
 * Redis-backed process-independent delivery for Pulse activity.
 * Postgres remains authoritative; socket events only accelerate an already
 * persisted activity into eligible connected clients.
 */
@Injectable()
export class PulseActivityRealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PulseActivityRealtimeService.name);
  private readonly subscriber: Redis;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly emitter: RealtimeEmitterService,
  ) {
    this.subscriber = redis.duplicate();
  }

  async onModuleInit(): Promise<void> {
    this.subscriber.on('message', (channel, payload) => {
      if (channel === PULSE_ACTIVITY_CHANNEL) {
        const envelope = this.parseEnvelope(payload);
        if (envelope != null) this.deliverLocal(envelope);
        return;
      }
      if (channel === PULSE_ACTIVITY_REMOVE_CHANNEL) {
        const envelope = this.parseRemoveEnvelope(payload);
        if (envelope != null) this.deliverRemovalLocal(envelope);
      }
    });
    await this.subscriber.subscribe(PULSE_ACTIVITY_CHANNEL, PULSE_ACTIVITY_REMOVE_CHANNEL);
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.unsubscribe(PULSE_ACTIVITY_CHANNEL, PULSE_ACTIVITY_REMOVE_CHANNEL);
    this.subscriber.disconnect();
  }

  async publishCheckIn(input: PublishCheckInActivityInput): Promise<void> {
    const claimed = await this.claimOnce(`pulse:activity:published:${input.checkInId}`);
    if (!claimed) return;

    const actorName = await this.actorName(input.actorId);
    if (!actorName) return;

    const recipients = await this.checkInRecipients(
      input.actorId,
      input.audience,
      input.locationH3R7,
    );
    if (recipients.length === 0) return;

    await this.publishEnvelope({
      id: `place:${input.checkInId}`,
      type: 'place',
      category: null,
      title: input.placeLabel,
      preview: input.audience === 'friends' ? 'Shared with friends' : 'Shared nearby',
      actorId: input.actorId,
      actorName,
      distanceM: null,
      createdAt: input.createdAt,
      unread: false,
      narrative: {
        kind: 'place_visit',
        verb: 'visited',
        objectLabel: input.placeLabel,
        placeLabel: null,
      },
      deepLink: { screen: 'Main', params: { screen: 'Map' } },
    }, recipients);
  }

  async publishEventJoin(input: PublishEventJoinActivityInput): Promise<void> {
    await this.redis.del(this.eventJoinRemovedKey(input.eventId, input.actorId));
    const claimed = await this.claimOnce(this.eventJoinPublishedKey(input.eventId, input.actorId));
    if (!claimed) return;

    const actorName = await this.actorName(input.actorId);
    if (!actorName) return;

    const recipients = await this.eventJoinRecipients(
      input.actorId,
      input.eventHostId,
      input.locationH3R7,
    );
    if (recipients.length === 0) return;

    await this.publishEnvelope({
      id: this.eventJoinActivityId(input.eventId, input.actorId),
      type: 'event',
      category: null,
      title: input.eventTitle,
      preview: 'Shared an event RSVP',
      actorId: input.actorId,
      actorName,
      distanceM: null,
      createdAt: input.createdAt,
      unread: false,
      narrative: {
        kind: 'event_joined',
        verb: 'joined',
        objectLabel: input.eventTitle,
        placeLabel: null,
      },
      deepLink: { screen: 'EventDetail', params: { eventId: input.eventId } },
    }, recipients);
  }

  async removeEventJoin(input: RemoveEventJoinActivityInput): Promise<void> {
    await this.redis.del(this.eventJoinPublishedKey(input.eventId, input.actorId));
    const claimed = await this.claimOnce(this.eventJoinRemovedKey(input.eventId, input.actorId));
    if (!claimed) return;

    const recipients = await this.eventJoinRecipients(
      input.actorId,
      input.eventHostId,
      input.locationH3R7,
    );
    const recipientIds = new Set(recipients.map((recipient) => recipient.userId));
    recipientIds.add(input.actorId);

    const envelope: PulseActivityRemoveEnvelope = {
      activityId: this.eventJoinActivityId(input.eventId, input.actorId),
      emittedAt: new Date().toISOString(),
      recipientIds: [...recipientIds],
    };
    await this.redis.publish(PULSE_ACTIVITY_REMOVE_CHANNEL, JSON.stringify(envelope));
  }

  private eventJoinActivityId(eventId: string, actorId: string): string {
    return `event_join:${eventId}:${actorId}`;
  }

  private eventJoinPublishedKey(eventId: string, actorId: string): string {
    return `pulse:activity:published:event_join:${eventId}:${actorId}`;
  }

  private eventJoinRemovedKey(eventId: string, actorId: string): string {
    return `pulse:activity:removed:event_join:${eventId}:${actorId}`;
  }

  private async claimOnce(key: string): Promise<boolean> {
    const claimed = await this.redis.set(
      key,
      '1',
      'EX',
      PUBLISHED_DEDUPE_TTL_SECONDS,
      'NX',
    );
    return claimed === 'OK';
  }

  private async actorName(actorId: string): Promise<string | null> {
    const [actor] = await this.db.query<Array<{ display_name: string }>>(
      `SELECT display_name
         FROM users
        WHERE id = $1
          AND deleted_at IS NULL`,
      [actorId],
    );
    return actor?.display_name ?? null;
  }

  private async checkInRecipients(
    actorId: string,
    audience: CheckInAudience,
    locationH3R7: string,
  ): Promise<PulseActivityRecipient[]> {
    const cells = h3.gridDisk(locationH3R7, PULSE_CELL_RADIUS);
    const rows = await this.db.query<RecipientLocationRow[]>(
      `SELECT u.id, u.location_h3_r7
         FROM users u
        WHERE u.deleted_at IS NULL
          AND u.location_h3_r7 = ANY($3::text[])
          AND NOT EXISTS (
            SELECT 1
              FROM user_blocks b
             WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
                OR (b.blocker_id = u.id AND b.blocked_id = $1)
          )
          AND (
            u.id = $1
            OR $2 = 'nearby'
            OR EXISTS (
              SELECT 1
                FROM friendships f
               WHERE (f.user_low_id = $1 AND f.user_high_id = u.id)
                  OR (f.user_low_id = u.id AND f.user_high_id = $1)
            )
          )
        LIMIT $4`,
      [actorId, audience, cells, MAX_RECIPIENTS],
    );
    return this.toRecipients(rows, locationH3R7);
  }

  private async eventJoinRecipients(
    actorId: string,
    eventHostId: string,
    locationH3R7: string,
  ): Promise<PulseActivityRecipient[]> {
    const cells = h3.gridDisk(locationH3R7, PULSE_CELL_RADIUS);
    const rows = await this.db.query<RecipientLocationRow[]>(
      `SELECT u.id, u.location_h3_r7
         FROM users u
        WHERE u.deleted_at IS NULL
          AND u.location_h3_r7 = ANY($3::text[])
          AND NOT EXISTS (
            SELECT 1
              FROM user_blocks b
             WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
                OR (b.blocker_id = u.id AND b.blocked_id = $1)
          )
          AND NOT EXISTS (
            SELECT 1
              FROM user_blocks hb
             WHERE (hb.blocker_id = $2 AND hb.blocked_id = u.id)
                OR (hb.blocker_id = u.id AND hb.blocked_id = $2)
          )
        LIMIT $4`,
      [actorId, eventHostId, cells, MAX_RECIPIENTS],
    );
    return this.toRecipients(rows, locationH3R7);
  }

  private toRecipients(
    rows: RecipientLocationRow[],
    originCell: string,
  ): PulseActivityRecipient[] {
    return rows
      .map((row): PulseActivityRecipient => ({
        userId: row.id,
        distanceM: this.distanceBetweenCellsM(originCell, row.location_h3_r7),
      }))
      .filter((recipient) => recipient.distanceM <= MAX_DISTANCE_M);
  }

  private async publishEnvelope(
    item: ActivityItem,
    recipients: PulseActivityRecipient[],
  ): Promise<void> {
    const envelope: PulseActivityEnvelope = {
      item,
      emittedAt: new Date().toISOString(),
      recipients,
    };
    await this.redis.publish(PULSE_ACTIVITY_CHANNEL, JSON.stringify(envelope));
  }

  private deliverLocal(envelope: PulseActivityEnvelope): void {
    for (const recipient of envelope.recipients) {
      const event: PulseActivityEvent = {
        item: { ...envelope.item, distanceM: recipient.distanceM },
        emittedAt: envelope.emittedAt,
      };
      this.emitter.to(`user:${recipient.userId}`).emit('pulse:activity', event);
    }
  }

  private deliverRemovalLocal(envelope: PulseActivityRemoveEnvelope): void {
    const event: PulseActivityRemoveEvent = {
      activityId: envelope.activityId,
      emittedAt: envelope.emittedAt,
    };
    for (const userId of envelope.recipientIds) {
      this.emitter.to(`user:${userId}`).emit('pulse:activity:remove', event);
    }
  }

  private parseEnvelope(payload: string): PulseActivityEnvelope | null {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (!this.isEnvelope(parsed)) {
        this.logger.warn('ignored invalid pulse activity payload');
        return null;
      }
      return parsed;
    } catch {
      this.logger.warn('ignored malformed pulse activity payload');
      return null;
    }
  }

  private parseRemoveEnvelope(payload: string): PulseActivityRemoveEnvelope | null {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (!this.isRemoveEnvelope(parsed)) {
        this.logger.warn('ignored invalid pulse activity removal payload');
        return null;
      }
      return parsed;
    } catch {
      this.logger.warn('ignored malformed pulse activity removal payload');
      return null;
    }
  }

  private isEnvelope(value: unknown): value is PulseActivityEnvelope {
    if (typeof value !== 'object' || value == null) return false;
    const record = value as Record<string, unknown>;
    if (typeof record.emittedAt !== 'string') return false;
    if (!this.isActivityItem(record.item)) return false;
    if (!Array.isArray(record.recipients)) return false;
    return record.recipients.every((recipient) => this.isRecipient(recipient));
  }

  private isRemoveEnvelope(value: unknown): value is PulseActivityRemoveEnvelope {
    if (typeof value !== 'object' || value == null) return false;
    const record = value as Record<string, unknown>;
    return (
      typeof record.activityId === 'string'
      && typeof record.emittedAt === 'string'
      && Array.isArray(record.recipientIds)
      && record.recipientIds.every((id) => typeof id === 'string')
    );
  }

  private isActivityItem(value: unknown): value is ActivityItem {
    if (typeof value !== 'object' || value == null) return false;
    const record = value as Record<string, unknown>;
    return (
      typeof record.id === 'string'
      && (record.type === 'place' || record.type === 'event')
      && typeof record.title === 'string'
      && typeof record.createdAt === 'string'
      && typeof record.deepLink === 'object'
      && record.deepLink != null
    );
  }

  private isRecipient(value: unknown): value is PulseActivityRecipient {
    if (typeof value !== 'object' || value == null) return false;
    const record = value as Record<string, unknown>;
    return (
      typeof record.userId === 'string'
      && typeof record.distanceM === 'number'
      && Number.isFinite(record.distanceM)
      && record.distanceM >= 0
      && record.distanceM <= MAX_DISTANCE_M
    );
  }

  private distanceBetweenCellsM(leftCell: string, rightCell: string): number {
    const [leftLat, leftLng] = h3.cellToLatLng(leftCell);
    const [rightLat, rightLng] = h3.cellToLatLng(rightCell);
    const toRadians = (value: number): number => value * Math.PI / 180;
    const latDelta = toRadians(rightLat - leftLat);
    const lngDelta = toRadians(rightLng - leftLng);
    const leftLatRad = toRadians(leftLat);
    const rightLatRad = toRadians(rightLat);
    const sinLat = Math.sin(latDelta / 2);
    const sinLng = Math.sin(lngDelta / 2);
    const a = sinLat * sinLat
      + Math.cos(leftLatRad) * Math.cos(rightLatRad) * sinLng * sinLng;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(6_371_000 * c);
  }
}
