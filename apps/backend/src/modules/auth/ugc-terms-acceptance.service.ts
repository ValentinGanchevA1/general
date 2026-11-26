import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  AcceptUgcTermsRequest,
  UgcTermsAcceptanceStatus,
} from '@g88/shared';

const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

interface CurrentTerms {
  version: string;
  sha256: string;
}

interface TermsAcceptanceRow {
  terms_sha256: string;
  accepted_at: Date | string;
}

export function ugcTermsAcceptanceEnabled(): boolean {
  return process.env.NEXUS_REQUIRE_UGC_TERMS === 'true';
}

export function configuredUgcTerms(): CurrentTerms {
  const version = process.env.NEXUS_TERMS_VERSION?.trim() ?? '';
  const sha256 = process.env.NEXUS_TERMS_SHA256?.trim().toLowerCase() ?? '';
  if (!VERSION_PATTERN.test(version) || !SHA256_PATTERN.test(sha256)) {
    throw new ServiceUnavailableException({
      code: 'legal.terms_configuration_unavailable',
      message: 'The current Terms version and content hash are not configured.',
    });
  }
  return { version, sha256 };
}

@Injectable()
export class UgcTermsAcceptanceService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async status(userId: string): Promise<UgcTermsAcceptanceStatus> {
    if (!ugcTermsAcceptanceEnabled()) {
      return {
        required: false,
        accepted: true,
        termsVersion: null,
        termsSha256: null,
        acceptedAt: null,
      };
    }

    const current = configuredUgcTerms();
    const rows = await this.db.query<Array<TermsAcceptanceRow>>(
      'SELECT terms_sha256, accepted_at FROM user_terms_acceptances WHERE user_id = $1 AND terms_version = $2 LIMIT 1',
      [userId, current.version],
    );
    const row = rows[0];
    if (row && row.terms_sha256.toLowerCase() !== current.sha256) {
      throw new ServiceUnavailableException({
        code: 'legal.terms_version_hash_mismatch',
        message: 'The configured Terms version has already been used with different content.',
      });
    }

    return {
      required: true,
      accepted: Boolean(row),
      termsVersion: current.version,
      termsSha256: current.sha256,
      acceptedAt: row ? new Date(row.accepted_at).toISOString() : null,
    };
  }

  async accept(
    userId: string,
    request: AcceptUgcTermsRequest,
  ): Promise<UgcTermsAcceptanceStatus> {
    if (!request.accepted) {
      throw new BadRequestException({
        code: 'legal.terms_acceptance_required',
        message: 'Explicit acceptance of the current Terms is required.',
      });
    }
    if (!ugcTermsAcceptanceEnabled()) {
      return this.status(userId);
    }

    const current = configuredUgcTerms();
    if (request.termsVersion !== current.version ||
        request.termsSha256.toLowerCase() !== current.sha256) {
      throw new ConflictException({
        code: 'legal.terms_version_changed',
        message: 'Review and accept the current Terms version before continuing.',
      });
    }

    await this.db.query(
      'INSERT INTO user_terms_acceptances (user_id, terms_version, terms_sha256) VALUES ($1, $2, $3) ON CONFLICT (user_id, terms_version) DO NOTHING',
      [userId, current.version, current.sha256],
    );
    return this.status(userId);
  }

  async hasCurrentAcceptance(userId: string): Promise<boolean> {
    return (await this.status(userId)).accepted;
  }
}
