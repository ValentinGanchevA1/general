/**
 * SDK-agnostic Sentry PII/secret scrubber (OB1).
 *
 * Hard privacy invariant: coordinates, H3 cells, tokens, and secrets must never
 * leave the process. This runs in `beforeSend` / `beforeBreadcrumb` on BOTH apps
 * (`@sentry/nestjs` + `@sentry/react-native`) so the redaction logic lives in one
 * place. Fail-safe: over-redaction is acceptable, under-redaction is not.
 *
 * Defence in depth — this is the LAST line, not the only one:
 *   - `sendDefaultPii: false` keeps the SDK from auto-attaching IPs/headers/cookies.
 *   - Sentry project "Data Scrubbing" + "Advanced Data Scrubbing" (dashboard, not
 *     code) strip server-side as well. Configure those too; do not rely on one layer.
 *
 * Two redaction passes:
 *   1. Key-based — any object key whose normalised form matches the denylist has
 *      its whole value replaced, regardless of the value's shape.
 *   2. Value-based — every surviving string is run through token/secret regexes
 *      (Bearer/Basic, JWTs, Stripe/AWS/Google keys, URL credentials, `?token=`…).
 */

// Keys are normalised to lowercase alphanumerics ("X-Api-Key" -> "xapikey",
// "access_token" -> "accesstoken") before matching, so separator variants collapse.
function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Exact-match (post-normalisation) denylist for SHORT/ambiguous keys, where a
// substring rule would over-match unrelated fields ("lat" in "translate", etc.).
const DENY_KEY_EXACT = new Set<string>([
  'lat', 'lng', 'lon', 'geo', 'sid', 'pin', 'otp', 'ssn',
  'cvv', 'cvc', 'iv', 'salt', 'pwd', 'pw', 'dsn',
]);

// Substring (post-normalisation) denylist for unambiguous secret/PII fragments.
// Order doesn't matter; first hit redacts. Each fragment is already separator-free.
const DENY_KEY_SUBSTRINGS: readonly string[] = [
  'password', 'passwd', 'secret', 'token', 'apikey', 'authorization',
  'cookie', 'credential', 'privatekey', 'clientsecret', 'session',
  'signature', 'bearer', 'jwt', 'csrf', 'xsrf', 'connectionstring',
  'databaseurl', 'accesskey', 'secretkey',
  // PII / privacy-invariant location fields
  'latitude', 'longitude', 'location', 'coordinate', 'geohash',
  'phone', 'email', 'iddocument', 'idphoto', 'selfie',
];

function isDeniedKey(key: string): boolean {
  const k = normaliseKey(key);
  if (DENY_KEY_EXACT.has(k)) return true;
  for (const frag of DENY_KEY_SUBSTRINGS) {
    if (k.includes(frag)) return true;
  }
  return false;
}

const REDACTED = '[redacted]';

// Value-level redactors, applied in order to every (non-key-denied) string.
// Each entry is [pattern, replacement]. Patterns must be global (`g`).
const VALUE_REDACTORS: ReadonlyArray<readonly [RegExp, string]> = [
  // Authorization header schemes — token chars cover base64url, JWT, opaque.
  [/\bBearer\s+[\w.\-+/=]+/gi, 'Bearer [redacted]'],
  [/\bBasic\s+[A-Za-z0-9+/=]+/gi, 'Basic [redacted]'],
  // Standalone JWTs (header.payload.signature, base64url).
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted-jwt]'],
  // Stripe secret/publishable/restricted keys + webhook signing secrets.
  [/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/g, '[redacted-stripe-key]'],
  [/\bwhsec_[A-Za-z0-9]{8,}/g, '[redacted-stripe-key]'],
  // Google OAuth access tokens.
  [/\bya29\.[\w.\-]+/g, '[redacted-google-token]'],
  // AWS access key IDs.
  [/\bAKIA[0-9A-Z]{16}\b/g, '[redacted-aws-key]'],
  // Credentials embedded in connection URLs: scheme://user:pass@host -> scheme://[redacted]@host
  [/\b([a-z][a-z0-9+.\-]*:\/\/)[^/\s:@]+:[^/\s:@]+@/gi, '$1[redacted]@'],
  // Sensitive query-string / form params: ?token=… &api_key=… password=…
  [
    /([?&;]|\b)(access_?token|refresh_?token|id_?token|token|api[_-]?key|apikey|client_?secret|secret|password|passwd|pwd|signature|sig|code)=[^&\s#"']+/gi,
    '$1$2=[redacted]',
  ],
];

function scrubString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of VALUE_REDACTORS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

const MAX_DEPTH = 8;

/**
 * Recursively scrub an arbitrary Sentry payload (event, breadcrumb, or any nested
 * value). Generic over `T` so it slots into either SDK's `beforeSend` signature.
 * Returns the same shape with denied keys and secret-bearing strings redacted.
 */
export function scrubSentryPayload<T>(value: T, depth = 0): T {
  if (value == null || depth > MAX_DEPTH) return value;

  if (typeof value === 'string') {
    return scrubString(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((v) => scrubSentryPayload(v, depth + 1)) as unknown as T;
  }

  if (typeof value === 'object') {
    // Only descend into plain objects. Class instances (Errors, Dates, etc.) are
    // returned untouched to avoid mangling them or chasing circular references.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isDeniedKey(k) ? REDACTED : scrubSentryPayload(v, depth + 1);
    }
    return out as unknown as T;
  }

  return value;
}

// Exposed for unit tests / advanced use; the recursive entry point is preferred.
export const __scrubInternals = { isDeniedKey, scrubString, normaliseKey };