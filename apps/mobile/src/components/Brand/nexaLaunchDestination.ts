export interface NexaLaunchDestinationState {
  authenticated: boolean;
  profileSetupComplete: boolean;
}

/**
 * The spatial expansion represents NEXA opening into the map-first Main surface.
 * Auth and profile-creation destinations intentionally end with the normal
 * splash dissolve instead of painting discovery/map motion over those screens.
 */
export function shouldRunNexaSpatialHandoff({
  authenticated,
  profileSetupComplete,
}: NexaLaunchDestinationState): boolean {
  return authenticated && profileSetupComplete;
}
