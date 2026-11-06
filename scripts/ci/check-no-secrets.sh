#!/usr/bin/env bash
# Fail-closed guard against committed credentials and private environment files.
set -uo pipefail

if ! ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "✗ Secret scan must run inside a Git worktree." >&2
  exit 2
fi
cd "$ROOT" || exit 2

FAIL=0
FORBIDDEN_NAMES=(
  ".env" ".env.local" ".env.production" ".env.development"
  "credentials.json" "service-account.json" "id_rsa" "id_ed25519"
)

while IFS= read -r file; do
  base="${file##*/}"
  for bad in "${FORBIDDEN_NAMES[@]}"; do
    if [[ "$base" == "$bad" ]]; then
      echo "✗ Forbidden tracked file: $file"
      FAIL=1
    fi
  done
done < <(git ls-files)

# git grep exits 0 for matches, 1 for no matches, >1 for errors.
PATTERN='AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|xox[baprs]-[0-9A-Za-z-]{10,}|ghp_[0-9A-Za-z]{36}|sk_live_[0-9A-Za-z]{20,}|-----BEGIN PGP PRI[V]ATE KEY'
if HITS="$(git grep -nEI "$PATTERN" -- \
  ':!pnpm-lock.yaml' \
  ':!**/package-lock.json' \
  ':!.env.example' \
  ':!**/.env.example' 2>&1)"; then
  FILTERED_HITS=""
  while IFS= read -r hit; do
    # Exempt only the published AWS documentation fixture in its redaction test.
    # Re-scan the line so any second credential remains a hard failure.
    if [[ "$hit" == apps/backend/src/common/sentry-scrub.spec.ts:* ]]; then
      knownAwsFixture='AKIA''IOSFODNN7EXAMPLE'
      hit="${hit//$knownAwsFixture/[known-aws-test-fixture]}"
    fi
    if [[ "$hit" =~ $PATTERN ]]; then
      FILTERED_HITS+="$hit"$'\n'
    fi
  done <<< "$HITS"
  if [[ -n "$FILTERED_HITS" ]]; then
    echo "✗ Possible secrets in tracked content:"
    printf '%s' "$FILTERED_HITS"
    FAIL=1
  fi
else
  GREP_STATUS=$?
  if [[ "$GREP_STATUS" -ne 1 ]]; then
    echo "✗ Secret content scan failed (git grep exit $GREP_STATUS):" >&2
    echo "$HITS" >&2
    FAIL=1
  fi
fi

ENV_HITS="$(git ls-files | grep -E '(^|/)\.env(\.|$)' | grep -v '\.env\.example$' || true)"
if [[ -n "$ENV_HITS" ]]; then
  echo "✗ Tracked .env files (use .env.example only):"
  echo "$ENV_HITS"
  FAIL=1
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "Secret/env scan failed. Remove leaked values and rotate affected credentials."
  exit 1
fi

echo "OK: no forbidden secrets / .env files detected in tracked files."
