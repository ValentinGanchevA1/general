export type PlaceDeepLinkScheme = 'nexa' | 'nexa-qa';

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

/** Create a strict place-link codec for one app installation scheme. */
export function createPlaceDeepLinkCodec(scheme: PlaceDeepLinkScheme) {
  const pattern = new RegExp(
    '^' + scheme +
      '://place/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#].*)?$',
    'i',
  );

  return {
    build(placeId: string): string {
      if (!isNexaPlaceId(placeId)) {
        throw new Error('Cannot build a NEXA place link from an invalid place ID.');
      }
      return `${scheme}://place/${placeId.toLowerCase()}`;
    },

    parse(url: string): string | null {
      const match = pattern.exec(url.trim());
      return match?.[1]?.toLowerCase() ?? null;
    },
  };
}

// Babel inlines this build flag into the JS bundle. Production retains nexa://;
// the isolated QA APK uses nexa-qa:// so its deep links cannot claim Production links.
const activePlaceDeepLinkCodec = createPlaceDeepLinkCodec(
  process.env.NEXUS_WORLDS_QA === '1' ? 'nexa-qa' : 'nexa',
);

export function buildPlaceDeepLink(placeId: string): string {
  return activePlaceDeepLinkCodec.build(placeId);
}

export function parsePlaceDeepLink(url: string): string | null {
  return activePlaceDeepLinkCodec.parse(url);
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
