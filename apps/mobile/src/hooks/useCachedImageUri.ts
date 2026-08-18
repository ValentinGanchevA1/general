import { useEffect, useState } from 'react';

import { resolveAvatarUri } from '@/services/avatarCache';

/**
 * Resolves remote image URLs through the offline avatar disk cache.
 * While resolving, returns the remote URI so online paint is not blocked.
 */
export function useCachedImageUri(
  uri: string | null | undefined,
): string | null {
  const remote = uri ?? null;
  const [resolved, setResolved] = useState<string | null>(remote);
  const [trackedUri, setTrackedUri] = useState<string | null>(remote);

  // Adjust state when the uri prop changes — during render, not in an effect
  // (avoids react-hooks/set-state-in-effect and keeps CI --max-warnings 0).
  if (remote !== trackedUri) {
    setTrackedUri(remote);
    setResolved(remote);
  }

  useEffect(() => {
    if (!remote) return;
    let cancelled = false;
    resolveAvatarUri(remote).then((local) => {
      if (!cancelled && local) setResolved(local);
    });
    return () => {
      cancelled = true;
    };
  }, [remote]);

  return resolved;
}
