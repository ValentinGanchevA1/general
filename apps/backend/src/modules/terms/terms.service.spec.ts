import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { TermsService } from './terms.service';

describe('TermsService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const keys = ['NEXUS_TERMS_VERSION', 'NEXUS_TERMS_URL', 'NEXUS_REQUIRE_UGC_TERMS'] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const db = { query: jest.fn() };
  const service = new TermsService(db as never);

  beforeEach(() => {
    for (const key of keys) delete process.env[key];
    db.query.mockReset();
  });
  afterAll(() => {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const configure = (): void => {
    process.env.NEXUS_TERMS_VERSION = '2026-11-v1';
    process.env.NEXUS_TERMS_URL = 'https://g88-legal.onrender.com/terms';
  };

  it('does not infer agreement or enable enforcement before legal publication', async () => {
    await expect(service.status(userId)).resolves.toMatchObject({
      configured: false, accepted: false, required: false, version: null,
    });
    await expect(service.accept(userId, '2026-11-v1', true, 'mobile'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.assertAccepted(userId)).resolves.toBeUndefined();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('fails closed when enforcement is true but the approved Terms URL is missing', async () => {
    process.env.NEXUS_REQUIRE_UGC_TERMS = 'true';
    await expect(service.assertAccepted(userId)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.status(userId)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects a configuration that incorrectly links Terms to Privacy', async () => {
    configure();
    process.env.NEXUS_TERMS_URL = 'https://g88-legal.onrender.com/privacy';
    process.env.NEXUS_REQUIRE_UGC_TERMS = 'true';
    await expect(service.assertAccepted(userId)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('returns the version and requires acceptance when enforcement is enabled', async () => {
    configure();
    process.env.NEXUS_REQUIRE_UGC_TERMS = 'true';
    db.query.mockResolvedValueOnce([]);
    await expect(service.status(userId)).resolves.toMatchObject({
      configured: true, enforcementEnabled: true, required: true,
      accepted: false, version: '2026-11-v1',
    });
    db.query.mockResolvedValueOnce([]);
    await expect(service.assertAccepted(userId)).rejects.toBeInstanceOf(ForbiddenException);
    db.query.mockResolvedValueOnce([{ accepted_at: new Date() }]);
    await expect(service.assertAccepted(userId)).resolves.toBeUndefined();
  });

  it('requires exact current policy and affirmative consent before persistence', async () => {
    configure();
    await expect(service.accept(userId, '2025-legacy', true, 'api')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.accept(userId, '2026-11-v1', false as never, 'api')).rejects.toBeInstanceOf(BadRequestException);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('records version-specific acceptance using authenticated principal and immutable timestamp', async () => {
    configure();
    const timestamp = new Date('2026-11-07T12:00:00.000Z');
    db.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ accepted_at: timestamp }]);
    await expect(service.accept(userId, '2026-11-v1', true, 'mobile'))
      .resolves.toEqual({ accepted: true, version: '2026-11-v1', acceptedAt: timestamp.toISOString() });
    expect(db.query.mock.calls[0]?.[0]).toContain('ON CONFLICT (user_id,terms_version) DO NOTHING');
    expect(db.query.mock.calls[0]?.[1]).toEqual([userId, '2026-11-v1', 'mobile']);
  });

  it('enforces a new Terms version even after accepting the old version', async () => {
    configure();
    process.env.NEXUS_REQUIRE_UGC_TERMS = 'true';
    db.query.mockResolvedValueOnce([]);
    await expect(service.assertAccepted(userId)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'terms.acceptance_required', version: '2026-11-v1' }),
    });
  });
});
