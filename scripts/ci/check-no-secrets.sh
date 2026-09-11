#!/usr/bin/env bash
# scripts/ci/check-no-secrets.sh
# Hard gate: fail if committed tree contains secrets / private keys / env dumps.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

FAIL=0

# 1) Tracked files that must never be committed
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

# 2) Content patterns in source (exclude lockfiles, known safe examples)
# AWS keys, private key headers, Slack/GitHub tokens, Stripe live sk, generic high-entropy assignments
PATTERN='AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|xox[baprs]-[0-9A-Za-z-]{10,}|ghp_[0-9A-Za-z]{36}|sk_live_[0-9A-Za-z]{20,}|-----BEGIN PGP PRIVATE KEY'

HITS=$(
  git grep -nEI -- \
    -- ':!pnpm-lock.yaml' \
    -- ':!**/package-lock.json' \
    -- ':!**/*.md' \
    -- ':!docs/**' \
    -- ':!.env.example' \
    -- ':!**/.env.example' \
    "$PATTERN" 2>/dev/null || true
)

if [[ -n "$HITS" ]]; then
  echo "✗ Possible secrets in tracked source:"
  echo "$HITS"
  FAIL=1
fi

# 3) .env committed under any path (defense in depth)
ENV_HITS=$(git ls-files | grep -E '(^|/)\.env(\.|$)' | grep -v '\.env\.example' || true)
if [[ -n "$ENV_HITS" ]]; then
  echo "✗ Tracked .env files (use .env.example only):"
  echo "$ENV_HITS"
  FAIL=1
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo
  echo "Secret/env scan failed. Remove secrets, rotate credentials, keep only .env.example."
  exit 1
fi

echo "OK: no forbidden secrets / .env files in tracked tree."
