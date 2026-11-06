# NEXA: Public → Private migration runbook (manual approval required)

**Scope:** `ValentinGanchevA1/general` (`master`). This document is a plan only.
It does not authorize or automatically change repository visibility, GitHub
settings, Render services, Play Console, or any external system.

## Confirmed Render `g88` services (2026-11-06)

The user confirmed Render workspace `g88` (`tea-d87btoog4nts73domv40`).
The Render API confirms **three live services** linked to
`https://github.com/ValentinGanchevA1/general`:

| Service | Render ID | Tracked branch | Auto deploy | Latest inspected deploy |
|---|---|---|---|---|
| `g88-api` | `srv-d8d8ujojs32c73fb1gfg` | `master` | `checksPass` | `dep-dbmob0tg1s2s73d6t250`, live |
| `g88-legal` | `srv-d8ssj8mq1p3s738mnu50` | `master` | `commit` | `dep-dbmoa0vavr4c738vn1ng`, live |
| `nexa-web-pr-578` | `srv-dbea678m7kps73d700og` | `feature/nexa-web-client-v1` | `commit` | `dep-dbft1l0n74is73frr04g`, live |

The first two live deploys reference `7fb28d27a09acb835ca1c6e42c04adc6878ffb93`;
the web preview currently uses `ac265f37c96056edb610bd28501049ede73581e5`.
`g88-api` has automatic PR preview generation enabled. All three service
configurations show the public Git repository URL, but their **private repo
GitHub App permissions have NOT been independently verified**. Live deployment
from a public repository does not prove future authorization after privacy
changes. Public endpoint HTTP/HTTPS health and privacy-page reachability were
not independently established by this audit.

Before approving private conversion, verify the Render GitHub App installation
under GitHub → Settings → Applications → Installed GitHub Apps → Render →
Configure → Repository access. If using selected repositories, include
`ValentinGanchevA1/general`. In Render, confirm linked Git credentials for
each service. Record evidence for each service before and after conversion.
Keep `g88-legal` externally accessible because Google Play needs public legal
URLs. Do not assume `g88-api` PR previews are private just because GitHub
source code becomes private.

## Before changing visibility

1. Merge and verify the proprietary notice, secret-scan regression tests, and
   Dependabot configuration. Confirm CI and security-scanner test jobs pass.
2. Make a secure offline clone/backup; inspect Git history, workflow artifacts,
   logs, releases and existing forks for credentials/PII. Rotate any leaked
   secrets, revoke old tokens, and invalidate any exposed signing credentials
   as appropriate; changing visibility does not erase previous exposure.
3. Record branch protection/ruleset settings, required checks and repository
   collaborators. Protect `master` (required PR, CI checks, prevent force push
   and deletion), subject to plan/permissions.
4. Validate all third-party deployments and automation integrations have GitHub
   App access to **private** `ValentinGanchevA1/general`. Inventory webhooks,
   deploy keys, CI tokens, Sites previews and release distribution.
5. Render: identify the correct workspace and linked services, record the
   GitHub repo/branch and deployment credentials, confirm Render GitHub App
   includes this repo, and review automatic deploy + preview settings.
   Do not choose among unrelated workspaces without owner confirmation.
6. GitHub security: check the owner's plan and whether **GitHub Code Security**
   can be enabled for private repositories. CodeQL code scanning on private
   repos is not available on GitHub Free/Pro alone. If unavailable, preserve
   CI and replace CodeQL protection with a supported alternative scanner,
   such as Semgrep.
7. Confirm Actions is enabled for private repositories and review private
   runner-minute limits/billing, secrets/variables, environment approval rules,
   artifact retention, OIDC and package publishing permissions.
8. Verify that any GitHub Pages or public documentation source is moved to a
   separate public host/repository. Changing to private can unpublish Pages on
   some plans. Keep the public privacy policy operational for Google Play.

## Change window (only after explicit approval)

1. GitHub repo → **Settings → General → Danger Zone → Change repository
   visibility → Private**. Read and confirm GitHub's displayed consequences.
2. Confirm repository is private and only intended collaborators have access.
3. Confirm Render GitHub App still has access; perform a safe nonproduction
   deploy before a production deploy. Check webhook events and deploy logs.
4. Push a minimal PR; verify CI checks, Dependabot access, secrets and release
   workflow permissions; check CodeQL eligibility and replace any suddenly
   unavailable required check before enforcing branch rules.
5. Confirm Android AAB build, Play privacy policy URL and externally hosted
   assets still work. Verify any public demo, web site or Sites preview.

## Important irreversible/partial effects

- Previously cloned source and existing public forks do **not** become private.
  GitHub detaches the existing public forks into a separate public network.
- GitHub may remove stars and watchers after the visibility change.
- GitHub CodeQL/code scanning becomes unavailable on private repositories
  without GitHub Code Security eligibility/licensing.
- Dependabot alerts/dependency graph can remain with correct access;
  custom alert rules may be disabled without Code Security.
- Public GitHub Pages can be unpublished depending on GitHub plan.

## Rollback and sign-off

If Render access or CI breaks, fix app installation/permissions first; do not
assume changing back to public is a safe rollback (that would re-expose code).
Restore service from verified backup or manually redeploy from a trusted source.

Owner sign-off: **PENDING**. Repository visibility: **UNCHANGED**.
Render workspace and three linked services: **VERIFIED** on 2026-11-06; Render GitHub App private-repository authorization: **UNVERIFIED**.
