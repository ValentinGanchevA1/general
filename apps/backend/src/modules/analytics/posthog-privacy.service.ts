import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PRODUCT_ANALYTICS_EVENTS } from '@g88/shared';

const DEFAULT_APP_HOST = 'https://eu.posthog.com';
const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 60 * 60 * 1_000;
const CLAIM_LEASE_MS = 10 * 60 * 1_000;
const MAX_BATCH_SIZE = 50;
const RECONCILIATION_PAGE_SIZE = 100;
const MAX_RECONCILIATION_PAGES = 20;
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
  submission_id?: string;
}

type ReconciliationResult =
  | { state: 'found'; request: PostHogDeletionResponse }
  | { state: 'not_found' }
  | { state: 'unavailable' };

type PostHogConfig = { apiKey: string; projectId: string; appHost: string };

function enabled(): boolean {
  return process.env.POSTHOG_PRIVACY_ENABLED?.trim().toLowerCase() === 'true';
}

function queryVerified(): boolean {
  return process.env.POSTHOG_DELETION_QUERY_VERIFIED?.trim().toLowerCase() === 'true';
}

function configuration(): PostHogConfig | null {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  if (!apiKey || !projectId) return null;
  const appHost = (process.env.POSTHOG_APP_HOST?.trim() || DEFAULT_APP_HOST).replace(/\/$/, '');
  return { apiKey, projectId, appHost };
}

function boundedLimit(limit: number): number {
  return Math.max(1, Math.min(MAX_BATCH_SIZE, limit));
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function deletionListItems(payload: unknown): PostHogDeletionResponse[] | null {
  const candidate = Array.isArray(payload)
    ? payload
    : typeof payload === 'object' && payload !== null && 'results' in payload
      ? (payload as { results?: unknown }).results
      : null;

  if (!Array.isArray(candidate)) return null;
  return candidate.filter(
    (item): item is PostHogDeletionResponse => typeof item === 'object' && item !== null,
  );
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

    const rows = await this.claimPending(limit);
    for (const row of rows) await this.submit(row, config);
  }

  private async claimPending(limit: number): Promise<DeletionRow[]> {
    return this.db.query<DeletionRow[]>(
      `WITH candidates AS (
         SELECT id
           FROM analytics_external_deletion_requests
          WHERE provider = 'posthog'
            AND status IN ('queued', 'failed')
            AND next_attempt_at <= NOW()
          ORDER BY created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       )
       UPDATE analytics_external_deletion_requests AS request
          SET next_attempt_at = NOW() + ($2::int * INTERVAL '1 millisecond'),
              updated_at = NOW()
         FROM candidates
        WHERE request.id = candidates.id
       RETURNING request.id, request.kind, request.subject_hash, request.cutoff_at,
                 request.submission_id, request.attempts`,
      [boundedLimit(limit), CLAIM_LEASE_MS],
    );
  }

  private async syncSubmitted(config: PostHogConfig, limit: number): Promise<void> {
    const rows = await this.db.query<SubmittedRow[]>(
      `SELECT id, provider_request_id
         FROM analytics_external_deletion_requests
        WHERE provider = 'posthog' AND status = 'submitted' AND provider_request_id IS NOT NULL
        ORDER BY updated_at ASC
        LIMIT $1`,
      [boundedLimit(limit)],
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
    config: PostHogConfig,
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

  private async reconcileSubmission(
    submissionId: string,
    config: PostHogConfig,
  ): Promise<ReconciliationResult> {
    for (let page = 0; page < MAX_RECONCILIATION_PAGES; page += 1) {
      const offset = page * RECONCILIATION_PAGE_SIZE;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(
          `${config.appHost}/api/projects/${encodeURIComponent(config.projectId)}/data_deletion_requests/?limit=${RECONCILIATION_PAGE_SIZE}&offset=${offset}`,
          { headers: { Authorization: `Bearer ${config.apiKey}` }, signal: controller.signal },
        );
        if (!response.ok) return { state: 'unavailable' };

        const results = deletionListItems(await response.json());
        if (results == null) return { state: 'unavailable' };
        const match = results.find(
          (request) => request.submission_id === submissionId && request.id != null && UUID_RE.test(request.id),
        );
        if (match) return { state: 'found', request: match };
        if (results.length < RECONCILIATION_PAGE_SIZE) return { state: 'not_found' };
      } catch {
        return { state: 'unavailable' };
      } finally {
        clearTimeout(timeout);
      }
    }

    this.logger.error('PostHog deletion reconciliation exceeded the pagination safety limit.');
    return { state: 'unavailable' };
  }

  private async submit(row: DeletionRow, config: PostHogConfig): Promise<void> {
    let query: string;
    try {
      query = row.kind === 'subject'
        ? buildPostHogSubjectDeletionQuery(row.subject_hash ?? '')
        : buildPostHogRetentionDeletionQuery(new Date(row.cutoff_at ?? ''));
    } catch (error: unknown) {
      await this.scheduleRetry(
        row.id,
        error instanceof Error ? error.message : 'invalid deletion request',
        false,
      );
      return;
    }

    if (row.attempts > 0) {
      const reconciliation = await this.reconcileSubmission(row.submission_id, config);
      if (reconciliation.state === 'found' && reconciliation.request.id) {
        await this.markSubmitted(row.id, reconciliation.request.id, false);
        return;
      }
      if (reconciliation.state === 'unavailable') {
        await this.scheduleRetry(row.id, 'PostHog deletion retry reconciliation is unavailable.', false);
        return;
      }
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
        await this.scheduleRetry(
          row.id,
          `PostHog deletion request rejected with HTTP ${response.status}`,
          true,
        );
        return;
      }

      const body = (await response.json()) as PostHogDeletionResponse;
      if (!body.id || !UUID_RE.test(body.id)) {
        await this.scheduleRetry(
          row.id,
          'PostHog deletion response did not include a valid request id.',
          true,
        );
        return;
      }

      await this.markSubmitted(row.id, body.id, true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown PostHog deletion error';
      await this.scheduleRetry(row.id, message, true);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async markSubmitted(id: string, providerRequestId: string, attempted: boolean): Promise<void> {
    await this.db.query(
      `UPDATE analytics_external_deletion_requests
          SET status = 'submitted', provider_request_id = $2::uuid,
              attempts = attempts + $3::int,
              submitted_at = COALESCE(submitted_at, NOW()), updated_at = NOW(), last_error = NULL
        WHERE id = $1`,
      [id, providerRequestId, attempted ? 1 : 0],
    );
  }

  private async scheduleRetry(id: string, message: string, attempted: boolean): Promise<void> {
    const safeMessage = message.slice(0, 300);
    await this.db.query(
      `UPDATE analytics_external_deletion_requests
          SET status = 'failed', attempts = attempts + $2::int,
              next_attempt_at = NOW() + ($3::int * INTERVAL '1 millisecond'),
              last_error = $4, updated_at = NOW()
        WHERE id = $1`,
      [id, attempted ? 1 : 0, RETRY_DELAY_MS, safeMessage],
    );
  }
}
