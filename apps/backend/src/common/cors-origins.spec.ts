import {
  assertProductionCorsOrigins,
  corsOrigins,
  isCorsOriginAllowed,
} from './cors-origins';

describe('corsOrigins', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCorsOrigins = process.env.CORS_ORIGINS;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalCorsOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = originalCorsOrigins;
  });

  it('includes the browser preview origins outside production', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.CORS_ORIGINS;

    expect(corsOrigins()).toEqual(expect.arrayContaining([
      'http://127.0.0.1:4174',
      'http://localhost:4174',
    ]));
  });

  it('uses only explicitly configured origins in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.nexa.example, https://admin.nexa.example/';

    expect(corsOrigins()).toEqual([
      'https://app.nexa.example',
      'https://admin.nexa.example',
    ]);
    expect(() => assertProductionCorsOrigins()).not.toThrow();
  });

  it('fails closed when production has no configured origin', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGINS;

    expect(corsOrigins()).toEqual([]);
    expect(() => assertProductionCorsOrigins()).toThrow('CORS_ORIGINS');
  });

  it('rejects insecure production origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'http://app.nexa.example';

    expect(() => assertProductionCorsOrigins()).toThrow('must use HTTPS');
  });

  it('matches normalized configured origins exactly', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://app.nexa.example/';

    expect(isCorsOriginAllowed('https://app.nexa.example')).toBe(true);
    expect(isCorsOriginAllowed('https://evil.example')).toBe(false);
    expect(isCorsOriginAllowed(undefined)).toBe(false);
  });
});
