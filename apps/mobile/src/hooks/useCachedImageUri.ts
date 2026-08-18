import { useEffect, useState } from 'react';

import { resolveAvatarUri } from '@/services/avatarCache';

/**
 * Resolves remote image URLs through the offline avatar disk cache.
 * While resolving, returns the remote URI so online paint is not blocked.
 */
export function useCachedImageUri(
  uri: string | null | undefined,
): string | null {
  const [resolved, setResolved] = useState<string | null>(uri ?? null);

  useEffect(() => {
    let cancelled = false;
    if (!uri) {
      setResolved(null);
      return;
    }
    setResolved(uri);
    void resolveAvatarUri(uri).then((local) => {
      if (!cancelled && local) setResolved(local);
    });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return resolved;
}
