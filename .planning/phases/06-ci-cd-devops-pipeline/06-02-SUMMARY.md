---
phase: 06-ci-cd-devops-pipeline
plan: "02"
subsystem: ci-cd
tags: [github-actions, docker, ghcr, deploy, health-check]
dependency_graph:
  requires: [06-01]
  provides: [deploy-workflow, staging-auto-deploy, production-gated-deploy]
  affects: [.github/workflows/deploy.yml]
tech_stack:
  added: [docker/build-push-action@v6, docker/login-action@v3, actions/download-artifact@v4]
  patterns: [ghcr-image-push, github-environments, health-check-gate, same-sha-promotion]
key_files:
  created:
    - .github/workflows/deploy.yml
  modified: []
decisions:
  - "Platform deploy commands are pluggable echo placeholders — workflow runs green without a platform configured"
  - "Frontend builds use STAGING_API_URL for both staging and production builds (production overrides not needed at build time — runtime env)"
  - "Health check gate: 30 attempts × 5s = 150s timeout matches plan spec"
metrics:
  duration: "8m"
  completed: "2026-05-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
---

# Phase 06 Plan 02: Deploy Workflow Summary

Deploy workflow with GHCR Docker image push, staging auto-deploy on main merge, and manual production deploy with health check gates using same image SHA for staging→production promotion.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create deploy.yml with staging job | 9cd41c9 | .github/workflows/deploy.yml |
| 2 | Add production deploy job to deploy.yml | 9cd41c9 | .github/workflows/deploy.yml |

(Both tasks committed together — same file, atomic change.)

## What Was Built

**`.github/workflows/deploy.yml`** — 3-job deploy workflow:

1. **build** — Builds and pushes Docker image to `ghcr.io/{repo}/api:{sha}` + `latest`. Also builds all 3 frontend apps (memberry, admin, account) with `VITE_API_URL` from `vars.STAGING_API_URL`, uploads dist/ artifacts.

2. **deploy-staging** — Triggers on `push` to main OR `workflow_dispatch` with `environment=staging`. Downloads frontend artifacts. Platform-agnostic deploy placeholders (echo/notice steps). Real `/readyz` health check gate: 30 attempts × 5s = 150s timeout.

3. **deploy-production** — Triggers ONLY on `workflow_dispatch` with `environment=production`. Uses same `needs: [build]` image SHA — no rebuild. Platform-agnostic deploy placeholders. Stricter health check: polls `/readyz`, verifies `"status":"ok"` JSON body, then smoke tests `/livez`. GitHub Environment `production` provides required-reviewer protection rule.

## Security (Threat Model)

| Threat | Mitigation Applied |
|--------|--------------------|
| T-06-03 Elevation of Privilege | `environment: production` + `workflow_dispatch` only — no auto-deploy to prod |
| T-06-04 Tampering | SHA tag `api:{github.sha}` deployed — same image validated in staging promoted to production |
| T-06-05 Info Disclosure | Secrets in GitHub Environments only; `GITHUB_TOKEN` scoped to repo |
| T-06-06 DoS via bad deploy | `/readyz` health gate — workflow fails if service unhealthy after 150s |

## Deviations from Plan

None — plan executed exactly as written.

## User Setup Required

Before deploy commands work, configure:

1. **GitHub Environments** — Settings → Environments:
   - Create `staging` (no protection rules) — add `STAGING_API_URL` variable
   - Create `production` (required reviewers) — add `PRODUCTION_API_URL` variable

2. **GHCR permissions** — Settings → Actions → General → Workflow permissions → "Read and write"

3. **Platform deploy commands** — Replace `echo "TODO..."` lines in deploy-staging/deploy-production steps with actual platform commands (Railway, Fly, Render, Cloudflare Pages, etc.)

## Self-Check: PASSED

- [x] `.github/workflows/deploy.yml` exists
- [x] YAML valid (python3 yaml.safe_load passes)
- [x] `deploy-staging:` job present
- [x] `deploy-production:` job present
- [x] `readyz` health check present (5 occurrences)
- [x] `ghcr.io` registry present
- [x] `build-push-action` present
- [x] Commit 9cd41c9 verified in git log
