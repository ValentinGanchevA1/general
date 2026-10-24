import {
  assertProductionCorsOrigins,
  corsOrigins,
  isCorsOriginAllowed,
} from './cors-origins';

describe('corsOrigins', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCorsOrigins = process.env.CORS_ORIGINS;
  const originalPublicWebOrigin = process.env.PUBLIC_WEB_ORIGIN;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalCorsOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = originalCorsOrigins;

    if (originalPublicWebOrigin === undefined) delete process.env.PUBLIC_WEB_ORIGIN;
    else process.env.PUBLIC_WEB_ORIGIN = originalPublicWebOrigin;
  });

  it('includes the browser preview origins outside production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.CORS_ORIGINS;
    delete process.env.PUBLIC_WEB_ORIGIN;

    expect(corsOrigins()).toEqual(expect.arrayContaining([
      'http://127.0.0.1:4174',
      'http://localhost:4174',
    ]));
  });

  it('uses configured CORS and public web origins in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://admin.nexa.example/';
    process.env.PUBLIC_WEB_ORIGIN = 'https://app.nexa.example/';

    expect(corsOrigins()).toEqual([
      'https://admin.nexa.example',
      'https://app.nexa.example',
    ]);
    expect(() => assertProductionCorsOrigins()).not.toThrow();
  });

  it('allows PUBLIC_WEB_ORIGIN to be the only production browser origin', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGINS;
    process.env.PUBLIC_WEB_ORIGIN = 'https://preview.nexa.example';

    expect(corsOrigins()).toEqual(['https://preview.nexa.example']);
    expect(isCorsOriginAllowed('https://preview.nexa.example/')).toBe(true);
    expect(() => assertProductionCorsOrigins()).not.toThrow();
  });

  it('fails closed when production has no configured origin', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGINS;
    delete process.env.PUBLIC_WEB_ORIGIN;

    expect(corsOrigins()).toEqual([]);
    expect(() => assertProductionCorsOrigins()).toThrow('PUBLIC_WEB_ORIGIN');
  });

  it('rejects insecure production origins', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGINS;
    process.env.PUBLIC_WEB_ORIGIN = 'http://app.nexa.example';

    expect(() => assertProductionCorsOrigins()).toThrow('must use HTTPS');
  });

  it('matches normalized configured origins exactly', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.nexa.example/';
    delete process.env.PUBLIC_WEB_ORIGIN;

    expect(isCorsOriginAllowed('https://app.nexa.example')).toBe(true);
    expect(isCorsOriginAllowed('https://evil.example')).toBe(false);
    expect(isCorsOriginAllowed(undefined)).toBe(false);
  });
});
