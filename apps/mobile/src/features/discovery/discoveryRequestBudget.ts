/**
 * A local, lane-scoped budget for settled Map viewport requests.
 *
 * The discovery endpoints are limited to 30 requests per minute per client
 * tracker. Reserve headroom for retries, other client instances and clock
 * differences. This is a UX/backpressure safeguard, not a substitute for the
 * backend throttler or a guarantee against shared-IP 429 responses.
 *
 * Only count requests that are about to be sent. Aborted in-flight requests
 * still consume budget because they may have reached the server.
 */
export const DISCOVERY_REQUEST_BUDGET_LIMIT = 24;
export const DISCOVERY_REQUEST_BUDGET_WINDOW_MS = 60_000;

export class DiscoveryRequestBudget {
  private readonly starts: number[] = [];

  /**
   * Returns 0 and records an attempt when an outgoing request may proceed.
   * Otherwise returns the minimum delay (ms) before another attempt.
   *
   * Sliding-window accounting deliberately treats all HTTP attempts,
   * including aborted requests, as consumed server capacity.
   */
  tryAcquire(nowMs: number): number {
    const expiredBeforeOrAt = nowMs - DISCOVERY_REQUEST_BUDGET_WINDOW_MS;
    while (this.starts.length > 0 && this.starts[0]! <= expiredBeforeOrAt) {
      this.starts.shift();
    }

    if (this.starts.length >= DISCOVERY_REQUEST_BUDGET_LIMIT) {
      return Math.max(1, this.starts[0]! + DISCOVERY_REQUEST_BUDGET_WINDOW_MS - nowMs + 1);
    }

    this.starts.push(nowMs);
    return 0;
  }
}
