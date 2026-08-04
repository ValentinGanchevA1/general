import type { SocialProvider } from '@g88/shared';

/**
 * Per-provider OAuth2 config for account *linking* (not sign-in). A provider is
 * "active" only when both its client id and secret env vars are set — otherwise
 * the start endpoint 503s.
 *
 * All providers use Authorization Code + PKCE (S256). The code_verifier is
 * stored in Redis for the lifetime of the signed state (see SocialService).
 */
export interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Some providers (Instagram/Facebook) take the token as a query param, not a Bearer header. */
  tokenInQuery?: boolean;
  /** Extra static params appended to the authorize URL (beyond PKCE). */
  extraAuthParams?: Record<string, string>;
  /** TikTok uses client_key instead of client_id on some endpoints. */
  clientIdParam?: 'client_id' | 'client_key';
  /** Pull a stable id + handle out of the provider's userinfo payload. */
  parseUser: (json: Record<string, unknown>) => { id: string; username: string | null };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

export const PROVIDERS: Record<SocialProvider, ProviderConfig> = {
  instagram: {
    authorizeUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    userInfoUrl: 'https://graph.instagram.com/me?fields=id,username',
    scope: 'user_profile',
    clientIdEnv: 'INSTAGRAM_CLIENT_ID',
    clientSecretEnv: 'INSTAGRAM_CLIENT_SECRET',
    tokenInQuery: true,
    parseUser: (j) => ({ id: str(j.id) ?? '', username: str(j.username) }),
  },
  twitter: {
    // X rebrand: authorize lives on x.com; token on api.x.com
    authorizeUrl: 'https://x.com/i/oauth2/authorize',
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    userInfoUrl: 'https://api.x.com/2/users/me',
    scope: 'users.read tweet.read offline.access',
    clientIdEnv: 'TWITTER_CLIENT_ID',
    clientSecretEnv: 'TWITTER_CLIENT_SECRET',
    parseUser: (j) => {
      const data = (j.data ?? {}) as Record<string, unknown>;
      return { id: str(data.id) ?? '', username: str(data.username) };
    },
  },
  tiktok: {
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    userInfoUrl: 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
    scope: 'user.info.basic',
    clientIdEnv: 'TIKTOK_CLIENT_ID',
    clientSecretEnv: 'TIKTOK_CLIENT_SECRET',
    clientIdParam: 'client_key',
    parseUser: (j) => {
      const user = ((j.data as Record<string, unknown>)?.user ?? {}) as Record<string, unknown>;
      return { id: str(user.open_id) ?? '', username: str(user.display_name) };
    },
  },
  facebook: {
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name',
    scope: 'public_profile',
    clientIdEnv: 'FACEBOOK_CLIENT_ID',
    clientSecretEnv: 'FACEBOOK_CLIENT_SECRET',
    tokenInQuery: true,
    parseUser: (j) => ({ id: str(j.id) ?? '', username: str(j.name) }),
  },
  linkedin: {
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scope: 'openid profile',
    clientIdEnv: 'LINKEDIN_CLIENT_ID',
    clientSecretEnv: 'LINKEDIN_CLIENT_SECRET',
    parseUser: (j) => ({ id: str(j.sub) ?? '', username: str(j.name) }),
  },
  spotify: {
    authorizeUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    userInfoUrl: 'https://api.spotify.com/v1/me',
    scope: 'user-read-private',
    clientIdEnv: 'SPOTIFY_CLIENT_ID',
    clientSecretEnv: 'SPOTIFY_CLIENT_SECRET',
    parseUser: (j) => ({ id: str(j.id) ?? '', username: str(j.display_name) ?? str(j.id) }),
  },
};

export function providerCreds(p: SocialProvider): { clientId: string; clientSecret: string } | null {
  const cfg = PROVIDERS[p];
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
