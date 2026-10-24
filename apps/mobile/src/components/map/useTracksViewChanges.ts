import { useEffect, useState } from 'react';

import { NEXA_MARKER_TRACKING_WINDOW_MS } from './nexaMarkerMotion';

export function useTracksViewChanges(deps: React.DependencyList): boolean {
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    // Re-enable tracksViewChanges after dep change (next microtask → not sync in effect).
    // Promise.resolve().then — queueMicrotask is not in RN tsconfig lib (TS2304 on CI).
    void Promise.resolve().then(() => setTracks(true));

    const t = setTimeout(() => setTracks(false), NEXA_MARKER_TRACKING_WINDOW_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return tracks;
}
