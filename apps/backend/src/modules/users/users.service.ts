import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  AuthenticatedUser,
  PublicUserProfile,
  UpdateProfileRequest,
  UserProfile,
} from '@g88/shared';

import { PresenceService } from '../presence/presence.service';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  verification_level: string;
  visibility: 'public' | 'private';
  goals: string[];
}

interface PublicUserRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  verification_level: string;
  goals: string[];
}

const USER_COLUMNS =
  'id, email, display_name, avatar_url, bio, verification_level, visibility, goals';

@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly presence: PresenceService,
  ) {}

  async findById(id: string): Promise<AuthenticatedUser | null> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT ${USER_COLUMNS}
         FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (!rows[0]) return null;
    return this.toPublic(rows[0]);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT ${USER_COLUMNS}
         FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new UnauthorizedException();
    return this.toProfile(rows[0]);
  }

  async getPublicProfile(userId: string): Promise<PublicUserProfile> {
    const rows = await this.db.query<PublicUserRow[]>(
      `SELECT id, display_name, avatar_url, bio, verification_level, goals
         FROM users
        WHERE id = $1 AND deleted_at IS NULL AND visibility = 'public'
        LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException({ code: 'users.not_found', message: 'User not found' });
    const r = rows[0];
    // Live "online" comes from Redis presence, not Postgres — see PresenceService.
    const onlineSet = await this.presence.whichAreOnline([r.id]);
    return {
      id: r.id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      bio: r.bio,
      verification: r.verification_level as PublicUserProfile['verification'],
      goals: r.goals ?? [],
      online: onlineSet.has(r.id),
    };
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
    if (req.goals !== undefined) {
      params.push(req.goals);
      setClauses.push(`goals = $${params.length}`);
    }

    if (setClauses.length === 0) return this.getProfile(userId);

    setClauses.push('updated_at = NOW()');
    // TypeORM 0.3.x returns [rowsArray, rowCount] for UPDATE queries
    const [updatedRows] = await this.db.query<[UserRow[], number]>(
      `UPDATE users SET ${setClauses.join(', ')}
          WHERE id = $1 AND deleted_at IS NULL
       RETURNING ${USER_COLUMNS}`,
      params,
    );
    if (!updatedRows[0]) throw new NotFoundException({ code: 'users.not_found', message: 'User not found' });
    return this.toProfile(updatedRows[0]);
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
      goals: r.goals ?? [],
      profileComplete: r.bio != null,
    };
  }
}
