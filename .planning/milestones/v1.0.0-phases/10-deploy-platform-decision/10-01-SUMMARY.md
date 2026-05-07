---
phase: 10-deploy-platform-decision
plan: "01"
subsystem: ci-cd
tags: [deploy, railway, cloudflare, github-actions]
dependency_graph:
  requires: []
  provides: [complete-deploy-workflow]
  affects: [.github/workflows/deploy.yml]
tech_stack:
  added: ["@railway/cli", "wrangler"]
  patterns: [railway-deploy, cloudflare-pages-deploy]
key_files:
  modified:
    - .github/workflows/deploy.yml
decisions:
  - "Railway for API hosting (staging + production)"
  - "Cloudflare Pages for all 3 frontend apps (memberry, admin, account)"
  - "RAILWAY_TOKEN + CLOUDFLARE_API_TOKEN stored as GitHub environment secrets"
metrics:
  duration: "5m"
  completed: "2026-05-06"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 10 Plan 01: Deploy Platform Decision Summary

Complete the GitHub Actions deploy workflow by replacing all 4 TODO placeholders with real Railway (API) and Cloudflare Pages (frontends) deploy commands.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace TODO blocks with Railway + Cloudflare deploy commands | 31551b9 | .github/workflows/deploy.yml |
| 2 | Validate workflow YAML syntax | (no file changes needed) | .github/workflows/deploy.yml |

## What Was Built

- `deploy-staging` job: deploys API via `railway up --service memberry-api --environment staging` and deploys all 3 frontends via `wrangler pages deploy` to Cloudflare Pages staging projects
- `deploy-production` job: same pattern targeting production environment and production Cloudflare Pages projects
- Secrets documentation comment block at top of deploy.yml listing all required GitHub secrets and variables

## Acceptance Criteria Met

- Zero TODO references in deploy.yml
- `railway up` present 2x (staging + production)
- `wrangler pages deploy` present 6x (3 apps x 2 envs)
- `RAILWAY_TOKEN` referenced 3x (header comment + 2 job env blocks)
- `CLOUDFLARE_API_TOKEN` referenced 3x (header comment + 2 job env blocks)
- `CLOUDFLARE_ACCOUNT_ID` referenced 3x (header comment + 2 job env blocks)
- YAML parses cleanly via python3 yaml.safe_load
- Both deploy jobs have correct `environment:` declarations
- Both deploy jobs reference `needs.build.outputs.image_tag`

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

Before the deploy workflow can run, the following must be configured in GitHub:

### Railway
1. Create staging project with Postgres addon (Railway Dashboard -> New Project)
2. Create production project with Postgres addon
3. Generate API token (Account Settings -> Tokens -> Create Token)
4. Add `RAILWAY_TOKEN` as environment secret to both `staging` and `production` environments

### Cloudflare Pages
1. Create 6 Pages projects: `memberry-staging`, `memberry-admin-staging`, `memberry-account-staging`, `memberry-production`, `memberry-admin-production`, `memberry-account-production` (Cloudflare Dashboard -> Pages -> Create a project -> Direct Upload)
2. Generate API token with "Edit Cloudflare Pages" permission
3. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as environment secrets

### GitHub Variables
- Add `STAGING_API_URL` as environment variable on `staging` environment
- Add `PRODUCTION_API_URL` as environment variable on `production` environment

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-10-01 mitigated | deploy.yml | RAILWAY_TOKEN stored as GitHub environment secret, not repo-level |
| T-10-02 mitigated | deploy.yml | CLOUDFLARE_API_TOKEN scoped to Edit Pages only |
| T-10-03 mitigated | deploy.yml | No secrets hardcoded; all via ${{ secrets.* }} |
| T-10-05 mitigated | deploy.yml | Production deploy requires manual workflow_dispatch |

## Self-Check: PASSED

- .github/workflows/deploy.yml exists and modified: FOUND
- Commit 31551b9 exists: FOUND
- Zero TODOs in file: CONFIRMED
- YAML syntax valid: CONFIRMED
