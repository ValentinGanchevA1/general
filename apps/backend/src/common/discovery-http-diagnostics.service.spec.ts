import { EventEmitter } from 'node:events';

import {
  DiscoveryHttpDiagnosticsService,
  discoveryHttpLane,
  formatDiscoveryHttpWindow,
} from './discovery-http-diagnostics.service';

class FakeResponse extends EventEmitter {
  statusCode = 200;
}

describe('DiscoveryHttpDiagnosticsService', () => {
  let service: DiscoveryHttpDiagnosticsService;

  beforeEach(() => {
    service = new DiscoveryHttpDiagnosticsService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    service.onApplicationShutdown();
  });

  it('allows only the two exact POST routes', () => {
    expect(discoveryHttpLane({ method: 'POST', path: '/api/v1/discovery/nearby' })).toBe('nearby');
    expect(discoveryHttpLane({ method: 'POST', path: '/api/v1/discovery/places' })).toBe('places');
    expect(discoveryHttpLane({ method: 'GET', path: '/api/v1/discovery/nearby' })).toBeNull();
    expect(discoveryHttpLane({ method: 'POST', path: '/api/v1/discovery/nearby/123' })).toBeNull();
    expect(discoveryHttpLane({ method: 'POST', path: '/api/v1/users/me' })).toBeNull();
  });

  it('captures successful responses and guard-level 429 separately for each lane', () => {
    const near = new FakeResponse();
    const placesThrottle = new FakeResponse();
    const placesError = new FakeResponse();

    near.statusCode = 200;
    placesThrottle.statusCode = 429;
    placesError.statusCode = 503;

    service.observe({ method: 'POST', path: '/api/v1/discovery/nearby' }, near);
    service.observe({ method: 'POST', path: '/api/v1/discovery/places' }, placesThrottle);
    service.observe({ method: 'POST', path: '/api/v1/discovery/places' }, placesError);

    near.emit('finish');
    placesThrottle.emit('finish');
    placesError.emit('finish');

    const snapshot = service.snapshotAndReset();
    expect(snapshot.nearby).toMatchObject({
      completed: 1, status2xx: 1, status429: 0, status5xx: 0, aborted: 0,
    });
    expect(snapshot.places).toMatchObject({
      completed: 2, status2xx: 0, status429: 1, status5xx: 1, aborted: 0,
    });
    expect(near.listenerCount('close')).toBe(0);
    expect(placesThrottle.listenerCount('finish')).toBe(0);
  });

  it('records abort once, without confusing it with a completed response', () => {
    const response = new FakeResponse();
    service.observe({ method: 'POST', path: '/api/v1/discovery/nearby' }, response);
    response.emit('close');
    response.emit('finish');
    expect(service.snapshotAndReset().nearby).toMatchObject({
      completed: 0, aborted: 1, inflight: 0,
    });
  });

  it('keeps inflight across window resets and attributes completion to the next window', () => {
    const response = new FakeResponse();
    service.observe({ method: 'POST', path: '/api/v1/discovery/nearby' }, response);
    expect(service.snapshotAndReset().nearby).toMatchObject({ completed: 0, inflight: 1 });
    response.emit('finish');
    expect(service.snapshotAndReset().nearby).toMatchObject({ completed: 1, inflight: 0 });
  });

  it('counts latency exceeding five seconds without storing per-request timings', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(5_201);
    const response = new FakeResponse();
    service.observe({ method: 'POST', path: '/api/v1/discovery/places' }, response);
    response.emit('finish');
    expect(service.snapshotAndReset().places.slowOver5s).toBe(1);
    expect(clock).toHaveBeenCalledTimes(2);
  });

  it('formats only bounded aggregate keys and values', () => {
    const response = new FakeResponse();
    service.observe({ method: 'POST', path: '/api/v1/discovery/places' }, response);
    response.statusCode = 400;
    response.emit('finish');
    const text = formatDiscoveryHttpWindow(service.snapshotAndReset());
    expect(text).toContain('places_4xx_other=1');
    expect(text).toContain('nearby_completed=0');
    expect(text).not.toContain('/api/');
    expect(text).not.toContain('userId');
    expect(text).not.toContain('lat=');
  });
});
