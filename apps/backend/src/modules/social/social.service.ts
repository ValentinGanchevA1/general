import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';

import type { SocialProvider, SocialProvidersResponse, UserProfile } from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { UsersService } from '../users/users.service';
import { PROVIDERS, providerCreds } from './providers';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min
const STATE_TTL_SEC = Math.ceil(STATE_TTL_MS / 1000);
const PKCE_KEY_PREFIX = 'social:pkce:';

interface StatePayload {
  uid: string;
  p: SocialProvider;
  exp: number;
  /** Random nonce used as Redis key for the code_verifier. */
  n: string;
}

interface LinkedProviderOwner {
  user_id: string;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  return (error as { code?: unknown }).code === '23505';
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly users: UsersService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Safe client-facing provider state. Never exposes ids, secrets, or scopes. */
  getProviderAvailability(): SocialProvidersResponse {
    const providers = (Object.keys(PROVIDERS) as SocialProvider[]).map((provider) => ({
      provider,
      available: providerCreds(provider) !== null,
    }));
    return { providers };
  }

  /**
   * Authorize URL to open in the system browser.
   * Includes PKCE (S256) code_challenge + HMAC-signed state (CSRF).
   */
  async buildStartUrl(userId: string, provider: SocialProvider): Promise<string> {
    const creds = providerCreds(provider);
    if (!creds) {
      throw new ServiceUnavailableException({
        code: 'social.provider_unavailable',
        message: `${provider} linking is not configured`,
      });
    }
    const cfg = PROVIDERS[provider];

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const nonce = randomBytes(16).toString('base64url');

    const state = this.signState({
      uid: userId,
      p: provider,
      exp: Date.now() + STATE_TTL_MS,
      n: nonce,
    });

    // Store verifier server-side; single-use, short TTL
    await this.redis.set(`${PKCE_KEY_PREFIX}${nonce}`, codeVerifier, 'EX', STATE_TTL_SEC);

    const clientIdParam = cfg.clientIdParam ?? 'client_id';
    const params = new URLSearchParams({
      response_type: 'code',
      [clientIdParam]: creds.clientId,
      redirect_uri: this.redirectUri(),
      scope: cfg.scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      ...(cfg.extraAuthParams ?? {}),
    });
    return `${cfg.authorizeUrl}?${params.toString()}`;
  }

  /** Exchange the code + PKCE verifier, fetch the handle, and link the account. */
  async handleCallback(code: string, state: string): Promise<SocialProvider> {
    const decoded = this.verifyState(state);
    const { uid: userId, p: provider, n: nonce } = decoded;
    const creds = providerCreds(provider);
    if (!creds) {
      throw new ServiceUnavailableException({ code: 'social.provider_unavailable', message: 'Not configured' });
    }
    const cfg = PROVIDERS[provider];

    // Retrieve and consume the code_verifier (one-time use)
    const key = `${PKCE_KEY_PREFIX}${nonce}`;
    const codeVerifier = await this.redis.get(key);
    if (codeVerifier) {
      await this.redis.del(key);
    }
    if (!codeVerifier) {
      throw new BadRequestException({
        code: 'social.pkce_missing',
        message: 'Link request expired or already used',
      });
    }

    return this.finishCallback(code, provider, userId, creds, cfg, codeVerifier);
  }

  private async finishCallback(
    code: string,
    provider: SocialProvider,
    userId: string,
    creds: { clientId: string; clientSecret: string },
    cfg: (typeof PROVIDERS)[SocialProvider],
    codeVerifier: string,
  ): Promise<SocialProvider> {
    const clientIdParam = cfg.clientIdParam ?? 'client_id';

    // 1. authorization_code + code_verifier → access_token
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(),
      [clientIdParam]: creds.clientId,
      client_secret: creds.clientSecret,
      code_verifier: codeVerifier,
    });

    const tokenRes = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      this.logger.warn(`[social] ${provider} token exchange failed: ${tokenRes.status} ${errText}`);
      throw new BadRequestException({ code: 'social.token_exchange_failed', message: 'Could not link account' });
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      throw new BadRequestException({ code: 'social.token_exchange_failed', message: 'No access token' });
    }

    // 2. Fetch the provider-owned identity. The access token is intentionally not persisted.
    const url = cfg.tokenInQuery
      ? `${cfg.userInfoUrl}${cfg.userInfoUrl.includes('?') ? '&' : '?'}access_token=${accessToken}`
      : cfg.userInfoUrl;
    const infoRes = await fetch(url, {
      headers: cfg.tokenInQuery ? {} : { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) {
      this.logger.warn(`[social] ${provider} userinfo failed: ${infoRes.status}`);
      throw new BadRequestException({ code: 'social.userinfo_failed', message: 'Could not read account' });
    }
    const { id: providerUserId, username } = cfg.parseUser(
      (await infoRes.json()) as Record<string, unknown>,
    );
    if (!providerUserId) {
      throw new BadRequestException({
        code: 'social.provider_identity_missing',
        message: 'Could not verify account identity',
      });
    }

    // 3. A provider account may support only one NEXA identity.
    const linkedElsewhere = (await this.db.query(
      `SELECT user_id
         FROM social_links
        WHERE provider = $1
          AND provider_user_id = $2
          AND user_id <> $3
        LIMIT 1`,
      [provider, providerUserId, userId],
    )) as LinkedProviderOwner[];
    if (linkedElsewhere.length > 0) {
      throw new ConflictException({
        code: 'social.account_already_linked',
        message: 'This social account is already linked to another NEXA account',
      });
    }

    // 4. Upsert the verified ownership link. The DB unique index also closes race conditions.
    try {
      await this.db.query(
        `INSERT INTO social_links (user_id, provider, provider_user_id, username, url, verified)
              VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (user_id, provider)
         DO UPDATE SET provider_user_id = EXCLUDED.provider_user_id,
                       username = EXCLUDED.username,
                       url = EXCLUDED.url,
                       verified = true`,
        [userId, provider, providerUserId, username, this.profileUrl(provider, username)],
      );
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'social.account_already_linked',
          message: 'This social account is already linked to another NEXA account',
        });
      }
      throw error;
    }

    this.logger.log(`[social] linked ${provider} for user=${userId} handle=${username ?? '?'}`);
    return provider;
  }

  async unlink(userId: string, provider: SocialProvider): Promise<UserProfile> {
    await this.db.query(`DELETE FROM social_links WHERE user_id = $1 AND provider = $2`, [
      userId,
      provider,
    ]);
    return this.users.getProfile(userId);
  }

  redirectUri(): string {
    const base = process.env.API_PUBLIC_URL ?? 'https://g88-api.onrender.com';
    return `${base}/api/v1/social/callback`;
  }

  /** Deep link / page the callback bounces back to so the app can refresh. */
  returnUrl(provider: SocialProvider | null, status: 'ok' | 'error'): string {
    const base = process.env.SOCIAL_LINK_RETURN_URL ?? 'https://g88.app/social/linked';
    const params = new URLSearchParams({ status, ...(provider ? { provider } : {}) });
    return `${base}?${params.toString()}`;
  }

  // ── PKCE helpers ──────────────────────────────────────────────────────────

  /** High-entropy verifier (43–128 chars, unreserved set). */
  private generateCodeVerifier(): string {
    return randomBytes(64).toString('base64url');
  }

  /** S256 code_challenge = BASE64URL(SHA256(verifier)). */
  private generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  private profileUrl(provider: SocialProvider, username: string | null): string | null {
    if (!username) return null;
    switch (provider) {
      case 'instagram':
        return `https://instagram.com/${username}`;
      case 'twitter':
        return `https://x.com/${username}`;
      case 'tiktok':
        return `https://tiktok.com/@${username}`;
      case 'facebook':
        return null;
      case 'linkedin':
        return null;
      case 'spotify':
        return null;
      default:
        return null;
    }
  }

  private secret(): string {
    const s = process.env.JWT_SECRET;
    if (!s) throw new Error('JWT_SECRET required for social state signing');
    return s;
  }

  private signState(payload: StatePayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.secret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  private verifyState(state: string): StatePayload {
    const [body, sig] = state.split('.');
    if (!body || !sig) throw new BadRequestException({ code: 'social.bad_state', message: 'Invalid state' });
    const expected = createHmac('sha256', this.secret()).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new BadRequestException({ code: 'social.bad_state', message: 'Invalid state' });
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as StatePayload;
    if (payload.exp < Date.now()) {
      throw new BadRequestException({ code: 'social.state_expired', message: 'Link request expired' });
    }
    if (!payload.n) {
      throw new BadRequestException({ code: 'social.bad_state', message: 'Invalid state (missing nonce)' });
    }
    return payload;
  }
}
