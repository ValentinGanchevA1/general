import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type {
  AdminPersonalLabelProposal, AdminPersonalLabelProposalPage,
  PersonalLabel, PersonalLabelCatalogResponse, PersonalLabelLocale,
  PersonalLabelProposal, PersonalLabelProposalPage, PersonalLabelProposalStatus,
  PersonalLabelReviewRequest, ProposePersonalLabelRequest,
  SelectedPersonalLabelsResponse, SetPersonalLabelsRequest,
} from '@g88/shared';
import { PERSONAL_LABEL_MAX_SELECTED } from '@g88/shared';
import { requirePersonalLabelsEnabled } from './personal-labels.flag';
import type { PersonalLabelQueueDto } from './personal-labels.dto';
import { UsersService } from '../users/users.service';

interface LabelRow {
  key: string;
  label: string;
  category: PersonalLabel['category'];
  emoji: string | null;
}
interface ProposalRow {
  id: string;
  user_id: string;
  proposed_text: string;
  locale: PersonalLabelLocale;
  status: PersonalLabelProposalStatus;
  created_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  review_note: string | null;
}
const TEXT_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\p{N} '\-–]*$/u;

export function normalizePersonalLabelText(value: string): string {
  const text = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (text.length < 3 || text.length > 40 || !TEXT_PATTERN.test(text)) {
    throw new BadRequestException({
      code: 'personal_labels.invalid_text',
      message: 'Use 3–40 letters, numbers, spaces or hyphens.',
    });
  }
  return text;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const failure = error as { driverError?: { code?: unknown } };
  return failure.driverError?.code === '23505';
}

function presentLabel(row: LabelRow): PersonalLabel {
  return { key: row.key, label: row.label, category: row.category, emoji: row.emoji };
}
function presentProposal(row: ProposalRow): PersonalLabelProposal {
  return {
    id: row.id,
    text: row.proposed_text,
    locale: row.locale,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
  };
}

@Injectable()
export class PersonalLabelsService {
  constructor(@InjectDataSource() private readonly db: DataSource, private readonly users: UsersService) {}

  async catalog(locale: PersonalLabelLocale = 'en'): Promise<PersonalLabelCatalogResponse> {
    requirePersonalLabelsEnabled();
    const column = locale === 'bg' ? 'label_bg' : 'label_en';
    const rows = await this.db.query<LabelRow[]>(
      `SELECT key, ${column} AS label, category, emoji
       FROM personal_labels WHERE active = true ORDER BY category, key`,
    );
    return { items: rows.map(presentLabel), maxSelected: PERSONAL_LABEL_MAX_SELECTED };
  }

  async myLabels(userId: string, locale: PersonalLabelLocale = 'en'): Promise<SelectedPersonalLabelsResponse> {
    requirePersonalLabelsEnabled();
    const column = locale === 'bg' ? 'label_bg' : 'label_en';
    const rows = await this.db.query<LabelRow[]>(
      `SELECT l.key, l.${column} AS label, l.category, l.emoji
       FROM user_personal_labels ul JOIN personal_labels l ON l.key = ul.label_key
       WHERE ul.user_id = $1 AND l.active = true ORDER BY ul.position`,
      [userId],
    );
    return { items: rows.map(presentLabel) };
  }

  async publicLabels(targetId: string, viewerId: string, locale: PersonalLabelLocale = 'en'): Promise<SelectedPersonalLabelsResponse> {
    requirePersonalLabelsEnabled();
    // Reuse the canonical public profile privacy, symmetric block and deletion gates.
    if (viewerId !== targetId) await this.users.getPublicProfile(targetId, viewerId);
    return this.myLabels(targetId, locale);
  }

  async setMine(userId: string, dto: SetPersonalLabelsRequest, locale: PersonalLabelLocale = 'en'): Promise<SelectedPersonalLabelsResponse> {
    requirePersonalLabelsEnabled();
    const { keys } = dto;
    if (keys.length > PERSONAL_LABEL_MAX_SELECTED || new Set(keys).size !== keys.length) {
      throw new BadRequestException('Choose up to five distinct labels.');
    }
    await this.db.transaction(async tx => {
      // Serialize concurrent profile edits for this user.
      const users = await tx.query<Array<{ id: string }>>(
        'SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [userId],
      );
      if (!users[0]) throw new NotFoundException('Profile unavailable.');
      const approved = await tx.query<Array<{ key: string }>>(
        'SELECT key FROM personal_labels WHERE key = ANY($1::text[]) AND active = true', [keys],
      );
      if (approved.length !== keys.length) {
        throw new BadRequestException('One or more labels are unavailable.');
      }
      await tx.query('DELETE FROM user_personal_labels WHERE user_id = $1', [userId]);
      for (let index = 0; index < keys.length; index++) {
        await tx.query(
          'INSERT INTO user_personal_labels (user_id,label_key,position) VALUES ($1,$2,$3)',
          [userId, keys[index], index],
        );
      }
    });
    return this.myLabels(userId, locale);
  }

  async submit(userId: string, dto: ProposePersonalLabelRequest): Promise<PersonalLabelProposal> {
    requirePersonalLabelsEnabled();
    const text = normalizePersonalLabelText(dto.text);
    const normalized = text.toLocaleLowerCase(dto.locale);
    return this.db.transaction(async tx => {
      // In addition to per-route throttling, lock user to enforce a durable 30-day quota.
      const users = await tx.query<Array<{ id: string }>>(
        'SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [userId],
      );
      if (!users[0]) throw new NotFoundException('Profile unavailable.');
      const [count] = await tx.query<Array<{ n: string }>>(
        "SELECT COUNT(*)::text AS n FROM personal_label_proposals WHERE user_id = $1 AND created_at > clock_timestamp() - interval '30 days'",
        [userId],
      );
      if (Number(count?.n ?? 0) >= 3) {
        throw new HttpException('You can suggest up to three labels every 30 days.', HttpStatus.TOO_MANY_REQUESTS);
      }
      const col = dto.locale === 'bg' ? 'label_bg' : 'label_en';
      const existing = await tx.query<Array<{ key: string }>>(
        `SELECT key FROM personal_labels WHERE lower(${col}) = $1 LIMIT 1`, [normalized],
      );
      if (existing.length > 0) throw new ConflictException('This label already exists.');
      // A unique partial index also prevents pending duplicates from multiple accounts.
      const rows = await tx.query<ProposalRow[]>(
        `INSERT INTO personal_label_proposals (user_id, proposed_text, normalized_text, locale)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING
         RETURNING id, user_id, proposed_text, locale, status, created_at, reviewed_at, reviewed_by, review_note`,
        [userId, text, normalized, dto.locale],
      );
      if (!rows[0]) throw new ConflictException('This label has already been suggested.');
      return presentProposal(rows[0]);
    });
  }

  async myProposals(userId: string): Promise<PersonalLabelProposalPage> {
    requirePersonalLabelsEnabled();
    const rows = await this.db.query<ProposalRow[]>(
      `SELECT id,user_id,proposed_text,locale,status,created_at,reviewed_at,reviewed_by,review_note
       FROM personal_label_proposals WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`, [userId],
    );
    return { items: rows.map(presentProposal), nextOffset: null };
  }

  async queue(dto: PersonalLabelQueueDto): Promise<AdminPersonalLabelProposalPage> {
    requirePersonalLabelsEnabled();
    const limit = dto.limit ?? 20;
    const offset = dto.offset ?? 0;
    const rows = await this.db.query<ProposalRow[]>(
      `SELECT id,user_id,proposed_text,locale,status,created_at,reviewed_at,reviewed_by,review_note
       FROM personal_label_proposals WHERE status=$1
       ORDER BY created_at ASC,id ASC LIMIT $2 OFFSET $3`,
      [dto.status ?? 'pending', limit + 1, offset],
    );
    return {
      items: rows.slice(0, limit).map((row): AdminPersonalLabelProposal => ({
        ...presentProposal(row),
        userId: row.user_id,
        reviewerId: row.reviewed_by,
        reviewNote: row.review_note,
      })),
      nextOffset: rows.length > limit ? offset + limit : null,
    };
  }

  async review(adminId: string, proposalId: string, dto: PersonalLabelReviewRequest): Promise<{ status: PersonalLabelProposalStatus; key: string | null }> {
    requirePersonalLabelsEnabled();
    try {
      return await this.db.transaction(async tx => {
      const [row] = await tx.query<ProposalRow[]>(
        `SELECT id,user_id,proposed_text,locale,status,created_at,reviewed_at,reviewed_by,review_note
         FROM personal_label_proposals WHERE id=$1 FOR UPDATE`, [proposalId],
      );
      if (!row) throw new NotFoundException('Suggestion not found.');
      if (row.status !== 'pending') throw new ConflictException('Suggestion already reviewed.');
      let key: string | null = null;
      let status: PersonalLabelProposalStatus;
      if (dto.decision === 'approve') {
        if (!dto.key || !dto.labelBg || !dto.labelEn || !dto.category) {
          throw new BadRequestException('Approval requires key, both translations and category.');
        }
        const labelBg = normalizePersonalLabelText(dto.labelBg);
        const labelEn = normalizePersonalLabelText(dto.labelEn);
        await tx.query(
          `INSERT INTO personal_labels (key,label_bg,label_en,category,emoji)
           VALUES ($1,$2,$3,$4,$5)`,
          [dto.key, labelBg, labelEn, dto.category, dto.emoji ?? null],
        );
        key = dto.key;
        status = 'approved';
      } else if (dto.decision === 'merge') {
        if (!dto.existingKey) throw new BadRequestException('Select an existing label.');
        const found = await tx.query<Array<{ key: string }>>(
          'SELECT key FROM personal_labels WHERE key=$1 AND active=true', [dto.existingKey],
        );
        if (!found[0]) throw new BadRequestException('Existing label not found.');
        key = dto.existingKey;
        status = 'merged';
      } else {
        status = 'rejected';
      }
      await tx.query(
        `UPDATE personal_label_proposals
         SET status=$2,resulting_key=$3,reviewed_by=$4,reviewed_at=clock_timestamp(),review_note=$5
         WHERE id=$1`,
        [proposalId, status, key, adminId, dto.decision === 'approve' ? null : dto.note?.trim() || null],
      );
      return { status, key };
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException({
          code: 'personal_labels.already_exists',
          message: 'A label with this key or translation already exists.',
        });
      }
      throw error;
    }
  }
}
