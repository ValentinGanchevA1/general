// apps/mobile/src/components/map/useTracksViewChanges.ts
//
// react-native-maps freezes a custom Marker's child view into a bitmap once
// tracksViewChanges=false. If that happens before the child's first paint
// (fonts/text layout — very common on Android), the bitmap is permanently
// blank. Keep it `true` for one paint cycle after mount or after any dep
// that affects the rendered content changes, then drop it back to false
// for perf.

import { useEffect, useState } from 'react';

export function useTracksViewChanges(deps: React.DependencyList): boolean {
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return tracks;
}
