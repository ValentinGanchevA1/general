const PLACE_DEEP_LINK_PATTERN = /^nexa:\/\/place\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#].*)?$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Listener = () => void;

let pendingPlaceId: string | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function isNexaPlaceId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function buildPlaceDeepLink(placeId: string): string {
  if (!isNexaPlaceId(placeId)) {
    throw new Error('Cannot build a NEXA place link from an invalid place ID.');
  }
  return `nexa://place/${placeId.toLowerCase()}`;
}

export function parsePlaceDeepLink(url: string): string | null {
  const match = PLACE_DEEP_LINK_PATTERN.exec(url.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * One-deep explicit navigation queue. The latest valid place link wins while
 * auth/navigation are unavailable. Only the canonical-looking UUID is retained.
 */
export const placeDeepLinkQueue = {
  getSnapshot(): string | null {
    return pendingPlaceId;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  enqueueUrl(url: string): boolean {
    const placeId = parsePlaceDeepLink(url);
    if (placeId == null) return false;
    pendingPlaceId = placeId;
    emit();
    return true;
  },

  clear(expectedPlaceId?: string): void {
    if (expectedPlaceId !== undefined && pendingPlaceId !== expectedPlaceId) return;
    if (pendingPlaceId == null) return;
    pendingPlaceId = null;
    emit();
  },
};
