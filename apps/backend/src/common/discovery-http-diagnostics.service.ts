import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

export type DiscoveryHttpLane = 'nearby' | 'places';

interface RequestIdentity {
  method: string;
  path: string;
}

interface HttpResponseLifecycle {
  statusCode: number;
  once(event: 'finish' | 'close', listener: () => void): this;
  removeListener(event: 'finish' | 'close', listener: () => void): this;
}

export interface DiscoveryHttpWindow {
  completed: number;
  status2xx: number;
  status429: number;
  status4xxOther: number;
  status5xx: number;
  statusOther: number;
  aborted: number;
  slowOver5s: number;
  inflight: number;
}

export type DiscoveryHttpSnapshot = Record<DiscoveryHttpLane, DiscoveryHttpWindow>;

function emptyWindow(): DiscoveryHttpWindow {
  return {
    completed: 0,
    status2xx: 0,
    status429: 0,
    status4xxOther: 0,
    status5xx: 0,
    statusOther: 0,
    aborted: 0,
    slowOver5s: 0,
    inflight: 0,
  };
}

/** Exact allowlist: never log paths, query parameters or request bodies. */
export function discoveryHttpLane(request: RequestIdentity): DiscoveryHttpLane | null {
  if (request.method !== 'POST') return null;
  if (request.path === '/api/v1/discovery/nearby') return 'nearby';
  if (request.path === '/api/v1/discovery/places') return 'places';
  return null;
}

export function formatDiscoveryHttpWindow(snapshot: DiscoveryHttpSnapshot): string {
  const tokens: string[] = ['discovery_http'];
  for (const lane of ['nearby', 'places'] as const) {
    const stats = snapshot[lane];
    tokens.push(
      `${lane}_completed=${stats.completed}`,
      `${lane}_2xx=${stats.status2xx}`,
      `${lane}_429=${stats.status429}`,
      `${lane}_4xx_other=${stats.status4xxOther}`,
      `${lane}_5xx=${stats.status5xx}`,
      `${lane}_other=${stats.statusOther}`,
      `${lane}_aborted=${stats.aborted}`,
      `${lane}_slow_over_5s=${stats.slowOver5s}`,
      `${lane}_inflight=${stats.inflight}`,
    );
  }
  return tokens.join(' ');
}

/**
 * Aggregated, bounded Discovery HTTP diagnostics.
 *
 * Observe at the Express middleware layer before Nest guards so HTTP 429
 * throttler rejections are included. Never record identifiers, IPs, URLs,
 * user data, viewport coordinates, or request/response payloads.
 */
@Injectable()
export class DiscoveryHttpDiagnosticsService
  implements OnApplicationBootstrap, OnApplicationShutdown {
  private static readonly INTERVAL_MS = 15_000;
  private readonly logger = new Logger(DiscoveryHttpDiagnosticsService.name);
  private readonly windows: DiscoveryHttpSnapshot = {
    nearby: emptyWindow(),
    places: emptyWindow(),
  };
  private timer: ReturnType<typeof setInterval> | null = null;

  observe(request: RequestIdentity, response: HttpResponseLifecycle): void {
    const lane = discoveryHttpLane(request);
    if (lane === null) return;

    const stats = this.windows[lane];
    const startedAt = Date.now();
    stats.inflight += 1;
    let settled = false;

    const cleanup = (): void => {
      response.removeListener('finish', onFinish);
      response.removeListener('close', onClose);
    };
    const settle = (): boolean => {
      if (settled) return false;
      settled = true;
      cleanup();
      stats.inflight = Math.max(0, stats.inflight - 1);
      return true;
    };
    const onFinish = (): void => {
      if (!settle()) return;
      stats.completed += 1;
      if (response.statusCode >= 200 && response.statusCode < 300) {
        stats.status2xx += 1;
      } else if (response.statusCode === 429) {
        stats.status429 += 1;
      } else if (response.statusCode >= 400 && response.statusCode < 500) {
        stats.status4xxOther += 1;
      } else if (response.statusCode >= 500 && response.statusCode < 600) {
        stats.status5xx += 1;
      } else {
        stats.statusOther += 1;
      }
      if (Date.now() - startedAt > 5_000) stats.slowOver5s += 1;
    };
    const onClose = (): void => {
      if (!settle()) return;
      stats.aborted += 1;
    };
    response.once('finish', onFinish);
    response.once('close', onClose);
  }

  snapshotAndReset(): DiscoveryHttpSnapshot {
    const snapshot: DiscoveryHttpSnapshot = {
      nearby: { ...this.windows.nearby },
      places: { ...this.windows.places },
    };
    for (const lane of ['nearby', 'places'] as const) {
      const stats = this.windows[lane];
      const active = stats.inflight;
      Object.assign(stats, emptyWindow());
      stats.inflight = active;
    }
    return snapshot;
  }

  onApplicationBootstrap(): void {
    const explicit = process.env.RUNTIME_DIAGNOSTICS_ENABLED?.trim().toLowerCase();
    if (explicit === 'false' || explicit === '0' || explicit === 'off') return;
    if (explicit !== 'true' && explicit !== '1' && explicit !== 'on'
      && process.env.NODE_ENV !== 'production') return;

    this.timer = setInterval(() => {
      const window = this.snapshotAndReset();
      const hasActivity = (['nearby', 'places'] as const).some((lane) => {
        const stats = window[lane];
        return stats.completed > 0 || stats.aborted > 0 || stats.inflight > 0;
      });
      if (hasActivity) this.logger.log(formatDiscoveryHttpWindow(window));
    }, DiscoveryHttpDiagnosticsService.INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
