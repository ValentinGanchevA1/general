const REFRESH_LOCK_NAME = 'nexa.web.auth.refresh';
const SESSION_CHANNEL_NAME = 'nexa.web.auth.session';
const sourceId = crypto.randomUUID();

interface SessionEndedSignal {
  type: 'session-ended';
  sourceId: string;
}

type SessionSignal = SessionEndedSignal;

const channel = typeof BroadcastChannel === 'function'
  ? new BroadcastChannel(SESSION_CHANNEL_NAME)
  : null;

export async function withCrossTabRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if ('locks' in navigator && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK_NAME, { mode: 'exclusive' }, task);
  }

  // Legacy/insecure-context fallback. Public deployment requires HTTPS and
  // current browsers with Web Locks; this path preserves preview usability
  // without persisting credentials or lock metadata in Web Storage.
  return task();
}

export function broadcastSessionEnded(): void {
  const signal: SessionEndedSignal = { type: 'session-ended', sourceId };
  channel?.postMessage(signal);
}

export function onRemoteSessionEnded(handler: () => void): () => void {
  if (!channel) return () => undefined;

  const listener = (event: MessageEvent<unknown>): void => {
    if (!isSessionSignal(event.data)) return;
    if (event.data.sourceId === sourceId) return;
    if (event.data.type === 'session-ended') handler();
  };

  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}

function isSessionSignal(value: unknown): value is SessionSignal {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SessionSignal>;
  return candidate.type === 'session-ended' && typeof candidate.sourceId === 'string';
}
