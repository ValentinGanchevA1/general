#!/usr/bin/env python3
"""
apply_discovery_fixes.py — G88 backend hardening (3 fixes)

Applies, idempotently and CRLF-safely, the three top findings from the
discovery/geo audit:

  FIX 1  main.ts              — Sentry `beforeSend`/`beforeBreadcrumb` PII scrubber (OB1)
  FIX 2  discovery.service.ts — OOM guard BEFORE h3.polygonToCells (area estimate)
  FIX 3  discovery.service.ts — deterministic `ORDER BY id` on the entity query
                                (kills nondeterministic truncation -> diff churn)

Run from the repo root, OR pass the repo path:

    python apply_discovery_fixes.py
    python apply_discovery_fixes.py "C:\\Users\\vganc\\g88"
    python3 apply_discovery_fixes.py /mnt/c/Users/vganc/g88     # WSL

Safe to run twice: each edit is skipped if already present, and aborts with a
clear message if its anchor can't be found exactly once (i.e. the file drifted
from what the audit read).
"""

import sys
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1 — main.ts : Sentry PII scrubber
# ─────────────────────────────────────────────────────────────────────────────

MAIN_1A_OLD = r"""loadEnv({ path: join(process.cwd(), '../../.env') });

Sentry.init({"""

MAIN_1A_NEW = r"""loadEnv({ path: join(process.cwd(), '../../.env') });

// ── Sentry PII scrubber (OB1) ───────────────────────────────────────────────
// Hard privacy invariant: coordinates, H3 cells, and tokens must never leave the
// process. Redacts denylisted keys anywhere in the event/breadcrumb and strips
// Bearer tokens from any string value. Fail-safe: over-redaction is acceptable.
const SENTRY_DENY_KEYS = new Set([
  'authorization', 'cookie', 'password', 'passwordhash',
  'token', 'idtoken', 'refreshtoken', 'accesstoken',
  'phone', 'email', 'latitude', 'longitude', 'lat', 'lng',
  'location', 'iddocumenturl',
]);
const SENTRY_BEARER_RE = /Bearer\s+[A-Za-z0-9._-]+/g;

function scrubSentry<T>(value: T, depth = 0): T {
  if (value == null || depth > 8) return value;
  if (typeof value === 'string') {
    return value.replace(SENTRY_BEARER_RE, 'Bearer [redacted]') as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrubSentry(v, depth + 1)) as unknown as T;
  }
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENTRY_DENY_KEYS.has(k.toLowerCase())
        ? '[redacted]'
        : scrubSentry(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}

Sentry.init({"""

MAIN_1B_OLD = r"""  // 10 % performance sampling in production; off in dev to keep noise low.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
});"""

MAIN_1B_NEW = r"""  // 10 % performance sampling in production; off in dev to keep noise low.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  beforeSend: (event) => scrubSentry(event),
  beforeBreadcrumb: (breadcrumb) => scrubSentry(breadcrumb),
});"""

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2 — discovery.service.ts : OOM guard before enumeration
# ─────────────────────────────────────────────────────────────────────────────

DISC_2CONST_OLD = r"""/** Hard cap to keep one viewport from returning a runaway payload. */
const MAX_POINTS_PER_RESPONSE = 500;"""

DISC_2CONST_NEW = r"""/** Hard cap to keep one viewport from returning a runaway payload. */
const MAX_POINTS_PER_RESPONSE = 500;

/** Upper bound on H3 cells a single viewport may span before we refuse it. */
const MAX_CELLS_PER_VIEWPORT = 5_000;

/**
 * Average H3 hexagon area (km²) per resolution. Used to estimate how many cells
 * a viewport spans WITHOUT enumerating them, so an oversized request is rejected
 * before h3.polygonToCells allocates. Source: H3 resolution table.
 */
const H3_CELL_AREA_KM2: Record<number, number> = {
  4: 1770.3, 5: 252.9, 6: 36.13, 7: 5.161, 8: 0.7373, 9: 0.1053, 10: 0.01504,
};"""

DISC_2GUARD_OLD = r"""    const resolution = h3ResolutionForZoom(params.zoom);
    const cells = cellsForViewport(params.viewport, resolution);"""

DISC_2GUARD_NEW = r"""    const resolution = h3ResolutionForZoom(params.zoom);

    // Guard BEFORE enumerating: a forged viewport (huge bbox + fine zoom) can make
    // h3.polygonToCells allocate millions of cells and OOM the process — which also
    // kills the in-process Socket.IO gateway. Reject using a cheap area estimate.
    if (this.estimateCellCount(params.viewport, resolution) > MAX_CELLS_PER_VIEWPORT) {
      this.logger.warn(
        `Viewport too large at r${resolution} (estimated cells exceed ${MAX_CELLS_PER_VIEWPORT}) — refusing`,
      );
      return this.empty(resolution, params.viewport, kinds, topicSlug);
    }

    const cells = cellsForViewport(params.viewport, resolution);"""

DISC_2METHOD_OLD = r"""  /** Strictly whitelist the H3 cell column name — never accept user input here. */
  private cellColumn(resolution: number): string {"""

DISC_2METHOD_NEW = r"""  /**
   * Cheap upper-bound estimate of how many H3 cells a viewport spans, from its
   * bounding-box area ÷ average cell area — no enumeration, so it can't OOM.
   */
  private estimateCellCount(viewport: Viewport, resolution: number): number {
    const KM_PER_DEG = 111.32;
    const midLatRad = ((viewport.ne.lat + viewport.sw.lat) / 2) * (Math.PI / 180);
    const latKm = Math.abs(viewport.ne.lat - viewport.sw.lat) * KM_PER_DEG;
    const lngKm = Math.abs(viewport.ne.lng - viewport.sw.lng) * KM_PER_DEG * Math.cos(midLatRad);
    const areaKm2 = latKm * lngKm;
    // Fall back to the smallest cell area (largest estimate) for unknown resolutions.
    const cellKm2 = H3_CELL_AREA_KM2[resolution] ?? 0.01504;
    return areaKm2 / cellKm2;
  }

  /** Strictly whitelist the H3 cell column name — never accept user input here. */
  private cellColumn(resolution: number): string {"""

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3 — discovery.service.ts : deterministic ORDER BY on the entity query
# ─────────────────────────────────────────────────────────────────────────────

DISC_3ORDER_OLD = r"""         ${topicSlug ? `AND ${TOPIC_MATCH_SQL('$5')}` : ''}
       LIMIT $4
      `,"""

DISC_3ORDER_NEW = r"""         ${topicSlug ? `AND ${TOPIC_MATCH_SQL('$5')}` : ''}
       ORDER BY id
       LIMIT $4
      `,"""

# ─────────────────────────────────────────────────────────────────────────────
# Edit tables: (name, old, new, idempotency_marker)
# ─────────────────────────────────────────────────────────────────────────────

EDITS = {
    "apps/backend/src/main.ts": [
        ("FIX 1a  Sentry scrubber helper", MAIN_1A_OLD, MAIN_1A_NEW, "function scrubSentry"),
        ("FIX 1b  beforeSend / beforeBreadcrumb", MAIN_1B_OLD, MAIN_1B_NEW,
         "beforeSend: (event) => scrubSentry(event)"),
    ],
    "apps/backend/src/modules/discovery/discovery.service.ts": [
        ("FIX 2   cell-count constants", DISC_2CONST_OLD, DISC_2CONST_NEW, "MAX_CELLS_PER_VIEWPORT = 5_000"),
        ("FIX 2   pre-enumeration guard", DISC_2GUARD_OLD, DISC_2GUARD_NEW,
         "this.estimateCellCount(params.viewport, resolution) > MAX_CELLS_PER_VIEWPORT"),
        ("FIX 2   estimateCellCount()", DISC_2METHOD_OLD, DISC_2METHOD_NEW, "private estimateCellCount("),
        ("FIX 3   ORDER BY id", DISC_3ORDER_OLD, DISC_3ORDER_NEW, "ORDER BY id\n       LIMIT $4"),
    ],
}


def patch_file(path: Path, edits) -> bool:
    if not path.is_file():
        print(f"  ✗ NOT FOUND: {path}")
        return False

    raw = path.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    text = raw.replace("\r\n", "\n")
    changed = False

    for name, old, new, marker in edits:
        if marker in text:
            print(f"  • {name}: already applied — skip")
            continue
        n = text.count(old)
        if n != 1:
            print(f"  ✗ {name}: anchor matched {n}× (expected 1) — ABORTING this file")
            print("     (file has drifted from the audited version; nothing written)")
            return False
        text = text.replace(old, new, 1)
        changed = True
        print(f"  ✓ {name}: applied")

    if changed:
        path.write_bytes(text.replace("\n", newline).encode("utf-8"))
        print(f"  → wrote {path.name} ({newline!r} line endings preserved)")
    return True


def main() -> int:
    repo = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else Path.cwd()
    probe = repo / "apps" / "backend" / "src" / "main.ts"
    if not probe.is_file():
        print(f"✗ This doesn't look like the g88 repo root: {repo}")
        print("  Run from the repo root, or pass it explicitly, e.g.:")
        print('    python apply_discovery_fixes.py "C:\\Users\\vganc\\g88"')
        return 1

    print(f"g88 repo: {repo}\n")
    ok = True
    for rel, edits in EDITS.items():
        print(f"{rel}")
        ok = patch_file(repo / rel, edits) and ok
        print()

    if ok:
        print("Done. Next:")
        print("  pnpm --filter @g88/backend typecheck   # or: tsc --noEmit")
        print("  pnpm --filter @g88/backend test")
        print("  pnpm --filter @g88/backend exec eslint src --max-warnings 0")
    else:
        print("⚠ One or more files were skipped — see messages above. No partial writes.")
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
