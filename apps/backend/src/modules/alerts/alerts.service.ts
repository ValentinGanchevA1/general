import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { AlertResponse } from '@g88/shared';

import { CreateAlertDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly notifications: NotificationsService,
    private readonly gamification: GamificationService,
  ) {}

  async create(authorId: string, dto: CreateAlertDto): Promise<AlertResponse> {
    // Copy the author's last-known fuzzed location into the alert at write time.
    // If the user has never sent a heartbeat, location columns will be NULL and
    // the alert will still persist (it just won't surface in location-scoped feeds).
    const rows = await this.db.query<Array<{
      id: string; created_at: Date; location_h3_r7: string | null;
    }>>(
      `INSERT INTO alerts (author_id, category, body, tag, location, location_h3_r7, location_h3_r8)
       SELECT $1, $2, $3, $4, u.location, u.location_h3_r7, u.location_h3_r8
         FROM users u
        WHERE u.id = $1
          AND u.deleted_at IS NULL
       RETURNING id, created_at, location_h3_r7`,
      [authorId, dto.category, dto.body, dto.tag ?? null],
    );

    if (rows.length === 0) throw new NotFoundException('User not found');

    const row = rows[0]!;

    // Fan out a push to anyone watching this area via a geofence. Fire-and-forget
    // so a slow/failed FCM call never blocks the alert write.
    void this.notifications
      .notifyGeofenceMatch(row.location_h3_r7, authorId, dto.category, dto.body)
      .catch((err) => this.logger.error(`notifyGeofenceMatch failed: ${err}`));

    // Reward the author for contributing to the local feed (capped per day).
    void this.gamification
      .award(authorId, 'alert.posted', { dedupeKey: `alert:${row.id}` })
      .catch((err) => this.logger.error(`award alert.posted failed: ${err}`));

    return {
      id: row.id,
      category: dto.category,
      body: dto.body,
      tag: dto.tag ?? null,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
