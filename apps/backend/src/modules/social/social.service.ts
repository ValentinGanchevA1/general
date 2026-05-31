import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { SocialProvider, UserProfile } from '@g88/shared';

import { UsersService } from '../users/users.service';
import { PROVIDERS, providerCreds } from './providers';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min

interface StatePayload {
  uid: string;
  p: SocialProvider;
  exp: number;
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly users: UsersService,
  ) {}

  /** Authorize URL to open in the browser; CSRF-protected via signed state. */
  buildStartUrl(userId: string, provider: SocialProvider): string {
    const creds = providerCreds(provider);
    if (!creds) {
      throw new ServiceUnavailableException({
        code: 'social.provider_unavailable',
        message: `${provider} linking is not configured`,
      });
    }
    const cfg = PROVIDERS[provider];
    const state = this.signState({ uid: userId, p: provider, exp: Date.now() + STATE_TTL_MS });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: creds.clientId,
      redirect_uri: this.redirectUri(),
      scope: cfg.scope,
      state,
      ...(cfg.extraAuthParams ?? {}),
    });
    return `${cfg.authorizeUrl}?${params.toString()}`;
  }

  /** Exchange the code, fetch the handle, and link the account. Returns the linked provider. */
  async handleCallback(code: string, state: string): Promise<SocialProvider> {
    const decoded = this.verifyState(state);
    const { uid: userId, p: provider } = decoded;
    const creds = providerCreds(provider);
    if (!creds) {
      throw new ServiceUnavailableException({ code: 'social.provider_unavailable', message: 'Not configured' });
    }
    const cfg = PROVIDERS[provider];

    // 1. authorization_code → access_token
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri(),
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      }).toString(),
    });
    if (!tokenRes.ok) {
      this.logger.warn(`[social] ${provider} token exchange failed: ${tokenRes.status}`);
      throw new BadRequestException({ code: 'social.token_exchange_failed', message: 'Could not link account' });
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      throw new BadRequestException({ code: 'social.token_exchange_failed', message: 'No access token' });
    }

    // 2. fetch the user's handle
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
    const { username } = cfg.parseUser((await infoRes.json()) as Record<string, unknown>);

    // 3. upsert the verified link
    await this.db.query(
      `INSERT INTO social_links (user_id, provider, username, url, verified)
            VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (user_id, provider)
       DO UPDATE SET username = EXCLUDED.username, url = EXCLUDED.url, verified = true`,
      [userId, provider, username, this.profileUrl(provider, username)],
    );
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

  private profileUrl(provider: SocialProvider, username: string | null): string | null {
    if (!username) return null;
    switch (provider) {
      case 'instagram': return `https://instagram.com/${username}`;
      case 'twitter': return `https://x.com/${username}`;
      case 'tiktok': return `https://tiktok.com/@${username}`;
      case 'facebook': return null;
      case 'linkedin': return null;
      case 'spotify': return null;
      default: return null;
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
    return payload;
  }
}
