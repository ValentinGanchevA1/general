import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok with uptime and an ISO timestamp', () => {
    const res = new HealthController().check();

    expect(res.status).toBe('ok');
    expect(typeof res.uptime).toBe('number');
    expect(res.uptime).toBeGreaterThanOrEqual(0);
    expect(() => new Date(res.timestamp).toISOString()).not.toThrow();
    expect(new Date(res.timestamp).toISOString()).toBe(res.timestamp);
  });
});