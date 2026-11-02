export type DiscoveryFailureLane = 'legacy' | 'places';

export type DiscoveryFailureKind =
  | 'cancelled'
  | 'timeout'
  | 'network'
  | 'http'
  | 'unknown';

export interface DiscoveryFailureDiagnostic {
  lane: DiscoveryFailureLane;
  kind: DiscoveryFailureKind;
  statusCode: number | null;
  retryable: boolean;
}

interface ErrorShape {
  statusCode?: unknown;
  code?: unknown;
  message?: unknown;
}

function asErrorShape(error: unknown): ErrorShape {
  return typeof error === 'object' && error !== null
    ? (error as ErrorShape)
    : {};
}

function readStatusCode(error: unknown): number | null {
  const { statusCode } = asErrorShape(error);
  return typeof statusCode === 'number' && Number.isInteger(statusCode)
    ? statusCode
    : null;
}

function readCode(error: unknown): string {
  const { code } = asErrorShape(error);
  return typeof code === 'string' ? code.trim().toLowerCase() : '';
}

function readMessage(error: unknown): string {
  const { message } = asErrorShape(error);
  if (typeof message === 'string') return message.trim().toLowerCase();
  if (error instanceof Error) return error.message.trim().toLowerCase();
  return typeof error === 'string' ? error.trim().toLowerCase() : '';
}

function isCancellation(code: string, message: string): boolean {
  return (
    code === 'err_canceled' ||
    code === 'err_cancelled' ||
    code === 'canceled' ||
    code === 'cancelled' ||
    message === 'canceled' ||
    message === 'cancelled'
  );
}

function isTimeout(code: string, message: string): boolean {
  return (
    code === 'econnaborted' ||
    code === 'etimedout' ||
    code === 'timeout' ||
    message.includes('timeout') ||
    message.includes('econnaborted') ||
    message.includes('etimedout')
  );
}

function isNetwork(code: string, message: string): boolean {
  return (
    code === 'network' ||
    code === 'refresh_unavailable' ||
    code === 'econnrefused' ||
    message === 'network error' ||
    message === 'network request failed' ||
    message === 'failed to fetch' ||
    message.includes('econnrefused') ||
    message.includes('socket hang up')
  );
}

function isRetryableHttp(statusCode: number): boolean {
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

/**
 * Converts transport/API failures into privacy-safe diagnostic metadata.
 * Raw messages, URLs, coordinates and entity/user identifiers are intentionally
 * excluded so the result can be recorded as a local/Sentry breadcrumb.
 */
export function classifyDiscoveryFailure(
  lane: DiscoveryFailureLane,
  error: unknown,
  aborted = false,
): DiscoveryFailureDiagnostic {
  const statusCode = readStatusCode(error);
  const code = readCode(error);
  const message = readMessage(error);

  if (aborted || isCancellation(code, message)) {
    return { lane, kind: 'cancelled', statusCode: null, retryable: false };
  }

  if (isTimeout(code, message)) {
    return { lane, kind: 'timeout', statusCode, retryable: true };
  }

  if (statusCode !== null && statusCode > 0) {
    return {
      lane,
      kind: 'http',
      statusCode,
      retryable: isRetryableHttp(statusCode),
    };
  }

  if (statusCode === 0 || isNetwork(code, message)) {
    return { lane, kind: 'network', statusCode: 0, retryable: true };
  }

  return { lane, kind: 'unknown', statusCode, retryable: true };
}
