#!/usr/bin/env python3
"""
fix_discovery_oom_threshold.py — follow-up to apply_discovery_fixes.py

The FIX 2 OOM guard used the same 5_000 number as the existing post-enumeration
UX cap. That number is far too low for a *pre-enumeration area estimate*: the
discovery unit tests drive a 1°x1° viewport at (mocked) H3 r8, which estimates
~16.8k cells — so the guard returned empty before the DB query ran, failing the
10 query/diff tests.

Fix: the estimate guard is an OOM bound, not the UX cap. Raise it to 200_000
(~30 MB worst-case allocation). The precise UX limit stays the existing
`cells.length > 5_000` post-enumeration check below it.

Run from the repo root (or pass the path):
    python fix_discovery_oom_threshold.py
    python fix_discovery_oom_threshold.py "C:\\Users\\vganc\\g88"
"""

import sys
from pathlib import Path

OLD = r"""/** Upper bound on H3 cells a single viewport may span before we refuse it. */
const MAX_CELLS_PER_VIEWPORT = 5_000;"""

NEW = r"""/**
 * Pre-allocation OOM bound — NOT the UX cap. The UX limit is the existing
 * `cells.length > 5_000` post-enumeration check below. This estimate-based guard
 * only refuses a viewport so large that h3.polygonToCells would allocate enough
 * cell-ids to threaten the process (~200k ids ≈ 30 MB). Real clients pair large
 * viewports with coarse resolutions, so they never approach this; only a forged
 * (huge bbox + fine zoom) request does.
 */
const MAX_CELLS_PER_VIEWPORT = 200_000;"""

MARKER = "MAX_CELLS_PER_VIEWPORT = 200_000"

REL = "apps/backend/src/modules/discovery/discovery.service.ts"


def main() -> int:
    repo = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else Path.cwd()
    path = repo / REL
    if not path.is_file():
        print(f"✗ Not found: {path}")
        print("  Run from the repo root, or pass it explicitly:")
        print('    python fix_discovery_oom_threshold.py "C:\\Users\\vganc\\g88"')
        return 1

    raw = path.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    text = raw.replace("\r\n", "\n")

    if MARKER in text:
        print("• already applied — nothing to do")
        return 0

    n = text.count(OLD)
    if n != 1:
        print(f"✗ anchor matched {n}x (expected 1) — file drifted; nothing written")
        if n == 0:
            print("  (did apply_discovery_fixes.py run? the FIX 2 constant block must be present)")
        return 2

    text = text.replace(OLD, NEW, 1)
    path.write_bytes(text.replace("\n", newline).encode("utf-8"))
    print(f"✓ raised MAX_CELLS_PER_VIEWPORT 5_000 -> 200_000 in {path.name}")
    print(f"  ({newline!r} line endings preserved)")
    print("\nNext: pnpm --filter @g88/backend test")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
