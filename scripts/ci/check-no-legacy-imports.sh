#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# scripts/ci/check-no-legacy-imports.sh
#
# Belt-and-suspenders enforcement that nothing in apps/ or packages/ imports
# from legacy/. ESLint catches this too, but a grep check works even when
# ESLint config is misconfigured or skipped.
#
# Exits 0 if clean. Exits 1 (with output) if any offending line is found.
# ──────────────────────────────────────────────────────────────────────────────

set -uo pipefail

# Patterns that indicate an import from legacy/:
#   from "legacy/..."
#   from "../legacy/..." (any number of ../ prefixes)
#   from "@legacy/..." (in case anyone wires a tsconfig path)
#   require("legacy/...")
#   require("../legacy/...")
PATTERN="(from|require\()\s*['\"]([^'\"]*\/)?legacy\/[^'\"]+['\"]"

# Search apps/ and packages/, excluding node_modules and build outputs.
HITS=$(
  grep -rEn --color=never \
    --include='*.ts' \
    --include='*.tsx' \
    --include='*.js' \
    --include='*.jsx' \
    --include='*.mjs' \
    --include='*.cjs' \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir='.next' \
    "$PATTERN" \
    apps/ packages/ 2>/dev/null || true
)

if [[ -n "$HITS" ]]; then
  echo "✗ Imports from legacy/ are not allowed in apps/ or packages/."
  echo
  echo "Offending lines:"
  echo "$HITS"
  echo
  echo "Why: legacy/ is frozen pre-monorepo code. See legacy/README.md and STATUS.md."
  echo "Fix: port or rebuild the relevant piece into apps/, per its verdict in STATUS.md."
  exit 1
fi

echo "✓ No imports from legacy/ found in apps/ or packages/."
