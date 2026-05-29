import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { AlertResponse } from '@g88/shared';

import { CreateAlertDto } from './dto';

@Injectable()
export class AlertsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async create(authorId: string, dto: CreateAlertDto): Promise<AlertResponse> {
    // Copy the author's last-known fuzzed location into the alert at write time.
    // If the user has never sent a heartbeat, location columns will be NULL and
    // the alert will still persist (it just won't surface in location-scoped feeds).
    const rows = await this.db.query<Array<{ id: string; created_at: Date }>>(
      `INSERT INTO alerts (author_id, category, body, tag, location, location_h3_r7, location_h3_r8)
       SELECT $1, $2, $3, $4, u.location, u.location_h3_r7, u.location_h3_r8
         FROM users u
        WHERE u.id = $1
          AND u.deleted_at IS NULL
       RETURNING id, created_at`,
      [authorId, dto.category, dto.body, dto.tag ?? null],
    );

    if (rows.length === 0) throw new NotFoundException('User not found');

    const row = rows[0]!;
    return {
      id: row.id,
      category: dto.category,
      body: dto.body,
      tag: dto.tag ?? null,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
