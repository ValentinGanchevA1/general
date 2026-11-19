#!/usr/bin/env bash
# Render g88-api: deterministic application BUILD ONLY, with no DB access.
# Do not use this script as approval for a production release or migrations.
set -euo pipefail
npm install -g pnpm
pnpm install --frozen-lockfile --filter @g88/shared --filter @g88/backend
pnpm --filter @g88/shared run build
cd apps/backend
npx nest build
