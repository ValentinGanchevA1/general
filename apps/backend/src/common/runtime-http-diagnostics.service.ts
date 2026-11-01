import { Injectable } from '@nestjs/common';

export interface RuntimeHttpWindowSnapshot {
  completed: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  statusOther: number;
  aborted: number;
  inflight: number;
}

export interface RuntimeHttpRequestHandle {
  finish(statusCode: number): void;
  abort(): void;
}

@Injectable()
export class RuntimeHttpDiagnosticsService {
  private completed = 0;
  private status2xx = 0;
  private status3xx = 0;
  private status4xx = 0;
  private status5xx = 0;
  private statusOther = 0;
  private aborted = 0;
  private inflight = 0;

  beginRequest(): RuntimeHttpRequestHandle {
    this.inflight += 1;
    let settled = false;

    const settle = (): boolean => {
      if (settled) return false;
      settled = true;
      this.inflight = Math.max(0, this.inflight - 1);
      return true;
    };

    return {
      finish: (statusCode: number): void => {
        if (!settle()) return;
        this.completed += 1;
        this.recordStatus(statusCode);
      },
      abort: (): void => {
        if (!settle()) return;
        this.aborted += 1;
      },
    };
  }

  snapshotAndReset(): RuntimeHttpWindowSnapshot {
    const snapshot: RuntimeHttpWindowSnapshot = {
      completed: this.completed,
      status2xx: this.status2xx,
      status3xx: this.status3xx,
      status4xx: this.status4xx,
      status5xx: this.status5xx,
      statusOther: this.statusOther,
      aborted: this.aborted,
      inflight: this.inflight,
    };

    this.completed = 0;
    this.status2xx = 0;
    this.status3xx = 0;
    this.status4xx = 0;
    this.status5xx = 0;
    this.statusOther = 0;
    this.aborted = 0;

    return snapshot;
  }

  private recordStatus(statusCode: number): void {
    if (!Number.isInteger(statusCode)) {
      this.statusOther += 1;
      return;
    }
    if (statusCode >= 200 && statusCode < 300) {
      this.status2xx += 1;
      return;
    }
    if (statusCode >= 300 && statusCode < 400) {
      this.status3xx += 1;
      return;
    }
    if (statusCode >= 400 && statusCode < 500) {
      this.status4xx += 1;
      return;
    }
    if (statusCode >= 500 && statusCode < 600) {
      this.status5xx += 1;
      return;
    }
    this.statusOther += 1;
  }
}
