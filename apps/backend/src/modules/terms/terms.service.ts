import {
  ForbiddenException, Injectable, ServiceUnavailableException, BadRequestException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { AcceptTermsResponse, TermsStatusResponse } from '@g88/shared';

type TermsChannel = 'mobile' | 'web' | 'api';
interface AcceptedRow { accepted_at: Date }
interface TermsConfig { version: string; url: string }

@Injectable()
export class TermsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  isEnforced(): boolean {
    return process.env.NEXUS_REQUIRE_UGC_TERMS === 'true';
  }

  /** Fail closed if enforcement is enabled but the approved policy is not configured. */
  private current(): TermsConfig | null {
    const version = process.env.NEXUS_TERMS_VERSION?.trim() ?? '';
    const url = process.env.NEXUS_TERMS_URL?.trim() ?? '';
    if (!version && !url) return null;
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(version)) return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash ||
          parsed.pathname.replace(/\\/$/, '') === '/privacy') return null;
      return { version, url };
    } catch {
      return null;
    }
  }

  private configured(): TermsConfig {
    const config = this.current();
    if (!config) throw new ServiceUnavailableException({
      code: 'terms.not_configured',
      message: 'The approved Terms of Service are not available yet.',
    });
    return config;
  }

  private async lookup(userId: string, version: string): Promise<AcceptedRow | null> {
    const rows = await this.db.query<AcceptedRow[]>(
      'SELECT accepted_at FROM user_terms_acceptances WHERE user_id = $1 AND terms_version = $2',
      [userId, version],
    );
    return rows[0] ?? null;
  }

  async status(userId: string): Promise<TermsStatusResponse> {
    const cfg = this.current();
    if (this.isEnforced() && !cfg) this.configured();
    if (!cfg) return {
      configured: false, enforcementEnabled: false, version: null,
      url: null, accepted: false, required: false,
    };
    const accepted = Boolean(await this.lookup(userId, cfg.version));
    return {
      configured: true, enforcementEnabled: this.isEnforced(),
      version: cfg.version, url: cfg.url, accepted,
      required: this.isEnforced() && !accepted,
    };
  }

  async accept(
    userId: string, version: string, accepted: true, channel: TermsChannel,
  ): Promise<AcceptTermsResponse> {
    const cfg = this.configured();
    if (accepted !== true) {
      throw new BadRequestException({ code: 'terms.explicit_consent_required', message: 'You must explicitly accept the Terms.' });
    }
    if (version !== cfg.version) {
      throw new BadRequestException({
        code: 'terms.version_mismatch', message: 'Please review the current Terms before accepting.',
        version: cfg.version, url: cfg.url,
      });
    }
    await this.db.query(
      `INSERT INTO user_terms_acceptances (user_id, terms_version, channel)
       VALUES ($1,$2,$3) ON CONFLICT (user_id,terms_version) DO NOTHING`,
      [userId, cfg.version, channel],
    );
    const row = await this.lookup(userId, cfg.version);
    if (!row) throw new ServiceUnavailableException({
      code: 'terms.persistence_failed', message: 'Unable to record Terms acceptance.',
    });
    return { accepted: true, version: cfg.version, acceptedAt: row.accepted_at.toISOString() };
  }

  async assertAccepted(userId: string): Promise<void> {
    if (!this.isEnforced()) return;
    const cfg = this.configured();
    if (!userId || !(await this.lookup(userId, cfg.version))) {
      throw new ForbiddenException({
        code: 'terms.acceptance_required',
        message: 'Review and accept the current Terms before publishing content.',
        version: cfg.version, url: cfg.url,
      });
    }
  }
}
