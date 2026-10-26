export function validateProductionLegalUrls({ track, privacyUrl, termsUrl }) {
  const normalizedTrack = String(track ?? '').trim().toLowerCase();

  if (normalizedTrack !== 'production') {
    return { required: false };
  }

  const urls = [
    ['PRIVACY_POLICY_URL', privacyUrl],
    ['TERMS_OF_SERVICE_URL', termsUrl],
  ];

  for (const [label, value] of urls) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`[legal-gate] ${label} must be a valid URL for a production release.`);
    }

    if (parsed.protocol !== 'https:') {
      throw new Error(`[legal-gate] ${label} must use HTTPS for a production release.`);
    }
  }

  if (privacyUrl === termsUrl) {
    throw new Error(
      '[legal-gate] Production blocked: Terms of Service still resolves to the Privacy Policy. Resolve issue #592 and publish a dedicated Terms document first.',
    );
  }

  return { required: true };
}
