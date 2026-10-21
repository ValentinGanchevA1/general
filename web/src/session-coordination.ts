const AUTH_MUTATION_LOCK_NAME = 'nexa.web.auth.mutation';
const SESSION_CHANNEL_NAME = 'nexa.web.auth.session';
const sourceId = crypto.randomUUID();

interface SessionChangedSignal {
  type: 'session-changed';
  sourceId: string;
}

type SessionSignal = SessionChangedSignal;

const channel = typeof BroadcastChannel === 'function'
  ? new BroadcastChannel(SESSION_CHANNEL_NAME)
  : null;

export async function withCrossTabAuthLock<T>(task: () => Promise<T>): Promise<T> {
  if ('locks' in navigator && navigator.locks) {
    return navigator.locks.request(AUTH_MUTATION_LOCK_NAME, { mode: 'exclusive' }, task);
  }

  // Legacy/insecure-context fallback. Public deployment requires HTTPS and
  // current browsers with Web Locks; this path preserves preview usability
  // without persisting credentials or lock metadata in Web Storage.
  return task();
}

export function broadcastSessionChanged(): void {
  const signal: SessionChangedSignal = { type: 'session-changed', sourceId };
  channel?.postMessage(signal);
}

export function onRemoteSessionChanged(handler: () => void): () => void {
  if (!channel) return () => undefined;

  const listener = (event: MessageEvent<unknown>): void => {
    if (!isSessionSignal(event.data)) return;
    if (event.data.sourceId === sourceId) return;
    handler();
  };

  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}

function isSessionSignal(value: unknown): value is SessionSignal {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SessionSignal>;
  return candidate.type === 'session-changed' && typeof candidate.sourceId === 'string';
}
