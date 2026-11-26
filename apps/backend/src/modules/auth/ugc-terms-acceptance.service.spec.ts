import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  configuredUgcTerms,
  UgcTermsAcceptanceService,
  ugcTermsAcceptanceEnabled,
} from './ugc-terms-acceptance.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const VERSION = '1.0';
const SHA256 = 'a'.repeat(64);

describe('UGC Terms acceptance', () => {
  const previous = {
    required: process.env.NEXUS_REQUIRE_UGC_TERMS,
    version: process.env.NEXUS_TERMS_VERSION,
    hash: process.env.NEXUS_TERMS_SHA256,
  };

  afterEach(() => {
    if (previous.required === undefined) delete process.env.NEXUS_REQUIRE_UGC_TERMS;
    else process.env.NEXUS_REQUIRE_UGC_TERMS = previous.required;
    if (previous.version === undefined) delete process.env.NEXUS_TERMS_VERSION;
    else process.env.NEXUS_TERMS_VERSION = previous.version;
    if (previous.hash === undefined) delete process.env.NEXUS_TERMS_SHA256;
    else process.env.NEXUS_TERMS_SHA256 = previous.hash;
  });

  it('keeps enforcement opt-in and does not require legal config while disabled', async () => {
    delete process.env.NEXUS_REQUIRE_UGC_TERMS;
    delete process.env.NEXUS_TERMS_VERSION;
    delete process.env.NEXUS_TERMS_SHA256;
    const query = jest.fn();
    const service = new UgcTermsAcceptanceService({ query } as unknown as DataSource);

    expect(ugcTermsAcceptanceEnabled()).toBe(false);
    await expect(service.status(USER_ID)).resolves.toEqual({
      required: false,
      accepted: true,
      termsVersion: null,
      termsSha256: null,
      acceptedAt: null,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('fails closed when enforcement is on without a versioned content hash', () => {
    process.env.NEXUS_REQUIRE_UGC_TERMS = 'true';
    delete process.env.NEXUS_TERMS_VERSION;
    delete process.env.NEXUS_TERMS_SHA256;
    expect(() => configuredUgcTerms()).toThrow(ServiceUnavailableException);
  });

  it('reports an unaccepted current version and accepts only the configured version/hash', async () => {
    process.env.NEXUS_REQUIRE_UGC_TERMS = 'true';
    process.env.NEXUS_TERMS_VERSION = VERSION;
    process.env.NEXUS_TERMS_SHA256 = SHA256;
    const query = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        terms_sha256: SHA256,
        accepted_at: new Date('2026-11-26T12:00:00Z'),
      }]);
    const service = new UgcTermsAcceptanceService({ query } as unknown as DataSource);

    await expect(service.status(USER_ID)).resolves.toMatchObject({
      required: true,
      accepted: false,
      termsVersion: VERSION,
      termsSha256: SHA256,
      acceptedAt: null,
    });
    await expect(service.accept(USER_ID, {
      accepted: true,
      termsVersion: VERSION,
      termsSha256: SHA256,
    })).resolves.toMatchObject({
      required: true,
      accepted: true,
      termsVersion: VERSION,
      termsSha256: SHA256,
      acceptedAt: '2026-11-26T12:00:00.000Z',
    });
    expect(query.mock.calls[1]?.[1]).toEqual([USER_ID, VERSION, SHA256]);
  });

  it('rejects stale client versions and refuses a reused version with a different hash', async () => {
    process.env.NEXUS_REQUIRE_UGC_TERMS = 'true';
    process.env.NEXUS_TERMS_VERSION = VERSION;
    process.env.NEXUS_TERMS_SHA256 = SHA256;
    const query = jest.fn().mockResolvedValueOnce([]);
    const service = new UgcTermsAcceptanceService({ query } as unknown as DataSource);

    await expect(service.accept(USER_ID, {
      accepted: true,
      termsVersion: '0.9',
      termsSha256: SHA256,
    })).rejects.toBeInstanceOf(ConflictException);

    const mismatch = new UgcTermsAcceptanceService({
      query: jest.fn().mockResolvedValueOnce([{
        terms_sha256: 'b'.repeat(64),
        accepted_at: new Date(),
      }]),
    } as unknown as DataSource);
    await expect(mismatch.status(USER_ID)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
