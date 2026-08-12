import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { LocationShareService } from '../modules/chat/location-share.service';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Periodically closes expired / stale live-location sessions and fans out
 * `location:share:ended` on the conversation room.
 *
 * In-process interval (no @nestjs/schedule) — same pattern as other live
 * work that must touch Socket.IO. Interval is short enough for UX countdown
 * accuracy (~30s) without hammering Postgres.
 */
@Injectable()
export class LocationShareSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LocationShareSweepService.name);
  private static readonly INTERVAL_MS = 30_000;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly locationShare: LocationShareService,
    private readonly gateway: RealtimeGateway,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, LocationShareSweepService.INTERVAL_MS);
    // Unref so the timer alone does not keep the process alive during tests/shutdown.
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
    this.logger.log(`Location share sweep started (every ${LocationShareSweepService.INTERVAL_MS}ms)`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const closed = await this.locationShare.sweepExpired();
      for (const s of closed) {
        this.gateway.emitLocationShareEnded(s.conversationId, s.id, s.reason, s.endedAt);
      }
    } catch (err) {
      this.logger.error(`location share sweep failed: ${err}`);
    } finally {
      this.running = false;
    }
  }
}
