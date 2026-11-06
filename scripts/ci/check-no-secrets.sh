#!/usr/bin/env bash
# scripts/ci/check-no-secrets.sh
# Hard gate: fail if tracked files contain known secrets / private keys / env dumps.
set -uo pipefail

if ! ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "✗ Secret scan must run inside a Git worktree." >&2
  exit 2
fi
cd "$ROOT" || exit 2

FAIL=0

# 1) Tracked files that must never be committed.
FORBIDDEN_NAMES=(
  ".env"
  ".env.local"
  ".env.production"
  ".env.development"
  "credentials.json"
  "service-account.json"
  "id_rsa"
  "id_ed25519"
)
while IFS= read -r f; do
  base=$(basename "$f")
  for bad in "${FORBIDDEN_NAMES[@]}"; do
    if [[ "$base" == "$bad" ]]; then
      echo "✗ Forbidden tracked file: $f"
      FAIL=1
    fi
  done
done < <(git ls-files)

# 2) Content patterns across tracked files (including docs and Markdown).
# Git grep: 0=matches, 1=no matches, >1=error. Errors MUST fail closed.
# Exclude generated lockfiles and deliberately public env templates only.
PATTERN='AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|xox[baprs]-[0-9A-Za-z-]{10,}|ghp_[0-9A-Za-z]{36}|sk_live_[0-9A-Za-z]{20,}|-----BEGIN PGP PRI[V]ATE KEY'

if HITS=$(git grep -nEI "$PATTERN" -- \
  ':!pnpm-lock.yaml' \
  ':!**/package-lock.json' \
  ':!.env.example' \
  ':!**/.env.example' 2>&1); then
  echo "✗ Possible secrets in tracked content:"
  echo "$HITS"
  FAIL=1
else
  GREP_STATUS=$?
  if [[ "$GREP_STATUS" -ne 1 ]]; then
    echo "✗ Secret content scan failed (git grep exit $GREP_STATUS):" >&2
    echo "$HITS" >&2
    FAIL=1
  fi
fi

# 3) Detect any .env* files tracked in Git (except public .env.example).
ENV_HITS=$(git ls-files | grep -E '(^|/)\.env(\.|$)' | grep -v '\.env\.example$' || true)
if [[ -n "$ENV_HITS" ]]; then
  echo "✗ Tracked .env files (use .env.example only):"
  echo "$ENV_HITS"
  FAIL=1
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo
  echo "Secret/env scan failed. Remove leaked values from code/history and rotate affected credentials."
  exit 1
fi

echo "OK: no forbidden secrets / .env files detected in tracked files."
