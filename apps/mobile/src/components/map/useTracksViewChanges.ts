import { useEffect, useState } from 'react';

import { markerTrackingWindowMs } from './nexaMarkerMotion';

export function useTracksViewChanges(
  deps: React.DependencyList,
  selected = false,
): boolean {
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    // Re-enable tracksViewChanges after dep change (next microtask → not sync in effect).
    // Promise.resolve().then — queueMicrotask is not in RN tsconfig lib (TS2304 on CI).
    void Promise.resolve().then(() => setTracks(true));

    const t = setTimeout(() => setTracks(false), markerTrackingWindowMs(selected));
    return () => clearTimeout(t);
    // `selected` is represented by the marker render key at both runtime call sites.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return tracks;
}
