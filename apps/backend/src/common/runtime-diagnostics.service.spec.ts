import {
  formatRuntimeResourceSnapshot,
  type RuntimeResourceSnapshot,
} from './runtime-diagnostics.service';

describe('runtime diagnostics', () => {
  it('formats only the bounded low-cardinality resource fields', () => {
    const snapshot: RuntimeResourceSnapshot = {
      rssMiB: 126.7,
      heapUsedMiB: 48.2,
      heapTotalMiB: 67.5,
      externalMiB: 8.4,
      arrayBuffersMiB: 3.1,
      maxRssMiB: 131.2,
      sockets: 4,
      uptimeSec: 123,
    };

    expect(formatRuntimeResourceSnapshot(snapshot)).toBe(
      'runtime_resources rss_mib=126.7 heap_used_mib=48.2 heap_total_mib=67.5 ' +
        'external_mib=8.4 array_buffers_mib=3.1 max_rss_mib=131.2 sockets=4 uptime_sec=123',
    );
  });
});
