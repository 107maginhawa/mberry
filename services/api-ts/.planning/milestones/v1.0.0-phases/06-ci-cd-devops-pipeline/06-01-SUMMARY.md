---
phase: 06-ci-cd-devops-pipeline
plan: "01"
subsystem: ci-cd
tags: [ci, github-actions, docker, build, testing]
dependency_graph:
  requires: []
  provides: [ci-build-api, ci-build-frontends, ci-unit-tests]
  affects: [.github/workflows/ci.yml]
tech_stack:
  added: [docker/build-push-action@v6, docker/setup-buildx-action@v3]
  patterns: [parallel-ci-jobs, docker-build-no-push, artifact-upload]
key_files:
  created: []
  modified:
    - .github/workflows/ci.yml
decisions:
  - "build-api uses push: false — PR builds never push to registry (T-06-01 threat mitigation)"
  - "GHA cache (type=gha) for Docker layer caching — acceptable risk per threat register"
  - "unit-tests job mirrors e2e postgres+minio services for integration-level test coverage"
metrics:
  duration: "< 5min"
  completed: "2026-05-06"
  tasks_completed: 2
  files_modified: 1
---

# Phase 06 Plan 01: CI Build Jobs Summary

Extended CI workflow with Docker build, frontend production bundles, and dedicated API unit test jobs running in parallel on every PR.

## What Was Built

Added 3 new parallel jobs to `.github/workflows/ci.yml`:

1. **build-api** — builds API Docker image from `services/api-ts/Dockerfile` using monorepo root context, with GHA layer cache. Push disabled (`push: false`) for PR safety. Runs smoke test to verify image starts.

2. **build-frontends** — installs deps, builds OpenAPI spec + codegen, then runs `bun run build` for `apps/memberry`, `apps/admin`, and `apps/account`. Uploads each `dist/` as a named artifact (`frontend-memberry`, `frontend-admin`, `frontend-account`).

3. **unit-tests** — runs `cd services/api-ts && bun test` with postgres + minio service containers (same config as e2e/contract jobs). Runs independently of E2E for fast feedback.

All 3 jobs run in parallel alongside existing `lint-typecheck`, `e2e`, and `contract` jobs. Total: **6 parallel CI jobs**.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. CI-only YAML changes.

Threat T-06-01 mitigated: `push: false` on all PR Docker builds — no registry credentials required, forks cannot push images.

## Self-Check

- [x] `.github/workflows/ci.yml` exists and modified
- [x] `build-api:` job present — grep confirms
- [x] `build-frontends:` job present — grep confirms
- [x] `unit-tests:` job present — grep confirms
- [x] `push: false` present — grep confirms
- [x] `docker/build-push-action` present — grep confirms
- [x] `upload-artifact` present (5 matches — 3 frontend + 2 existing failure uploads) — grep confirms
- [x] `bun test` present in unit-tests job — grep confirms
- [x] Commit 872ab27 exists

## Self-Check: PASSED
