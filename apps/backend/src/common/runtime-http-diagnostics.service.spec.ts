import { RuntimeHttpDiagnosticsService } from './runtime-http-diagnostics.service';

describe('RuntimeHttpDiagnosticsService', () => {
  let service: RuntimeHttpDiagnosticsService;

  beforeEach(() => {
    service = new RuntimeHttpDiagnosticsService();
  });

  it('aggregates completed responses by status class without request metadata', () => {
    service.beginRequest().finish(204);
    service.beginRequest().finish(302);
    service.beginRequest().finish(404);
    service.beginRequest().finish(503);
    service.beginRequest().finish(700);

    expect(service.snapshotAndReset()).toEqual({
      completed: 5,
      status2xx: 1,
      status3xx: 1,
      status4xx: 1,
      status5xx: 1,
      statusOther: 1,
      aborted: 0,
      inflight: 0,
    });
  });

  it('counts an aborted connection without inventing an HTTP status', () => {
    const request = service.beginRequest();
    request.abort();

    expect(service.snapshotAndReset()).toEqual({
      completed: 0,
      status2xx: 0,
      status3xx: 0,
      status4xx: 0,
      status5xx: 0,
      statusOther: 0,
      aborted: 1,
      inflight: 0,
    });
  });

  it('settles each request only once', () => {
    const request = service.beginRequest();
    request.finish(200);
    request.abort();
    request.finish(500);

    expect(service.snapshotAndReset()).toEqual({
      completed: 1,
      status2xx: 1,
      status3xx: 0,
      status4xx: 0,
      status5xx: 0,
      statusOther: 0,
      aborted: 0,
      inflight: 0,
    });
  });

  it('resets window counters while preserving active inflight requests', () => {
    const active = service.beginRequest();
    service.beginRequest().finish(200);

    expect(service.snapshotAndReset()).toEqual({
      completed: 1,
      status2xx: 1,
      status3xx: 0,
      status4xx: 0,
      status5xx: 0,
      statusOther: 0,
      aborted: 0,
      inflight: 1,
    });

    expect(service.snapshotAndReset()).toEqual({
      completed: 0,
      status2xx: 0,
      status3xx: 0,
      status4xx: 0,
      status5xx: 0,
      statusOther: 0,
      aborted: 0,
      inflight: 1,
    });

    active.finish(201);
    expect(service.snapshotAndReset()).toEqual({
      completed: 1,
      status2xx: 1,
      status3xx: 0,
      status4xx: 0,
      status5xx: 0,
      statusOther: 0,
      aborted: 0,
      inflight: 0,
    });
  });
});
