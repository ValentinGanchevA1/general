#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# scripts/ci/check-no-donotcommit-markers.sh
#
# Fails the build if committed source under apps/ or packages/ contains a
# "temporary, do not ship" marker. These are dev-preview / debugging hacks meant
# to be reverted before commit — when they slip through they cause real bugs.
#
# Concrete example this guards against: a "TEMP-DEV-PREVIEW … Revert before
# commit" block in AppNavigator that registered About as the launcher for
# logged-out users, breaking back navigation ("GO_BACK was not handled by any
# navigator"). See the fix in commit history (apps/mobile AppNavigator).
#
# Exits 0 if clean. Exits 1 (with output) if any marker is found.
# ──────────────────────────────────────────────────────────────────────────────

set -uo pipefail

# Case-insensitive markers that should never reach a committed branch.
# Kept deliberately narrow to avoid flagging legitimate "TODO"/"FIXME" notes.
PATTERN="TEMP-DEV-PREVIEW|REVERT BEFORE COMMIT|DO NOT COMMIT|DO NOT SHIP|DONOTCOMMIT"

HITS=$(
  grep -rEni --color=never \
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
  echo "✗ Found 'do not commit' / dev-preview markers in committed source."
  echo
  echo "Offending lines:"
  echo "$HITS"
  echo
  echo "Why: these mark temporary hacks meant to be reverted before commit."
  echo "Fix: revert the temporary change, or remove the marker if the code is"
  echo "     actually meant to ship."
  exit 1
fi

echo "✓ No dev-preview / do-not-commit markers found in apps/ or packages/."
