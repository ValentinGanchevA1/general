import React, { createContext, useContext } from 'react';

const noop = (): void => undefined;

const NexaLaunchMapSurfaceReadyContext = createContext<() => void>(noop);

interface NexaLaunchSurfaceProviderProps {
  children: React.ReactNode;
  onMapSurfaceReady: () => void;
}

/**
 * One-launch visual readiness bridge between the already-mounted Map screen and
 * the root launch overlay. This is deliberately not Redux/domain state: it
 * exists only to prevent the launch dissolve from exposing a cold native map.
 */
export function NexaLaunchSurfaceProvider({
  children,
  onMapSurfaceReady,
}: NexaLaunchSurfaceProviderProps): React.JSX.Element {
  return (
    <NexaLaunchMapSurfaceReadyContext.Provider value={onMapSurfaceReady}>
      {children}
    </NexaLaunchMapSurfaceReadyContext.Provider>
  );
}

export function useNexaMapSurfaceReady(): () => void {
  return useContext(NexaLaunchMapSurfaceReadyContext);
}
