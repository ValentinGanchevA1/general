import {
  broadcastSessionChanged,
  onRemoteSessionChanged,
  withCrossTabAuthLock,
} from '../src/session-coordination';

interface RotationResult {
  status: number;
  version: number | null;
}

interface LockNavigator extends Navigator {
  locks?: { request: unknown };
}

interface NexaE2EApi {
  readonly lockSupported: boolean;
  readonly tabId: string;
  signalCount: number;
  seed(): Promise<void>;
  rotateLocked(): Promise<RotationResult>;
  rotateUnlocked(): Promise<RotationResult>;
  broadcast(): void;
}

declare global {
  interface Window {
    nexaE2E: NexaE2EApi;
  }
}

const tabId = crypto.randomUUID();

async function rotate(): Promise<RotationResult> {
  const response = await fetch('/rotate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-nexa-e2e-tab': tabId },
  });
  const payload = await response.json() as { version?: unknown };
  return {
    status: response.status,
    version: typeof payload.version === 'number' ? payload.version : null,
  };
}

const api: NexaE2EApi = {
  lockSupported: typeof (navigator as LockNavigator).locks?.request === 'function',
  tabId,
  signalCount: 0,
  async seed(): Promise<void> {
    const response = await fetch('/seed', { method: 'POST', credentials: 'include' });
    if (!response.ok) throw new Error(`seed failed: ${response.status}`);
  },
  rotateLocked(): Promise<RotationResult> {
    return withCrossTabAuthLock(rotate);
  },
  rotateUnlocked(): Promise<RotationResult> {
    return rotate();
  },
  broadcast(): void {
    broadcastSessionChanged();
  },
};

onRemoteSessionChanged(() => {
  api.signalCount += 1;
});

window.nexaE2E = api;
