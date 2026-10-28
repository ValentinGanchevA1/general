import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PRODUCT_ANALYTICS_EVENTS } from '@g88/shared';

const DEFAULT_APP_HOST = 'https://eu.posthog.com';
const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 60 * 60 * 1_000;
const SUBJECT_HASH_RE = /^[a-f0-9]{64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface DeletionRow {
  id: string;
  kind: 'subject' | 'retention';
  subject_hash: string | null;
  cutoff_at: string | Date | null;
  submission_id: string;
  attempts: number;
}

interface SubmittedRow {
  id: string;
  provider_request_id: string;
}

interface PostHogDeletionResponse {
  id?: string;
  status?: string;
}

function enabled(): boolean {
  return process.env.POSTHOG_PRIVACY_ENABLED?.trim().toLowerCase() === 'true';
}

function queryVerified(): boolean {
  return process.env.POSTHOG_DELETION_QUERY_VERIFIED?.trim().toLowerCase() === 'true';
}

function configuration(): { apiKey: string; projectId: string; appHost: string } | null {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  if (!apiKey || !projectId) return null;
  const appHost = (process.env.POSTHOG_APP_HOST?.trim() || DEFAULT_APP_HOST).replace(/\/$/, '');
  return { apiKey, projectId, appHost };
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildPostHogSubjectDeletionQuery(subjectHash: string): string {
  if (!SUBJECT_HASH_RE.test(subjectHash)) throw new Error('Invalid analytics subject hash.');
  return `SELECT uuid FROM events WHERE distinct_id = ${quoteLiteral(subjectHash)}`;
}

export function buildPostHogRetentionDeletionQuery(cutoff: Date): string {
  if (Number.isNaN(cutoff.getTime())) throw new Error('Invalid analytics retention cutoff.');
  const eventNames = PRODUCT_ANALYTICS_EVENTS.map((event) => quoteLiteral(event)).join(', ');
  return `SELECT uuid FROM events WHERE timestamp < toDateTime(${quoteLiteral(cutoff.toISOString())}) AND event IN (${eventNames})`;
}

@Injectable()
export class PostHogPrivacyService {
  private readonly logger = new Logger(PostHogPrivacyService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async enqueueSubjectDeletion(subjectHash: string): Promise<void> {
    if (!SUBJECT_HASH_RE.test(subjectHash)) {
      this.logger.error('Refusing to enqueue an invalid analytics subject hash.');
      return;
    }
    await this.db.query(
      `INSERT INTO analytics_external_deletion_requests (provider, kind, subject_hash)
       VALUES ('posthog', 'subject', $1)
       ON CONFLICT DO NOTHING`,
      [subjectHash],
    );
  }

  async enqueueRetentionDeletion(cutoff: Date): Promise<void> {
    if (Number.isNaN(cutoff.getTime())) return;
    await this.db.query(
      `INSERT INTO analytics_external_deletion_requests (provider, kind, cutoff_at)
       VALUES ('posthog', 'retention', $1)
       ON CONFLICT DO NOTHING`,
      [cutoff.toISOString()],
    );
  }

  async processPending(limit = 10): Promise<void> {
    if (!enabled()) return;
    if (!queryVerified()) {
      this.logger.error(
        'PostHog privacy automation is enabled but deletion query verification is not approved; refusing destructive requests.',
      );
      return;
    }

    const config = configuration();
    if (!config) {
      this.logger.error('PostHog privacy automation is enabled but private API configuration is incomplete.');
      return;
    }

    await this.syncSubmitted(config, limit);

    const rows = await this.db.query<DeletionRow[]>(
      `SELECT id, kind, subject_hash, cutoff_at, submission_id, attempts
         FROM analytics_external_deletion_requests
        WHERE provider = 'posthog'
          AND status IN ('queued', 'failed')
          AND next_attempt_at <= NOW()
        ORDER BY created_at ASC
        LIMIT $1`,
      [Math.max(1, Math.min(50, limit))],
    );

    for (const row of rows) await this.submit(row, config);
  }

  private async syncSubmitted(
    config: { apiKey: string; projectId: string; appHost: string },
    limit: number,
  ): Promise<void> {
    const rows = await this.db.query<SubmittedRow[]>(
      `SELECT id, provider_request_id
         FROM analytics_external_deletion_requests
        WHERE provider = 'posthog' AND status = 'submitted' AND provider_request_id IS NOT NULL
        ORDER BY updated_at ASC
        LIMIT $1`,
      [Math.max(1, Math.min(50, limit))],
    );

    for (const row of rows) {
      if (!UUID_RE.test(row.provider_request_id)) continue;
      const body = await this.fetchRequest(row.provider_request_id, config);
      if (body?.status === 'completed') {
        await this.db.query(
          `UPDATE analytics_external_deletion_requests
              SET status = 'completed', completed_at = NOW(), updated_at = NOW(), last_error = NULL
            WHERE id = $1`,
          [row.id],
        );
      }
    }
  }

  private async fetchRequest(
    requestId: string,
    config: { apiKey: string; projectId: string; appHost: string },
  ): Promise<PostHogDeletionResponse | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${config.appHost}/api/projects/${encodeURIComponent(config.projectId)}/data_deletion_requests/${encodeURIComponent(requestId)}/`,
        { headers: { Authorization: `Bearer ${config.apiKey}` }, signal: controller.signal },
      );
      if (!response.ok) return null;
      return (await response.json()) as PostHogDeletionResponse;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async submit(
    row: DeletionRow,
    config: { apiKey: string; projectId: string; appHost: string },
  ): Promise<void> {
    let query: string;
    try {
      query = row.kind === 'subject'
        ? buildPostHogSubjectDeletionQuery(row.subject_hash ?? '')
        : buildPostHogRetentionDeletionQuery(new Date(row.cutoff_at ?? ''));
    } catch (error: unknown) {
      await this.markFailed(row.id, error instanceof Error ? error.message : 'invalid deletion request');
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${config.appHost}/api/projects/${encodeURIComponent(config.projectId)}/data_deletion_requests/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, submission_id: row.submission_id }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        await this.markFailed(row.id, `PostHog deletion request rejected with HTTP ${response.status}`);
        return;
      }

      const body = (await response.json()) as PostHogDeletionResponse;
      if (!body.id || !UUID_RE.test(body.id)) {
        await this.markFailed(row.id, 'PostHog deletion response did not include a valid request id.');
        return;
      }

      await this.db.query(
        `UPDATE analytics_external_deletion_requests
            SET status = 'submitted', provider_request_id = $2::uuid,
                attempts = attempts + 1, submitted_at = NOW(), updated_at = NOW(), last_error = NULL
          WHERE id = $1`,
        [row.id, body.id],
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown PostHog deletion error';
      await this.markFailed(row.id, message);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async markFailed(id: string, message: string): Promise<void> {
    const safeMessage = message.slice(0, 300);
    await this.db.query(
      `UPDATE analytics_external_deletion_requests
          SET status = 'failed', attempts = attempts + 1,
              next_attempt_at = NOW() + ($2::int * INTERVAL '1 millisecond'),
              last_error = $3, updated_at = NOW()
        WHERE id = $1`,
      [id, RETRY_DELAY_MS, safeMessage],
    );
  }
}
