import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { S3Service } from '../../common/s3.service';

/**
 * Lightweight in-process sweeper for expired stories.
 * Runs every 15 min. For multi-instance prod, prefer Bull or pg_cron.
 */
@Injectable()
export class StoriesCleanupService implements OnModuleInit {
  private readonly logger = new Logger(StoriesCleanupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly s3: S3Service,
  ) {}

  onModuleInit(): void {
    const delay = 30_000 + Math.floor(Math.random() * 30_000);
    setTimeout(() => {
      void this.sweep();
      this.timer = setInterval(() => void this.sweep(), 15 * 60_000);
    }, delay);
  }

  async sweep(): Promise<void> {
    try {
      const expired = (await this.db.query(
        `UPDATE stories
            SET deleted_at = NOW()
          WHERE deleted_at IS NULL
            AND expires_at < NOW()
          RETURNING id, media_url`,
      )) as Array<{ id: string; media_url: string }>;

      if (expired.length === 0) return;

      const keys = expired
        .map((r) => this.keyFromPublicUrl(r.media_url))
        .filter((k): k is string => Boolean(k));

      if (keys.length > 0) {
        await this.s3.deleteObjectsByKeys(keys);
      }

      this.logger.log(`Swept ${expired.length} expired stories (${keys.length} S3 keys).`);
    } catch (err) {
      this.logger.warn(`Stories cleanup failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  private keyFromPublicUrl(url: string): string | null {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/^\//, '');
      if (path.startsWith('stories/')) return path;
      return null;
    } catch {
      return null;
    }
  }
}
