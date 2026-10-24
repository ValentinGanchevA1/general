const LEGACY_PUBLIC_BRAND = /\bG88\b/g;

/**
 * HTTP error messages are surfaced directly by the mobile ApiError/Redux path.
 * Keep technical codes/details intact, but never leak the legacy product name
 * through user-facing message copy.
 */
export function normalizePublicErrorMessage(message: string): string {
  return message.replace(LEGACY_PUBLIC_BRAND, 'NEXA');
}
