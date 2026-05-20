import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser, UpdateProfileRequest, UserProfile } from '@g88/shared';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  verification_level: string;
  visibility: 'public' | 'private';
}

@Injectable()
export class UsersService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async findById(id: string): Promise<AuthenticatedUser | null> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT id, email, display_name, avatar_url, bio, verification_level, visibility
         FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (!rows[0]) return null;
    return this.toPublic(rows[0]);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT id, email, display_name, avatar_url, bio, verification_level, visibility
         FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new UnauthorizedException();
    return this.toProfile(rows[0]);
  }

  async updateProfile(userId: string, req: UpdateProfileRequest): Promise<UserProfile> {
    const setClauses: string[] = [];
    const params: unknown[] = [userId];

    if (req.displayName !== undefined) {
      params.push(req.displayName);
      setClauses.push(`display_name = $${params.length}`);
    }
    if (req.bio !== undefined) {
      params.push(req.bio);
      setClauses.push(`bio = $${params.length}`);
    }
    if (req.avatarUrl !== undefined) {
      params.push(req.avatarUrl);
      setClauses.push(`avatar_url = $${params.length}`);
    }
    if (req.visibility !== undefined) {
      params.push(req.visibility);
      setClauses.push(`visibility = $${params.length}`);
    }

    if (setClauses.length === 0) return this.getProfile(userId);

    setClauses.push('updated_at = NOW()');
    const rows = await this.db.query<UserRow[]>(
      `UPDATE users SET ${setClauses.join(', ')}
          WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, email, display_name, avatar_url, bio, verification_level, visibility`,
      params,
    );
    if (!rows[0]) throw new NotFoundException({ code: 'users.not_found', message: 'User not found' });
    return this.toProfile(rows[0]);
  }

  private toPublic(r: UserRow): AuthenticatedUser {
    return {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      verification: r.verification_level as AuthenticatedUser['verification'],
    };
  }

  private toProfile(r: UserRow): UserProfile {
    return {
      ...this.toPublic(r),
      bio: r.bio,
      visibility: r.visibility,
      profileComplete: r.bio != null,
    };
  }
}
