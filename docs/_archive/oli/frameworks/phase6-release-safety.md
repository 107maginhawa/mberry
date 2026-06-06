# Phase 6: Release Safety — Implementation Record

> Completed 2026-05-13. All 4 sub-tasks implemented. Final layer of the Test-First Confidence Stack.

## Summary

Phase 6 adds a safety net around deployments — expanded smoke tests, rollback capability, feature flags, and post-deploy verification. Scoped to 3-person team tier: manual rollback plan, env-var feature flags, no canary infrastructure.

| # | Sub-task | What was done |
|---|----------|---------------|
| 6.1 | Staging smoke before production | Expanded staging deploy smoke: `/livez`, `/readyz?verbose`, auth session endpoint, feature-flags endpoint. Staging smoke failure blocks production deploy intent. |
| 6.2 | Rollback plan documented and tested | New `scripts/rollback.sh` — rolls back API (Railway image) + frontends (Cloudflare Pages rebuild). Supports `--to-sha`, `--steps N`, `--dry-run`. Added `bun run rollback` script. |
| 6.3 | Feature flags for risky deployments | New `services/api-ts/src/core/feature-flags.ts` — env-var based (`FF_*` prefix). Public `/feature-flags` endpoint for frontend consumption. 9 unit tests. Wired into app.ts. |
| 6.4 | Post-deploy smoke verification | Expanded production smoke: `/livez`, `/readyz?verbose`, auth session, feature-flags. Logs deploy marker (SHA + timestamp + rollback command) to GitHub Step Summary. |

## Team Size Tier

**3-person team** → "Manual rollback plan" intensity. Env-var feature flags (no LaunchDarkly). Staging-first deploy flow (already existed). No canary infrastructure.

## Rollback Procedure

### Quick Rollback (API only)
```bash
# Roll back API to previous deploy
bun run rollback -- --env production --steps 1

# Roll back to specific SHA
bun run rollback -- --env production --to-sha abc123

# Dry run first
bun run rollback -- --env production --steps 1 --dry-run
```

### What the script does
1. Resolves target SHA (from `--to-sha` or `--steps` via `gh run list`)
2. Redeploys previous Docker image via Railway CLI
3. Rebuilds frontends from target SHA in a git worktree, deploys via Wrangler
4. Runs health check against `/readyz`

### Prerequisites
- `RAILWAY_TOKEN` env var
- `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` env vars
- `gh` CLI authenticated
- `PRODUCTION_API_URL` or `STAGING_API_URL` env var (for health check)

## Feature Flags

### Adding a flag
Set `FF_<NAME>=true` in your environment (Railway, `.env`, etc.):
```bash
FF_NEW_DUES_FLOW=true
FF_BETA_EVENTS=false
```

### Reading flags
**Backend:**
```typescript
import { parseFeatureFlags, isEnabled } from '@/core/feature-flags';
const flags = parseFeatureFlags();
if (isEnabled(flags, 'newDuesFlow')) { /* ... */ }
```

**Frontend:**
```typescript
// Fetch from /feature-flags endpoint
const res = await fetch('/api/feature-flags');
const flags = await res.json();
if (flags.newDuesFlow) { /* ... */ }
```

### Naming convention
- Env var: `FF_DESCRIPTIVE_NAME` (screaming snake)
- Parsed key: `descriptiveName` (camelCase, auto-converted)

## Files Changed

### Deploy workflow (6.1 + 6.4)
- `.github/workflows/deploy.yml` — expanded staging smoke (4 checks), expanded production smoke (4 checks + deploy marker in Step Summary)

### Rollback script (6.2)
- `scripts/rollback.sh` — new, executable
- `package.json` — added `rollback` script

### Feature flags (6.3)
- `services/api-ts/src/core/feature-flags.ts` — parseFeatureFlags(), isEnabled(), /feature-flags endpoint
- `services/api-ts/src/core/feature-flags.test.ts` — 9 tests
- `services/api-ts/src/app.ts` — wired registerFeatureFlagRoutes

## CI Pipeline (final state)

```
lint-typecheck ──┐
unit-tests ──────┤
e2e ─────────────┤
contract ────────┤
build-api ───────┤───→ ci-gate (all must pass)
build-frontends ─┤
artifact-smoke ──┤
coverage-gate ───┘
```

Deploy pipeline:
```
build ──→ deploy-staging ──→ [staging smoke] ──→ (manual trigger) ──→ deploy-production ──→ [production smoke + deploy marker]
                                                                            ↓ (if smoke fails)
                                                                     bun run rollback
```

## Confidence Stack — Complete

All 6 layers implemented:

| Layer | Phase | Status |
|-------|-------|--------|
| 1. Coverage Integrity | Phase 1 | ✓ |
| 2. Behavior Traceability | Phase 2 | ✓ |
| 3. Release Gates | Phase 3 | ✓ |
| 4. Test Quality Hardening | Phase 4 | ✓ |
| 5. Artifact & Runtime Verification | Phase 5 | ✓ |
| 6. Release Safety | Phase 6 | ✓ |

> **Fix the ruler → trace every behavior → harden test quality → gate CI → verify shipped artifacts → ship with safety net.** Tests prevent. Artifacts prove. Release safety catches the rest.
