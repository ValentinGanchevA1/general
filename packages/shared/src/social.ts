import type { SocialProvider } from './api';

/** Provider availability is derived server-side from configured OAuth credentials. */
export interface SocialProviderAvailability {
  provider: SocialProvider;
  available: boolean;
}

export interface SocialProvidersResponse {
  providers: SocialProviderAvailability[];
}
