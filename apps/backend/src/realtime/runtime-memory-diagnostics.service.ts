import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { RealtimeGateway } from './realtime.gateway';

/**
 * Low-cardinality process samples for diagnosing short-lived Render OOM spikes.
 * Samples contain aggregate runtime counters only; never user or location data.
 */
@Injectable()
export class RuntimeMemoryDiagnosticsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RuntimeMemoryDiagnosticsService.name);
  private static readonly SAMPLE_INTERVAL_MS = 30_000;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly gateway: RealtimeGateway) {}

  onModuleInit(): void {
    this.sample();
    this.timer = setInterval(
      () => this.sample(),
      RuntimeMemoryDiagnosticsService.SAMPLE_INTERVAL_MS,
    );
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private sample(): void {
    const memory = process.memoryUsage();
    this.logger.log(JSON.stringify({
      event: 'runtime_memory_sample',
      rssBytes: memory.rss,
      heapTotalBytes: memory.heapTotal,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers,
      uptimeSeconds: Math.floor(process.uptime()),
      connectedSocketCount: this.gateway.getConnectedSocketCount(),
    }));
  }
}
