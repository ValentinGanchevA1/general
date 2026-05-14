import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import type { LoginResponse, AuthTokens, AuthenticatedUser } from '@g88/shared';

import type { JwtPayload } from './jwt.strategy';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_url: string | null;
  verification_level: string;
}

@Injectable()
export class AuthService {
  private static readonly BCRYPT_ROUNDS = 12;
  private static readonly REFRESH_TTL = '30d';

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly jwt: JwtService,
  ) {}

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

    return { user: this.toPublic(user), tokens: this.issueTokens(user) };
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT id, email, password_hash, display_name, avatar_url, verification_level
         FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
      [email],
    );
    const user = rows[0];
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !valid) {
      throw new UnauthorizedException({ code: 'auth.invalid_credentials', message: 'Invalid email or password' });
    }

    return { user: this.toPublic(user), tokens: this.issueTokens(user) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-jwt-refresh-secret-change-in-production',
      });
    } catch {
      throw new UnauthorizedException({ code: 'auth.invalid_refresh', message: 'Invalid or expired refresh token' });
    }

    const rows = await this.db.query<UserRow[]>(
      `SELECT id, email FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [payload.sub],
    );
    if (!rows[0]) {
      throw new UnauthorizedException({ code: 'auth.user_missing', message: 'User not found' });
    }

    return this.issueTokens(rows[0] as UserRow);
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

  private issueTokens(user: Pick<UserRow, 'id' | 'email'>): AuthTokens {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET ?? 'dev-jwt-refresh-secret-change-in-production',
      expiresIn: AuthService.REFRESH_TTL,
    });
    const decoded = this.jwt.decode(accessToken) as { exp: number };
    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
    };
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
