import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PRODUCT_ANALYTICS_EVENTS } from '@g88/shared';

const DEFAULT_APP_HOST = 'https://eu.posthog.com';
const REQUEST_TIMEOUT_MS = 5_000;
const RETRY_DELAY_MS = 60 * 60 * 1_000;
const CLAIM_LEASE_MS = 10 * 60 * 1_000;
const INITIAL_WORKER_DELAY_MS = 60 * 1_000;
const WORKER_INTERVAL_MS = 15 * 60 * 1_000;
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
  query?: string;
}

type ReconciliationResult =
  | { state: 'found'; request: PostHogDeletionResponse }
  | { state: 'not_found' }
  | { state: 'unavailable' };

type PostHogConfig = { apiKey: string; projectId: string; appHost: string };
type PostHogRequestInit = Omit<RequestInit, 'headers' | 'signal'> & {
  headers?: Record<string, string>;
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deletionResponse(payload: unknown): PostHogDeletionResponse | null {
  if (!isRecord(payload)) return null;
  const response: PostHogDeletionResponse = {};
  if (typeof payload.id === 'string') response.id = payload.id;
  if (typeof payload.status === 'string') response.status = payload.status;
  if (typeof payload.submission_id === 'string') response.submission_id = payload.submission_id;
  if (typeof payload.query === 'string') response.query = payload.query;
  return response;
}

function deletionListItems(payload: unknown): PostHogDeletionResponse[] | null {
  let candidate: unknown = null;
  if (Array.isArray(payload)) {
    candidate = payload;
  } else if (isRecord(payload) && 'results' in payload) {
    candidate = payload.results;
  }

  if (!Array.isArray(candidate)) return null;
  return candidate.map(deletionResponse).filter((item): item is PostHogDeletionResponse => item !== null);
}

function matchesDeletionRequest(
  request: PostHogDeletionResponse,
  submissionId: string,
  query: string,
): boolean {
  if (!request.id || !UUID_RE.test(request.id)) return false;
  return request.submission_id === submissionId || request.query === query;
}

export function buildPostHogSubjectDeletionQuery(subjectHash: string): string {
  if (!SUBJECT_HASH_RE.test(subjectHash)) throw new TypeError('Invalid analytics subject hash.');
  return `SELECT uuid FROM events WHERE distinct_id = ${quoteLiteral(subjectHash)}`;
}

export function buildPostHogRetentionDeletionQuery(cutoff: Date): string {
  if (Number.isNaN(cutoff.getTime())) throw new TypeError('Invalid analytics retention cutoff.');
  const eventNames = PRODUCT_ANALYTICS_EVENTS.map((event) => quoteLiteral(event)).join(', ');
  return `SELECT uuid FROM events WHERE timestamp < toDateTime(${quoteLiteral(cutoff.toISOString())}) AND event IN (${eventNames})`;
}

@Injectable()
export class PostHogPrivacyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostHogPrivacyService.name);
  private workerTimer: ReturnType<typeof setTimeout> | null = null;
  private processing = false;
  private destroyed = false;

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  onModuleInit(): void {
    this.destroyed = false;
    this.scheduleWorker(INITIAL_WORKER_DELAY_MS);
  }

  onModuleDestroy(): void {
    this.destroyed = true;
    if (this.workerTimer) {
      clearTimeout(this.workerTimer);
      this.workerTimer = null;
    }
  }

  private scheduleWorker(delayMs: number): void {
    if (this.destroyed) return;
    this.workerTimer = setTimeout(() => {
      this.workerTimer = null;
      void this.runScheduledWorker();
    }, delayMs);
    this.workerTimer.unref();
  }

  private async runScheduledWorker(): Promise<void> {
    try {
      await this.processPending();
    } catch {
      this.logger.error('PostHog privacy deletion worker failed; retrying on the next interval.');
    } finally {
      this.scheduleWorker(WORKER_INTERVAL_MS);
    }
  }

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
    if (this.processing) return;
    this.processing = true;
    try {
      await this.processPendingBatch(limit);
    } finally {
      this.processing = false;
    }
  }

  private async processPendingBatch(limit: number): Promise<void> {
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
          SET attempts = request.attempts + 1,
              next_attempt_at = NOW() + ($2::int * INTERVAL '1 millisecond'),
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

  private async postHogFetch(
    config: PostHogConfig,
    url: string,
    init: PostHogRequestInit = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const { headers = {}, ...requestInit } = init;
    try {
      return await fetch(url, {
        ...requestInit,
        headers: { Authorization: `Bearer ${config.apiKey}`, ...headers },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchRequest(
    requestId: string,
    config: PostHogConfig,
  ): Promise<PostHogDeletionResponse | null> {
    try {
      const response = await this.postHogFetch(
        config,
        `${config.appHost}/api/projects/${encodeURIComponent(config.projectId)}/data_deletion_requests/${encodeURIComponent(requestId)}/`,
      );
      if (!response.ok) return null;
      return deletionResponse(await response.json());
    } catch {
      this.logger.warn('Could not read PostHog deletion status; the submitted request will be polled again.');
      return null;
    }
  }

  private async reconcileSubmission(
    submissionId: string,
    query: string,
    config: PostHogConfig,
  ): Promise<ReconciliationResult> {
    for (let page = 0; page < MAX_RECONCILIATION_PAGES; page += 1) {
      const offset = page * RECONCILIATION_PAGE_SIZE;
      try {
        const response = await this.postHogFetch(
          config,
          `${config.appHost}/api/projects/${encodeURIComponent(config.projectId)}/data_deletion_requests/?limit=${RECONCILIATION_PAGE_SIZE}&offset=${offset}`,
        );
        if (!response.ok) return { state: 'unavailable' };

        const results = deletionListItems(await response.json());
        if (results == null) return { state: 'unavailable' };
        const match = results.find((request) => matchesDeletionRequest(request, submissionId, query));
        if (match) return { state: 'found', request: match };
        if (results.length < RECONCILIATION_PAGE_SIZE) return { state: 'not_found' };
      } catch {
        this.logger.warn('Could not reconcile a PostHog deletion retry; destructive resubmission is deferred.');
        return { state: 'unavailable' };
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
      );
      return;
    }

    if (row.attempts > 1) {
      const reconciliation = await this.reconcileSubmission(row.submission_id, query, config);
      if (reconciliation.state === 'found' && reconciliation.request.id) {
        await this.markSubmitted(row.id, reconciliation.request.id);
        return;
      }
      if (reconciliation.state === 'unavailable') {
        await this.scheduleRetry(row.id, 'PostHog deletion retry reconciliation is unavailable.');
        return;
      }
    }

    try {
      const response = await this.postHogFetch(
        config,
        `${config.appHost}/api/projects/${encodeURIComponent(config.projectId)}/data_deletion_requests/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, submission_id: row.submission_id }),
        },
      );

      if (!response.ok) {
        await this.scheduleRetry(
          row.id,
          `PostHog deletion request rejected with HTTP ${response.status}`,
        );
        return;
      }

      const body = deletionResponse(await response.json());
      if (!body?.id || !UUID_RE.test(body.id)) {
        await this.scheduleRetry(
          row.id,
          'PostHog deletion response did not include a valid request id.',
        );
        return;
      }

      await this.markSubmitted(row.id, body.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown PostHog deletion error';
      await this.scheduleRetry(row.id, message);
    }
  }

  private async markSubmitted(id: string, providerRequestId: string): Promise<void> {
    await this.db.query(
      `UPDATE analytics_external_deletion_requests
          SET status = 'submitted', provider_request_id = $2::uuid,
              submitted_at = COALESCE(submitted_at, NOW()), updated_at = NOW(), last_error = NULL
        WHERE id = $1`,
      [id, providerRequestId],
    );
  }

  private async scheduleRetry(id: string, message: string): Promise<void> {
    const safeMessage = message.slice(0, 300);
    await this.db.query(
      `UPDATE analytics_external_deletion_requests
          SET status = 'failed',
              next_attempt_at = NOW() + ($2::int * INTERVAL '1 millisecond'),
              last_error = $3, updated_at = NOW()
        WHERE id = $1`,
      [id, RETRY_DELAY_MS, safeMessage],
    );
  }
}
