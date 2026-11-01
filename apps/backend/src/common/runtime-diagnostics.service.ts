import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RuntimeHttpDiagnosticsService } from './runtime-http-diagnostics.service';

export interface RuntimeResourceSnapshot {
  rssMiB: number;
  heapUsedMiB: number;
  heapTotalMiB: number;
  externalMiB: number;
  arrayBuffersMiB: number;
  maxRssMiB: number;
  sockets: number;
  httpCompleted: number;
  http2xx: number;
  http3xx: number;
  http4xx: number;
  http5xx: number;
  httpOther: number;
  httpAborted: number;
  httpInflight: number;
  uptimeSec: number;
}

interface SocketCountSource {
  server?: {
    sockets?: {
      sockets?: {
        size?: number;
      };
    };
  };
}

const BYTES_PER_MIB = 1024 * 1024;
const KIB_PER_MIB = 1024;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function bytesToMiB(value: number): number {
  return round(value / BYTES_PER_MIB);
}

export function readConnectedSocketCount(source: SocketCountSource): number {
  const size = source.server?.sockets?.sockets?.size;
  return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : 0;
}

export function formatRuntimeResourceSnapshot(snapshot: RuntimeResourceSnapshot): string {
  return [
    'runtime_resources',
    `rss_mib=${snapshot.rssMiB}`,
    `heap_used_mib=${snapshot.heapUsedMiB}`,
    `heap_total_mib=${snapshot.heapTotalMiB}`,
    `external_mib=${snapshot.externalMiB}`,
    `array_buffers_mib=${snapshot.arrayBuffersMiB}`,
    `max_rss_mib=${snapshot.maxRssMiB}`,
    `sockets=${snapshot.sockets}`,
    `http_completed=${snapshot.httpCompleted}`,
    `http_2xx=${snapshot.http2xx}`,
    `http_3xx=${snapshot.http3xx}`,
    `http_4xx=${snapshot.http4xx}`,
    `http_5xx=${snapshot.http5xx}`,
    `http_other=${snapshot.httpOther}`,
    `http_aborted=${snapshot.httpAborted}`,
    `http_inflight=${snapshot.httpInflight}`,
    `uptime_sec=${snapshot.uptimeSec}`,
  ].join(' ');
}

@Injectable()
export class RuntimeDiagnosticsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private static readonly INTERVAL_MS = 15_000;

  private readonly logger = new Logger(RuntimeDiagnosticsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly realtime: RealtimeGateway,
    private readonly http: RuntimeHttpDiagnosticsService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.isEnabled()) return;

    this.logSnapshot();
    this.timer = setInterval(() => this.logSnapshot(), RuntimeDiagnosticsService.INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private isEnabled(): boolean {
    const explicit = process.env.RUNTIME_DIAGNOSTICS_ENABLED?.trim().toLowerCase();
    if (explicit === 'false' || explicit === '0' || explicit === 'off') return false;
    if (explicit === 'true' || explicit === '1' || explicit === 'on') return true;
    return process.env.NODE_ENV === 'production';
  }

  private logSnapshot(): void {
    const memory = process.memoryUsage();
    const usage = process.resourceUsage();
    const sockets = readConnectedSocketCount(this.realtime);
    const http = this.http.snapshotAndReset();

    const snapshot: RuntimeResourceSnapshot = {
      rssMiB: bytesToMiB(memory.rss),
      heapUsedMiB: bytesToMiB(memory.heapUsed),
      heapTotalMiB: bytesToMiB(memory.heapTotal),
      externalMiB: bytesToMiB(memory.external),
      arrayBuffersMiB: bytesToMiB(memory.arrayBuffers),
      maxRssMiB: round(usage.maxRSS / KIB_PER_MIB),
      sockets,
      httpCompleted: http.completed,
      http2xx: http.status2xx,
      http3xx: http.status3xx,
      http4xx: http.status4xx,
      http5xx: http.status5xx,
      httpOther: http.statusOther,
      httpAborted: http.aborted,
      httpInflight: http.inflight,
      uptimeSec: Math.round(process.uptime()),
    };

    this.logger.log(formatRuntimeResourceSnapshot(snapshot));
  }
}
