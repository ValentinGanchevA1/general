import React, { createContext, useContext } from 'react';

const noop = (): void => undefined;

const NexaLaunchMapSurfaceReadyContext = createContext<() => void>(noop);
const NexaLaunchInteractionsReadyContext = createContext(true);

interface NexaLaunchSurfaceProviderProps {
  children: React.ReactNode;
  onMapSurfaceReady: () => void;
  interactionsReady: boolean;
}

/**
 * One-launch bridge between the already-mounted application and the root launch
 * choreography. Map readiness prevents the overlay from exposing a cold native
 * map. Interaction readiness prevents native prompts from interrupting the
 * launch dissolve / spatial handoff. Neither belongs in Redux/domain state.
 */
export function NexaLaunchSurfaceProvider({
  children,
  onMapSurfaceReady,
  interactionsReady,
}: NexaLaunchSurfaceProviderProps): React.JSX.Element {
  return (
    <NexaLaunchMapSurfaceReadyContext.Provider value={onMapSurfaceReady}>
      <NexaLaunchInteractionsReadyContext.Provider value={interactionsReady}>
        {children}
      </NexaLaunchInteractionsReadyContext.Provider>
    </NexaLaunchMapSurfaceReadyContext.Provider>
  );
}

export function useNexaMapSurfaceReady(): () => void {
  return useContext(NexaLaunchMapSurfaceReadyContext);
}

/**
 * True once the one-shot launch transition is no longer occupying the screen.
 * Defaults to true outside AppShell so isolated screens/tests never deadlock.
 */
export function useNexaLaunchInteractionsReady(): boolean {
  return useContext(NexaLaunchInteractionsReadyContext);
}
