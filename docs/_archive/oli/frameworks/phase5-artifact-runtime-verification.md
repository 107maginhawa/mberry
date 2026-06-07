# Phase 5: Artifact & Runtime Verification — Implementation Record

> Completed 2026-05-13. All 4 sub-tasks implemented and wired into CI.

## Summary

Phase 5 ensures we test what we actually ship — not dev servers. Four areas:

| # | Sub-task | What was done |
|---|----------|---------------|
| 5.1 | Critical-path E2E against built artifacts | New `artifact-smoke` CI job: downloads built frontend artifacts, verifies index.html exists/non-empty, starts `vite preview` and checks app shell renders |
| 5.2 | Config/env startup validation | Extended `parseConfig()` to fail fast in production on missing `AUTH_SECRET`, `DATABASE_URL`, `INTERNAL_SERVICE_TOKEN`. Warns on insecure defaults (wildcard CORS, minioadmin creds). 6 new unit tests. |
| 5.3 | Schema/migration backward-compat checks | New `scripts/migration-safety.ts` — scans SQL migrations for destructive ops (DROP TABLE, TRUNCATE, etc). Errors block CI, warnings pass. `-- migration-safety: reviewed` comment downgrades errors. Wired into `lint-typecheck` CI job. |
| 5.4 | Container/binary health check | Fixed `build-api` CI job: was `sleep 2 && stop`. Now polls `/livez` for 15s with proper error reporting. Passes required env vars including `INTERNAL_SERVICE_TOKEN`. |

## Team Size Tier

**3-person team** → "Build + smoke" intensity. No full staging E2E, no canary. Lean checks that catch the most common artifact/config failures.

## Files Changed

### Config validation (5.2)
- `services/api-ts/src/core/config.ts` — added production guards for DATABASE_URL, INTERNAL_SERVICE_TOKEN; insecure-default warnings
- `services/api-ts/src/core/config.test.ts` — 6 new tests for production validation

### Migration safety lint (5.3)
- `scripts/migration-safety.ts` — new script, 10 danger patterns, `--all`/`--base` flags, reviewed-comment suppression
- `package.json` — added `lint:migrations` script

### CI changes (5.1 + 5.3 + 5.4)
- `.github/workflows/ci.yml`:
  - Added `Migration safety lint` step to `lint-typecheck` job
  - Fixed `build-api` job: proper /livez health check polling (was sleep 2)
  - New `artifact-smoke` job: downloads built artifacts, verifies content, serves via vite preview, checks app shell
  - Added `artifact-smoke` to `ci-gate` required checks

## Danger Patterns (migration-safety.ts)

| Severity | Pattern | Message |
|----------|---------|---------|
| error | DROP TABLE | Permanent data loss |
| error | DROP SCHEMA | Permanent data loss |
| error | TRUNCATE | Deletes all rows |
| error | DELETE FROM (no WHERE) | Deletes all rows |
| warning | DROP COLUMN | May lose data |
| warning | ALTER TYPE | May fail or truncate |
| warning | RENAME TABLE/COLUMN | Breaks references |
| warning | SET NOT NULL | Fails if existing NULLs |
| warning | DROP CONSTRAINT | Weakens integrity |
| warning | DROP INDEX | May degrade performance |

## CI Pipeline (updated)

```
lint-typecheck ──┐
unit-tests ──────┤
e2e ─────────────┤
contract ────────┤
build-api ───────┤───→ ci-gate (all must pass)
build-frontends ─┤
artifact-smoke ──┤  (new — needs build-frontends)
coverage-gate ───┘
```

## What's NOT in scope (deferred to Phase 6)

- Canary/staged rollout
- Rollback plan testing
- Feature flags for risky deployments
- Post-deploy smoke verification (exists in deploy.yml already)
