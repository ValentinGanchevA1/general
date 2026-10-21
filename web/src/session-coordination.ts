const AUTH_MUTATION_LOCK_NAME = 'nexa.web.auth.mutation';
const SESSION_CHANNEL_NAME = 'nexa.web.auth.session';
const REMOTE_RELOAD_MARKER = 'nexa.web.auth.remote-reload';
const sourceId = crypto.randomUUID();

interface SessionChangedSignal {
  type: 'session-changed';
  sourceId: string;
}

type SessionSignal = SessionChangedSignal;

interface LockManagerLike {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<T>,
  ): Promise<T>;
}

type NavigatorWithLocks = Navigator & { locks?: LockManagerLike };

const channel = typeof BroadcastChannel === 'function'
  ? new BroadcastChannel(SESSION_CHANNEL_NAME)
  : null;

let suppressNextBroadcast = sessionStorage.getItem(REMOTE_RELOAD_MARKER) === '1';
sessionStorage.removeItem(REMOTE_RELOAD_MARKER);
if (suppressNextBroadcast) {
  window.setTimeout(() => {
    suppressNextBroadcast = false;
  }, 5_000);
}

export async function withCrossTabAuthLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = (navigator as NavigatorWithLocks).locks;
  if (locks) {
    return locks.request(AUTH_MUTATION_LOCK_NAME, { mode: 'exclusive' }, task);
  }

  // Legacy/insecure-context fallback. Public deployment requires HTTPS and
  // current browsers with Web Locks; this path preserves preview usability.
  // No credential is ever written to Web Storage; the only sessionStorage
  // value used by this module is a short-lived reload-loop marker.
  return task();
}

export function broadcastSessionChanged(): void {
  if (suppressNextBroadcast) {
    suppressNextBroadcast = false;
    return;
  }

  const signal: SessionChangedSignal = { type: 'session-changed', sourceId };
  channel?.postMessage(signal);
}

export function onRemoteSessionChanged(handler: () => void): () => void {
  if (!channel) return () => undefined;

  const listener = (event: MessageEvent<unknown>): void => {
    if (!isSessionSignal(event.data)) return;
    if (event.data.sourceId === sourceId) return;
    sessionStorage.setItem(REMOTE_RELOAD_MARKER, '1');
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
