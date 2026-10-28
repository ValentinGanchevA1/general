import { PRODUCT_ANALYTICS_EVENTS } from '@g88/shared';

import {
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
