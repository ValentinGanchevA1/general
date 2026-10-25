import { createHmac } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import type { DataSource } from 'typeorm';

import { AnalyticsService, sanitizeProductAnalyticsProperties } from './analytics.service';

const HMAC_KEY = 'analytics-test-key-that-is-at-least-32-bytes-long';

describe('AnalyticsService', () => {
  const query = jest.fn();
  const db = { query } as unknown as DataSource;
  const service = new AnalyticsService(db);
  const originalKey = process.env.ANALYTICS_HMAC_KEY;

  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue([]);
    process.env.ANALYTICS_HMAC_KEY = HMAC_KEY;
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.ANALYTICS_HMAC_KEY;
    else process.env.ANALYTICS_HMAC_KEY = originalKey;
  });

  it('keeps only allow-listed low-cardinality properties', () => {
    expect(
      sanitizeProductAnalyticsProperties('entity.opened', {
        entityType: 'person',
        surface: 'map',
        userId: 'raw-user-id',
        lat: 43.2,
        body: 'free text',
      }),
    ).toEqual({ entityType: 'person', surface: 'map' });

    expect(
      sanitizeProductAnalyticsProperties('interaction.wave_sent', {
        mutual: true,
        surface: 'map',
        recipientId: 'peer-id',
      }),
    ).toEqual({ mutual: true, surface: 'map' });
  });

  it('stores a server-derived pseudonymous subject instead of a raw user id in the event row', async () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const expectedHash = createHmac('sha256', HMAC_KEY).update(userId).digest('hex');

    await service.record(userId, 'event.rsvp_confirmed', {
      status: 'going',
      eventId: 'must-not-persist',
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [, params] = query.mock.calls[0]!;
    expect(params).toEqual([
      userId,
      expectedHash,
      'event.rsvp_confirmed',
      JSON.stringify({ status: 'going' }),
    ]);
  });

  it('fails closed when the dedicated analytics HMAC key is absent', async () => {
    delete process.env.ANALYTICS_HMAC_KEY;

    await expect(service.record('user-1', 'app.session_started')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(query).not.toHaveBeenCalled();
  });
});
