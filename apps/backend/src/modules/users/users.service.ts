import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { AuthenticatedUser } from '@g88/shared';

@Injectable()
export class UsersService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async findById(id: string): Promise<AuthenticatedUser | null> {
    const rows = await this.db.query<
      Array<{
        id: string;
        email: string;
        display_name: string;
        avatar_url: string | null;
        verification_level: string;
      }>
    >(
      `SELECT id, email, display_name, avatar_url, verification_level
         FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      verification: r.verification_level as AuthenticatedUser['verification'],
    };
  }
}
