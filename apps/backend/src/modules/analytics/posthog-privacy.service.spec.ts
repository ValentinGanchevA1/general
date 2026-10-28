import type { DataSource } from 'typeorm';
import { PRODUCT_ANALYTICS_EVENTS } from '@g88/shared';

import {
  PostHogPrivacyService,
  buildPostHogRetentionDeletionQuery,
  buildPostHogSubjectDeletionQuery,
} from './posthog-privacy.service';

describe('PostHog privacy deletion queries', () => {
  const subjectHash = 'a'.repeat(64);

  it('targets a pseudonymous distinct_id without raw account identifiers', () => {
    const query = buildPostHogSubjectDeletionQuery(subjectHash);

    expect(query).toContain(`distinct_id = '${subjectHash}'`);
    expect(query).toContain('SELECT uuid FROM events');
    expect(query).not.toMatch(/email|phone|location|verification|user_id/i);
  });

  it('rejects anything that is not a canonical HMAC subject hash', () => {
    expect(() => buildPostHogSubjectDeletionQuery('user@example.com')).toThrow(
      'Invalid analytics subject hash.',
    );
  });

  it('limits retention deletion to the canonical NEXA analytics taxonomy', () => {
    const cutoff = new Date('2026-07-29T00:00:00.000Z');
    const query = buildPostHogRetentionDeletionQuery(cutoff);

    expect(query).toContain("timestamp < toDateTime('2026-07-29T00:00:00.000Z')");
    for (const event of PRODUCT_ANALYTICS_EVENTS) expect(query).toContain(`'${event}'`);
    expect(query).not.toMatch(/email|phone|latitude|longitude|verification|user_id/i);
  });

  it('rejects an invalid retention cutoff', () => {
    expect(() => buildPostHogRetentionDeletionQuery(new Date('invalid'))).toThrow(
      'Invalid analytics retention cutoff.',
    );
  });
});

describe('PostHogPrivacyService worker coordination', () => {
  const envKeys = [
    'POSTHOG_PRIVACY_ENABLED',
    'POSTHOG_DELETION_QUERY_VERIFIED',
    'POSTHOG_PERSONAL_API_KEY',
    'POSTHOG_PROJECT_ID',
    'POSTHOG_APP_HOST',
  ] as const;
  const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

  function enableWorker(): void {
    process.env.POSTHOG_PRIVACY_ENABLED = 'true';
    process.env.POSTHOG_DELETION_QUERY_VERIFIED = 'true';
    process.env.POSTHOG_PERSONAL_API_KEY = 'test-private-key';
    process.env.POSTHOG_PROJECT_ID = '123';
    process.env.POSTHOG_APP_HOST = 'https://eu.posthog.com';
  }

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of envKeys) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('claims due rows atomically and persists attempt intent before external I/O', async () => {
    enableWorker();
    const query = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const db = { query } as unknown as DataSource;
    const service = new PostHogPrivacyService(db);

    await service.processPending(10);

    expect(query).toHaveBeenCalledTimes(2);
    const [claimSql, claimParams] = query.mock.calls[1]!;
    expect(String(claimSql)).toContain('FOR UPDATE SKIP LOCKED');
    expect(String(claimSql)).toContain('UPDATE analytics_external_deletion_requests AS request');
    expect(String(claimSql)).toContain('attempts = request.attempts + 1');
    expect(String(claimSql)).toContain('RETURNING request.id');
    expect(claimParams).toEqual([10, 10 * 60 * 1_000]);
  });

  it('reconciles a previously claimed submission before retrying a destructive POST', async () => {
    enableWorker();
    const rowId = '11111111-1111-4111-8111-111111111111';
    const submissionId = '22222222-2222-4222-8222-222222222222';
    const providerRequestId = '33333333-3333-4333-8333-333333333333';
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: rowId,
          kind: 'subject',
          subject_hash: 'a'.repeat(64),
          cutoff_at: null,
          submission_id: submissionId,
          attempts: 2,
        },
      ])
      .mockResolvedValueOnce([]);
    const db = { query } as unknown as DataSource;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            id: providerRequestId,
            submission_id: submissionId,
            status: 'draft',
          },
        ],
      }),
    } as Response);
    const service = new PostHogPrivacyService(db);

    await service.processPending();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]![1]?.method).toBeUndefined();
    const [updateSql, updateParams] = query.mock.calls[2]!;
    expect(String(updateSql)).toContain("SET status = 'submitted'");
    expect(updateParams).toEqual([rowId, providerRequestId]);
  });

  it('accepts a raw-array response and reconciles by exact query when submission_id is absent', async () => {
    enableWorker();
    const rowId = '11111111-1111-4111-8111-111111111111';
    const submissionId = '22222222-2222-4222-8222-222222222222';
    const providerRequestId = '33333333-3333-4333-8333-333333333333';
    const subjectHash = 'a'.repeat(64);
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: rowId,
          kind: 'subject',
          subject_hash: subjectHash,
          cutoff_at: null,
          submission_id: submissionId,
          attempts: 2,
        },
      ])
      .mockResolvedValueOnce([]);
    const db = { query } as unknown as DataSource;
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: providerRequestId,
          query: buildPostHogSubjectDeletionQuery(subjectHash),
          status: 'draft',
        },
      ],
    } as Response);
    const service = new PostHogPrivacyService(db);

    await service.processPending();

    expect(query.mock.calls[2]![1]).toEqual([rowId, providerRequestId]);
  });

  it('defers a retry when reconciliation is unavailable instead of risking a duplicate POST', async () => {
    enableWorker();
    const rowId = '11111111-1111-4111-8111-111111111111';
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: rowId,
          kind: 'subject',
          subject_hash: 'a'.repeat(64),
          cutoff_at: null,
          submission_id: '22222222-2222-4222-8222-222222222222',
          attempts: 2,
        },
      ])
      .mockResolvedValueOnce([]);
    const db = { query } as unknown as DataSource;
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network unavailable'));
    const service = new PostHogPrivacyService(db);

    await service.processPending();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [retrySql, retryParams] = query.mock.calls[2]!;
    expect(String(retrySql)).toContain("SET status = 'failed'");
    expect(retryParams).toEqual([
      rowId,
      60 * 60 * 1_000,
      'PostHog deletion retry reconciliation is unavailable.',
    ]);
  });

  it('fails closed on an unknown deletion-list response envelope', async () => {
    enableWorker();
    const rowId = '11111111-1111-4111-8111-111111111111';
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: rowId,
          kind: 'subject',
          subject_hash: 'a'.repeat(64),
          cutoff_at: null,
          submission_id: '22222222-2222-4222-8222-222222222222',
          attempts: 2,
        },
      ])
      .mockResolvedValueOnce([]);
    const db = { query } as unknown as DataSource;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response);
    const service = new PostHogPrivacyService(db);

    await service.processPending();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[2]![1]).toEqual([
      rowId,
      60 * 60 * 1_000,
      'PostHog deletion retry reconciliation is unavailable.',
    ]);
  });
});
