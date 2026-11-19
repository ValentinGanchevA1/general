/**
 * Google OAuth is optional for unsigned CI simulator builds.
 * Never call the native Sign-In configure API with a blank Web Client ID;
 * on iOS, missing native plist/iosClientId can otherwise fail app startup.
 *
 * Availability here covers the JS Web Client ID only. A real iOS build must
 * additionally provide the platform's native OAuth configuration.
 */
export function hasGoogleWebClientId(webClientId: string): boolean {
  return webClientId.trim().length > 0;
}
