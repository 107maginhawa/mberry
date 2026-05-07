# Phase 6: CI/CD & DevOps Pipeline - Research

**Researched:** 2026-05-06
**Domain:** GitHub Actions, Docker, deployment infrastructure
**Confidence:** HIGH (codebase verified, MEDIUM for deployment target specifics)

## Summary

Phase 6 extends the existing GitHub Actions CI setup to add staging/production deployment workflows with health checks and canary monitoring. The codebase already has a solid CI foundation (`ci.yml` with lint/typecheck/E2E and `contract.yml` with Hurl + Schemathesis). The Dockerfile for `services/api-ts` is production-ready (multi-stage, health check via `/readyz`). Frontend apps are pure Vite SPA builds with static output.

The main gaps are: no deploy workflows exist yet, no deployment target is configured in the codebase, and no monitoring/alerting is set up. Because no deployment platform is locked in CONTEXT.md, this research treats Railway as the recommended default (zero-ops, native Docker, GitHub integration) while documenting alternatives.

**Primary recommendation:** Use Railway for API + managed Postgres/MinIO; deploy frontend SPAs to Cloudflare Pages or Vercel. Use GitHub Actions deploy jobs triggered on `main` merge.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation choices are at Claude's discretion (pure infrastructure phase).

### Claude's Discretion
All implementation choices — deployment target, monitoring tooling, workflow structure.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEVX-01 | GitHub Actions workflow for build across all apps and services | Existing ci.yml covers lint/typecheck. Needs unit test job + build artifact job added. |
| DEVX-02 | GitHub Actions workflow for deploy to staging environment | New workflow needed. Triggers on main merge. Needs deployment target secrets. |
| DEVX-03 | Production deploy workflow with health checks | New workflow needed. Manual trigger or tag-based. Calls /readyz before traffic switch. |
| DEVX-04 | Canary/health monitoring for production | Uptime monitoring (UptimeRobot/BetterStack free tier) + GitHub Actions scheduled health ping. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Build validation (lint/typecheck/test) | CI runner | — | Stateless, no external deps |
| API container build + push | CI runner | Container registry | Docker multi-stage build, push on main |
| Frontend static build | CI runner | CDN/Static host | `vite build` → `dist/`, upload to static host |
| Database migrations on deploy | API server startup | CI runner | Drizzle runs migrations on `bun run start`; CI can verify with health check |
| Health check gate | Deployment pipeline | API `/readyz` | Check DB + storage + jobs before traffic switch |
| Production monitoring | External uptime service | GitHub Actions scheduled | Ping `/readyz` on schedule; alert on failure |

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Actions | N/A | CI/CD orchestration | Already used; `ci.yml` + `contract.yml` exist [VERIFIED: codebase] |
| oven-sh/setup-bun | v2 | Bun installation in CI | Already used in both workflows [VERIFIED: codebase] |
| Docker | — | API containerization | Dockerfile already exists and is production-ready [VERIFIED: codebase] |
| Railway (recommended) | — | Deployment platform | Zero-ops Docker deploy, managed Postgres, free staging tier [ASSUMED] |
| Cloudflare Pages / Vercel | — | Frontend SPA hosting | Static Vite output, CDN delivery, free tier [ASSUMED] |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| actions/upload-artifact | v4 | Save build artifacts | Frontend dist/ for deploy step |
| docker/build-push-action | v6 | Build + push Docker image | API container on main merge |
| docker/login-action | v3 | Auth to container registry | Before push |
| UptimeRobot / BetterStack | — | Uptime monitoring (DEVX-04) | External ping to /readyz with alert |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Railway | Fly.io | More config (fly.toml), better global distribution |
| Railway | Render | Similar zero-ops, slower deploys |
| Railway | Self-hosted VPS | Full control, more ops burden |
| Cloudflare Pages | Netlify | Both free, CF has better edge network |
| External uptime service | GitHub Actions `schedule` | Scheduled GHA pings are free but less reliable alerting |

## Architecture Patterns

### System Architecture Diagram

```
PR opened
    │
    ▼
[ci.yml: lint-typecheck job]──────────────────────┐
    │                                              │
    ▼                                              ▼
[ci.yml: e2e job]                    [contract.yml: contract job]
    │
    ▼ (PR merged to main)
[deploy.yml: staging job]
    ├── build API Docker image → push to registry
    ├── build frontend SPAs (3× vite build)
    ├── deploy API to staging (Railway/Fly)
    ├── deploy frontends to staging (CF Pages/Vercel preview)
    └── health check /readyz → fail if 503
    │
    ▼ (manual trigger or tag v*)
[deploy.yml: production job]
    ├── pull staged image (same SHA)
    ├── deploy API to production
    ├── run /readyz gate (retry 3×)
    └── deploy frontends to production
    │
    ▼ (scheduled: every 5 min)
[monitor.yml: health-ping job]
    └── curl /readyz → notify on failure (GitHub issue / Slack)
```

### Recommended Project Structure
```
.github/
└── workflows/
    ├── ci.yml          # existing — lint, typecheck, E2E, contract (extend DEVX-01)
    ├── contract.yml    # existing — Hurl + Schemathesis
    ├── deploy.yml      # NEW — staging + production deploy (DEVX-02, DEVX-03)
    └── monitor.yml     # NEW — scheduled health ping (DEVX-04)
```

### Pattern 1: Conditional Deploy Jobs in Single Workflow
**What:** Single `deploy.yml` with `staging` job (on push to main) and `production` job (manual `workflow_dispatch` or tag).
**When to use:** Keeps deploy logic in one file, simpler secret management.
**Example:**
```yaml
# Source: [CITED: docs.github.com/actions/using-workflows/workflow-syntax]
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]

jobs:
  deploy-staging:
    if: github.event_name == 'push'
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... build + deploy + health check

  deploy-production:
    if: github.event_name == 'workflow_dispatch' && inputs.environment == 'production'
    environment: production
    needs: []
    runs-on: ubuntu-latest
    steps:
      # ... deploy same image SHA, health gate
```

### Pattern 2: Health Check Gate Before Traffic
**What:** Poll `/readyz` in a loop after deploy; fail workflow if 503 persists.
**When to use:** Production deploy — prevents broken deploys from receiving traffic.
**Example:**
```bash
# Source: [VERIFIED: health.ts - /readyz returns 503 when DB/storage/jobs unhealthy]
for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL/readyz")
  [ "$STATUS" = "200" ] && exit 0
  sleep 5
done
echo "Health check failed after 150s"
exit 1
```

### Pattern 3: Scheduled Monitor Workflow
**What:** `monitor.yml` with `on: schedule` pinging `/readyz`; creates GitHub issue on failure.
**When to use:** Lightweight DEVX-04 — no external service required for basic monitoring.
**Example:**
```yaml
# Source: [CITED: docs.github.com/actions/using-workflows/events-that-trigger-workflows]
on:
  schedule:
    - cron: '*/5 * * * *'  # every 5 minutes

jobs:
  health-ping:
    runs-on: ubuntu-latest
    steps:
      - name: Check /readyz
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${{ vars.PRODUCTION_API_URL }}/readyz")
          if [ "$STATUS" != "200" ]; then
            echo "::error::Production API unhealthy (HTTP $STATUS)"
            exit 1
          fi
```

### Anti-Patterns to Avoid
- **Deploying on every PR:** Deploy only on main merge. PRs run tests only.
- **Hardcoding secrets in workflow YAML:** Use GitHub Environments + encrypted secrets.
- **Running migrations as separate CI step:** The API runs migrations on startup — wait for `/readyz` instead.
- **Building Docker image per job:** Build once, tag with git SHA, reuse same image for staging and production.
- **Missing `--frozen-lockfile`:** All `bun install` calls must use `--frozen-lockfile` (already done in existing workflows).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Health probes | Custom shell health scripts | `/livez` + `/readyz` already in codebase | Already implemented, tested, RFC-compliant [VERIFIED: health.ts] |
| Uptime alerting | Custom webhook monitor | UptimeRobot / BetterStack / monitor.yml `schedule` | Free, reliable, sub-minute alerting |
| Container registry | Self-hosted | GitHub Container Registry (ghcr.io) | Free for public/private, native GHA integration |
| Secret rotation | Custom vault | GitHub Environments with encrypted secrets | Built-in, per-environment scoping |

**Key insight:** The API already has `/livez` (liveness) and `/readyz` (readiness: DB + storage + jobs) — use these as the canonical health gate. Never invent a custom health endpoint.

## Common Pitfalls

### Pitfall 1: API Migrations Not Run on Fresh Deploy
**What goes wrong:** Staging deploy passes CI but API returns 500 because migrations haven't run.
**Why it happens:** Drizzle runs migrations on server startup (`bun run start`), but the health check is called before startup completes.
**How to avoid:** The `/readyz` endpoint checks DB connectivity — a migration failure shows up as DB unhealthy. Poll `/readyz` for up to 60s before declaring success.
**Warning signs:** `/livez` returns 200 but `/readyz` returns 503 on fresh deploy.

### Pitfall 2: Three Apps, Three Playwright Browser Installs
**What goes wrong:** CI timeout because `playwright install` runs 3× sequentially.
**Why it happens:** Each app installs its own browser binaries.
**How to avoid:** Either (a) centralize browser install in a setup step, or (b) run apps in parallel jobs with matrix strategy. [VERIFIED: existing ci.yml already does sequential installs]

### Pitfall 3: Frontend Proxy Config Breaks in Production
**What goes wrong:** Frontend makes `/api/*` requests that hit the Vite dev proxy — which doesn't exist in production.
**Why it happens:** `vite.config.ts` proxy is dev-only. Production frontend needs `VITE_API_URL` env var.
**How to avoid:** Set `VITE_API_URL` in deploy workflow. Verify `fetch('/api/...')` is replaced with full URL in production builds.
**Warning signs:** Network errors in production; all API calls return 502.

### Pitfall 4: `bun run build` on API Produces Binary
**What goes wrong:** `services/api-ts` build script produces a compiled binary (`dist/server`), not transpiled JS. Docker build should use `bun run start` (source + Bun runtime), not the compiled binary.
**Why it happens:** The Dockerfile correctly uses `CMD ["bun", "run", "start"]`. But a CI "build" job that runs `bun run --filter '*' build` would also compile the API binary unnecessarily.
**How to avoid:** Separate "build" in CI into (a) `bun build` for frontend apps and (b) `docker build` for the API. Don't conflate them.

### Pitfall 5: Missing GitHub Environment Protection Rules
**What goes wrong:** Auto-deploy to production on every main push — no approval gate.
**Why it happens:** Not configuring GitHub Environment required reviewers.
**How to avoid:** Create `production` Environment in GitHub repo settings with required reviewers. `staging` can be unprotected.

## Code Examples

### Existing CI — What's Already There
```yaml
# Source: [VERIFIED: .github/workflows/ci.yml]
# Already covers: lint, typecheck, E2E (memberry + admin + account), contract tests
# Bun version: 1.2.21 (pinned)
# Services: postgres:16-alpine, minio:latest
# API: boots on port 7213, waits for /livez
```

### Docker Build + Push Pattern
```yaml
# Source: [CITED: docs.docker.com/build/ci/github-actions]
- name: Log in to GHCR
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}

- name: Build and push API image
  uses: docker/build-push-action@v6
  with:
    context: .
    file: services/api-ts/Dockerfile
    push: true
    tags: |
      ghcr.io/${{ github.repository }}/api:${{ github.sha }}
      ghcr.io/${{ github.repository }}/api:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Frontend Build Pattern
```yaml
# Source: [VERIFIED: apps/*/package.json — all have "build": "vite build"]
- name: Build all frontend apps
  run: bun run --filter 'memberry' build && bun run --filter 'admin' build && bun run --filter 'account' build
  env:
    VITE_API_URL: ${{ vars.STAGING_API_URL }}
```

### Health Check Gate
```bash
# Source: [VERIFIED: health.ts — /readyz checks DB + storage + jobs, returns 503 on failure]
DEPLOY_URL="${{ vars.STAGING_API_URL }}"
for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DEPLOY_URL/readyz")
  echo "Attempt $i: HTTP $STATUS"
  [ "$STATUS" = "200" ] && echo "API ready" && exit 0
  sleep 5
done
echo "Health check failed after 150s"
exit 1
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm ci` | `bun install --frozen-lockfile` | 2024 | ~3× faster CI installs |
| Manual Docker layer caching | `--cache-from type=gha` | 2023 | Reuses GitHub Actions cache |
| Separate deploy repos | Monorepo deploy workflow | N/A | Single source, coordinated deploys |

**Deprecated/outdated:**
- `actions/checkout@v3`: Use v4 (already done in existing workflows).
- `oven-sh/setup-bun@v1`: Use v2 (already done).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Railway is the recommended deployment platform | Standard Stack | Low — planner can substitute any Docker-capable platform; workflows are platform-agnostic until deploy step |
| A2 | Frontend apps need `VITE_API_URL` env var for production | Common Pitfalls | Medium — if apps use relative paths that resolve correctly behind a reverse proxy, no env var needed |
| A3 | UptimeRobot/BetterStack free tier sufficient for DEVX-04 | Standard Stack | Low — GitHub Actions `schedule` is a valid zero-cost fallback |
| A4 | Production deploy uses `workflow_dispatch` (manual) not auto on main | Architecture | Low — easily changed; depends on user's release cadence preference |

## Open Questions

1. **Deployment platform selection**
   - What we know: Dockerfile exists, Railway/Fly/Render all work with it
   - What's unclear: No platform is configured; user has no stated preference
   - Recommendation: Default to Railway for simplicity; expose as a variable in the workflow

2. **Staging environment infrastructure**
   - What we know: Staging needs its own Postgres + MinIO (or S3)
   - What's unclear: Whether user wants a managed DB or container-based staging DB
   - Recommendation: Railway managed Postgres for staging; document the required secrets

3. **Frontend production URL / CORS**
   - What we know: API has CORS config in `config.ts`; frontends proxy via Vite in dev
   - What's unclear: Production CORS origins aren't configured yet
   - Recommendation: Plan must include a task to set `CORS_ORIGINS` env var to production frontend URLs

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker (CI) | API container build | ✓ (ubuntu-latest has Docker) | Built-in | — |
| ghcr.io | Container registry | ✓ (GITHUB_TOKEN provides access) | Built-in | Docker Hub |
| GitHub Actions | All workflows | ✓ | In use | — |
| Hurl | Contract tests | ✓ (installed in contract.yml) | 6.0.0 | — |
| Deployment platform | DEVX-02/03 | ✗ (not configured) | — | Any Docker host |

**Missing dependencies with no fallback:**
- Deployment platform: must be selected and secrets configured before DEVX-02/03 can run.

**Missing dependencies with fallback:**
- None beyond the deployment platform.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (E2E), Bun test (unit), Hurl (contract) |
| Config file | `apps/*/playwright.config.ts`, `services/api-ts/src/**/*.test.ts` |
| Quick run command | `cd services/api-ts && bun test` |
| Full suite command | `bun run --filter '*' test && bun run test:contract` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEVX-01 | CI build workflow passes on PR | smoke | `gh workflow run ci.yml` / PR trigger | ✅ ci.yml exists |
| DEVX-02 | Staging deploy triggers on main merge | smoke | Manual: check deploy job log | ❌ Wave 0 |
| DEVX-03 | Production health gate blocks bad deploy | smoke | Manual: trigger workflow, verify /readyz loop | ❌ Wave 0 |
| DEVX-04 | Monitor alerts on /readyz failure | smoke | Manual: break /readyz, verify alert fires | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `.github/workflows/deploy.yml` — staging + production deploy (DEVX-02, DEVX-03)
- [ ] `.github/workflows/monitor.yml` — scheduled health ping (DEVX-04)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | GitHub Environment required reviewers for production |
| V5 Input Validation | no | — |
| V6 Cryptography | yes | Secrets stored as GitHub encrypted secrets, never in YAML |

### Known Threat Patterns for CI/CD

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret exfiltration via PR from fork | Information Disclosure | Use `pull_request_target` carefully; never expose secrets to fork PRs |
| Supply chain: compromised action | Tampering | Pin actions to commit SHA, not tag |
| Unprotected production environment | Elevation of Privilege | GitHub Environment required reviewers |
| Deploying unapproved image | Tampering | Deploy by git SHA, verify same SHA that passed CI |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: .github/workflows/ci.yml] — existing workflow structure, Bun version, service config
- [VERIFIED: .github/workflows/contract.yml] — contract test setup, Hurl version
- [VERIFIED: services/api-ts/Dockerfile] — multi-stage build, health check config, exposed port
- [VERIFIED: services/api-ts/src/core/health.ts] — /livez and /readyz behavior and response codes
- [VERIFIED: apps/*/vite.config.ts] — frontend port assignments (3002/3003/3004), proxy config
- [VERIFIED: apps/*/package.json] — build and test script names

### Secondary (MEDIUM confidence)
- [CITED: docs.github.com/actions] — workflow syntax, environment protection, schedule events
- [CITED: docs.docker.com/build/ci/github-actions] — build-push-action patterns

### Tertiary (LOW confidence)
- [ASSUMED] Railway as deployment platform recommendation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all CI tooling verified in codebase; deploy platform ASSUMED
- Architecture: HIGH — based on existing workflows and health endpoint analysis
- Pitfalls: MEDIUM — common GHA/Vite/Docker pitfalls from training knowledge, verified where codebase context applies

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (GitHub Actions API stable, Bun pinned to 1.2.21)
