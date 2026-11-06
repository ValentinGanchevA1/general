# Semgrep Community Edition SAST — NEXA

## Purpose and boundaries

This is an additional, **private-repository-compatible** first-party SAST check.
It is deliberately limited to three high-confidence NEXA rules on unsafe
JavaScript evaluation, shell-command execution and TLS validation bypass.
It does **not** replace CodeQL's coverage, dependency analysis, secret scanning,
runtime authorization tests or manual security review.

## Privacy / licensing

- Runs `semgrep scan` locally in GitHub Actions without a Semgrep account.
- Rules and fixtures are stored locally in `.semgrep/`. No Semgrep Registry
  (`p/...`, `r/...`, `auto`) configuration is fetched. `semgrep scan --validate`
  is intentionally omitted because validation lint packs can require registry access;
  `semgrep scan --test` parses the local rules and verifies the annotated cases.
- `SEMGREP_SEND_METRICS=off` and `--metrics=off`; version checks are disabled.
- `semgrep ci`, Semgrep Cloud uploads, telemetry and SARIF uploads are **not** used.
- Installing the pinned Semgrep Python distribution from PyPI requires standard
  package download network access; scan input is not uploaded to Semgrep.
- The Semgrep CLI is third-party LGPL software installed at CI runtime; this
  does not make NEXA source code open source.

## Scan scope

- `apps/backend/src` (NestJS backend)
- `apps/mobile/src` (React Native)
- `packages/shared/src` (shared TypeScript contracts)
- `web/src` (browser client)

This initial baseline excludes generated build assets, `legacy/` and
infrastructure scripts. It also does not scan all third-party dependencies.
Do not treat a clean result as a vulnerability-free guarantee.

## Local reproduction

Install Python 3.11+ and create a virtual environment, then:

```bash
python3 -m venv .venv-semgrep
.venv-semgrep/bin/python -m pip install 'semgrep==1.184.0'
export SEMGREP_SEND_METRICS=off
.venv-semgrep/bin/semgrep scan --test --config .semgrep/rules/ .semgrep/tests/ --metrics=off --disable-version-check
.venv-semgrep/bin/semgrep scan --config .semgrep/rules/nexa-security.yml --error --strict --metrics=off --disable-version-check apps/backend/src apps/mobile/src packages/shared/src web/src
```

Never commit `.venv-semgrep/`. For CI, the venv is created under
`$RUNNER_TEMP` and is not committed.

## CI sign-off criteria

1. The pinned Semgrep version installs successfully in a fresh runner.
2. Rule syntax/parsing and positive/negative fixtures pass under `--test`
   (with matching filename and mirrored `rules/` and `tests/` layouts).
3. The first-party SAST scan reports zero ERROR findings (or code is
   reviewed/remediated before merge); scan/tool failure must fail the job.
4. The workflow completes for the PR head. The user must explicitly review
   before merging; repository visibility is not changed by this PR.

If the repository becomes private, verify branch protection required checks
and Render `checksPass` integration still work. CodeQL may require a separate
license and should be addressed independently.
