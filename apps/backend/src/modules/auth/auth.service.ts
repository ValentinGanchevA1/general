import { createHash, randomBytes, randomUUID } from 'crypto';

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';

import type { LoginResponse, AuthTokens, AuthenticatedUser } from '@g88/shared';

import type { JwtPayload } from './jwt.strategy';

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string;
  avatar_url: string | null;
  verification_level: string;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  family: string;
  revoked_at: string | null;
}

@Injectable()
export class AuthService {
  private static readonly BCRYPT_ROUNDS = 12;
  private static readonly REFRESH_TTL_DAYS = 30;

  private readonly googleClient: OAuth2Client;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly jwt: JwtService,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    this.googleClient = new OAuth2Client(clientId);
  }

  async register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<LoginResponse> {
    const existing = await this.db.query<UserRow[]>(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    if (existing.length > 0) {
      throw new ConflictException({ code: 'auth.email_taken', message: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, AuthService.BCRYPT_ROUNDS);
    const rows = await this.db.query<UserRow[]>(
      `INSERT INTO users (email, password_hash, display_name)
            VALUES ($1, $2, $3)
         RETURNING id, email, password_hash, display_name, avatar_url, verification_level`,
      [email, passwordHash, displayName],
    );

    const user = rows[0];
    if (!user) throw new Error('Insert failed');

    const tokens = await this.issueTokens(user);
    return { user: this.toPublic(user), tokens };
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT id, email, password_hash, display_name, avatar_url, verification_level
         FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    const user = rows[0];
    const valid = user?.password_hash
      ? await bcrypt.compare(password, user.password_hash)
      : false;

    if (!user || !valid) {
      throw new UnauthorizedException({ code: 'auth.invalid_credentials', message: 'Invalid email or password' });
    }

    const tokens = await this.issueTokens(user);
    return { user: this.toPublic(user), tokens };
  }

  async refresh(rawToken: string): Promise<AuthTokens> {
    const hash = sha256(rawToken);

    // Atomically claim the token — prevents parallel-request race that would
    // let two requests both pass the revoked_at check before either writes.
    const claimed = await this.db.query<RefreshTokenRow[]>(
      `UPDATE refresh_tokens
          SET revoked_at = NOW()
        WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL
        RETURNING id, user_id, family, revoked_at`,
      [hash],
    );
    const stored = claimed[0];

    if (!stored) {
      // Token not claimed — either invalid/expired or already used (reuse attempt).
      const existing = await this.db.query<Pick<RefreshTokenRow, 'family'>[]>(
        `SELECT family FROM refresh_tokens WHERE token_hash = $1 LIMIT 1`,
        [hash],
      );
      if (existing[0]) {
        // Token existed but was already revoked → family is compromised.
        await this.revokeFamily(existing[0].family);
        throw new UnauthorizedException({ code: 'auth.refresh_reuse', message: 'Refresh token reuse detected' });
      }
      throw new UnauthorizedException({ code: 'auth.invalid_refresh', message: 'Invalid or expired refresh token' });
    }

    const userRows = await this.db.query<UserRow[]>(
      `SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [stored.user_id],
    );
    if (!userRows[0]) {
      throw new UnauthorizedException({ code: 'auth.user_missing', message: 'User not found' });
    }

    return this.issueTokens(userRows[0] as UserRow, stored.family);
  }

  async logout(rawToken: string): Promise<void> {
    const hash = sha256(rawToken);
    // Best-effort revocation — ignore if token not found.
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
        WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hash],
    );
  }

  async googleOAuth(idToken: string): Promise<LoginResponse> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID not configured');

    let googleId: string;
    let email: string;
    let name: string | undefined;
    let picture: string | undefined;

    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: clientId });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email || p.email_verified !== true) {
        throw new Error('missing claims or unverified email');
      }
      googleId = p.sub;
      email = p.email;
      name = p.name ?? undefined;
      picture = p.picture ?? undefined;
    } catch {
      throw new UnauthorizedException({ code: 'auth.oauth_failed', message: 'Google token verification failed' });
    }

    // Find by google_id first; fall back to email to link existing email/pw accounts.
    const existing = await this.db.query<UserRow[]>(
      `SELECT id, email, display_name, avatar_url, verification_level
         FROM users
        WHERE (google_id = $1 OR email = $2) AND deleted_at IS NULL
        LIMIT 1`,
      [googleId, email],
    );

    let user: UserRow;
    const found = existing[0];
    if (found) {
      user = found;
      await this.db.query(
        `UPDATE users SET google_id = $1 WHERE id = $2 AND google_id IS NULL`,
        [googleId, user.id],
      );
    } else {
      const rows = await this.db.query<UserRow[]>(
        `INSERT INTO users (email, display_name, avatar_url, google_id)
              VALUES ($1, $2, $3, $4)
           RETURNING id, email, display_name, avatar_url, verification_level`,
        [email, name ?? email.split('@')[0], picture ?? null, googleId],
      );
      const inserted = rows[0];
      if (!inserted) throw new Error('Insert failed');
      user = inserted;
    }

    const tokens = await this.issueTokens(user);
    return { user: this.toPublic(user), tokens };
  }

  async me(userId: string): Promise<AuthenticatedUser> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT id, email, display_name, avatar_url, verification_level
         FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new UnauthorizedException();
    return this.toPublic(rows[0]);
  }

  private async issueTokens(
    user: Pick<UserRow, 'id' | 'email'>,
    family?: string,
  ): Promise<AuthTokens> {
    const rawRefreshToken = randomBytes(32).toString('hex');
    const tokenHash = sha256(rawRefreshToken);
    const tokenFamily = family ?? randomUUID(); // crypto.randomUUID — Node ≥14.17
    const expiresAt = new Date(Date.now() + AuthService.REFRESH_TTL_DAYS * 86_400_000);

    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family, expires_at)
            VALUES ($1, $2, $3, $4)`,
      [user.id, tokenHash, tokenFamily, expiresAt.toISOString()],
    );

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwt.sign(payload);
    const decoded = this.jwt.decode(accessToken) as { exp: number };

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
    };
  }

  private async revokeFamily(family: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
        WHERE family = $1 AND revoked_at IS NULL`,
      [family],
    );
  }

  private toPublic(user: UserRow): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      verification: user.verification_level as AuthenticatedUser['verification'],
    };
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}


