export type ConversationRefreshFailureClass =
  | 'network'
  | 'refresh_unavailable'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'server'
  | 'unknown';

export interface ConversationRefreshFailure {
  failureClass: ConversationRefreshFailureClass;
  statusCode: number | null;
}

function readApiErrorShape(error: unknown): { statusCode: number | null; code: string | null } {
  if (typeof error !== 'object' || error === null) {
    return { statusCode: null, code: null };
  }

  const candidate = error as { statusCode?: unknown; code?: unknown };
  return {
    statusCode: typeof candidate.statusCode === 'number' ? candidate.statusCode : null,
    code: typeof candidate.code === 'string' ? candidate.code : null,
  };
}

/**
 * Collapse transport/auth/backend failures into a fixed, privacy-safe diagnostic set.
 * No URL, token, user/conversation id, response body, or free-text message is retained.
 */
export function classifyConversationRefreshFailure(error: unknown): ConversationRefreshFailure {
  const { statusCode, code } = readApiErrorShape(error);

  if (code === 'refresh_unavailable') {
    return { failureClass: 'refresh_unavailable', statusCode };
  }
  if (statusCode === 0 || code === 'network') {
    return { failureClass: 'network', statusCode };
  }
  if (statusCode === 401) {
    return { failureClass: 'unauthorized', statusCode };
  }
  if (statusCode === 403) {
    return { failureClass: 'forbidden', statusCode };
  }
  if (statusCode === 429) {
    return { failureClass: 'rate_limited', statusCode };
  }
  if (statusCode !== null && statusCode >= 500) {
    return { failureClass: 'server', statusCode };
  }

  return { failureClass: 'unknown', statusCode };
}
