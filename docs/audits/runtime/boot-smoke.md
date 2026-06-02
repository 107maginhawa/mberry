<!-- oli:artifact boot-smoke v1.0 generated:2026-06-02 source:/oli-check --runtime (Tier 1) -->
# Boot-Smoke (Tier 1) — Memberry

**Run mode:** static (no servers booted by this agent — `--live` not passed)
**Run date:** 2026-06-02
**Agent:** /oli-check --runtime → Tier 1 (boot-smoke) source-scan
**Map version:** v6 (147 routes, 359 components, 450 API endpoints)
**Map staleness:** STALE-OVERLAP — apps/memberry working tree has 13 modified .tsx files since map snapshot (git_sha `f29971811da966f1d02e8e70c910d92095c65244`, map ts `2026-06-01T13:47:58Z`).
**Note:** Boot-smoke evidence here is source-scanned (configs, scripts, schema) and **immune to map staleness**. The stale-map WARN attaches to the Tier-2 walker plan, not to this Tier-1 result.

## Verdict — PASS (with 1 WARN, 2 INFO)

All three bootable surfaces have valid configs, no port collisions in the declared port matrix, and the Zod env schema added by commit `9b68988f` is self-consistent with the documented `.env.example` files. Boot would succeed against the docker-compose stack assuming `AUTH_SECRET` is set (the schema's only universal hard requirement).

## Bootable Surfaces

| Target | Port | Dev script | Config file | Verdict |
|--------|------|-----------|-------------|---------|
| `apps/memberry` (Vite + TanStack Router) | 3004 | `bun dev` → `vite` | `apps/memberry/vite.config.ts` | PASS — parses; proxy `/api → http://localhost:7213` (rewrites `^/api` → `''`); tanstack-router plugin generates `src/routeTree.gen.ts` |
| `apps/admin` (Vite + TanStack Router) | 3003 | `bun dev` → `vite` | `apps/admin/vite.config.ts` | PASS — parses; same `/api` proxy; `routeFileIgnorePattern: '.test.'` filter present |
| `services/api-ts` (Hono + Drizzle on Bun) | 7213 | `bun src/index.ts` | `services/api-ts/src/index.ts` + `core/config.ts` | PASS — Zod env schema `parseConfig()` validates fail-fast on missing `AUTH_SECRET`; defaults sane for dev |

## Docker-Compose Stack (Infra Dependencies)

| Service | Image | Host port | Health check | Verdict |
|---------|-------|-----------|--------------|---------|
| postgres | `postgres:16-alpine` | 5432 | `pg_isready` | PASS |
| minio | `minio/minio:latest` | 9000 (api) / 9001 (console) | `mc ready local` | PASS |
| createbuckets | `minio/mc:latest` | — | depends-on healthy minio | PASS (one-shot init) |
| mailpit | `axllent/mailpit:latest` | 1025 (SMTP) / 8025 (UI) | wget `/api/v1/info` | PASS |
| stripe-mock | `stripe/stripe-mock:latest` | 12111 | none declared | INFO — missing healthcheck; not blocking |
| loki | `grafana/loki:3.3.2` | 3100 | wget `/ready` | PASS |
| grafana | `grafana/grafana:11.4.0` | 3030 (external) → 3000 (internal) | wget `/api/health` | PASS |

Compose file: `docker-compose.yml` (root). Replaces the legacy `docker-compose.deps.yml` deleted in `b4b34c31`.

## Port Allocation Check

| Port | Owner | Conflict risk |
|------|-------|---------------|
| 3003 | `apps/admin` vite | none |
| 3004 | `apps/memberry` vite | none |
| 7213 | `services/api-ts` Hono | none |
| 5432 | postgres (compose) | OS default postgres on dev hosts — INFO |
| 9000/9001 | minio | none |
| 1025/8025 | mailpit | none |
| 12111 | stripe-mock | none |
| 3030 | grafana (mapped from internal 3000) | **WARN** — host port 3030 is unique, but the internal-mapped 3000 is the React/Vite default. Grafana provisioning uses the internal 3000 in its config; external access uses 3030. No host collision. |
| 3100 | loki | none |

No host-port collisions across the seven compose services + three app dev servers.

## Zod Env-Schema Consistency (commit 9b68988f)

`services/api-ts/src/core/config.ts` is the single env-validation surface. Checked against the three `.env.example` files:

| Check | Result |
|-------|--------|
| All keys in `services/api-ts/.env.example` present in `envSchema` | PASS (44/44 declared keys covered) |
| All required-in-prod keys (`DATABASE_URL`, `INTERNAL_SERVICE_TOKEN`, `AUTH_SECRET`) gated by `superRefine` | PASS — `superRefine` adds `addIssue` for missing `AUTH_SECRET` in any env, plus `DATABASE_URL`/`INTERNAL_SERVICE_TOKEN` only when `NODE_ENV=production` |
| Boolean-shaped vars use `boolish()` preprocessor (`'true'` / `'false'`) | PASS |
| CSV-shaped vars use `csvList()` preprocessor | PASS (`CORS_ORIGINS`, `AUTH_ADMIN_EMAILS`) |
| Port precedence `SERVER_PORT` → `PORT` → 7213 | PASS — preserved by `tryInt()` ladder in `parseConfig()` |
| `STORAGE_BUCKET` consistent across root `.env.example` and api-ts `.env.example` | **WARN** — root `.env.example` line 31 sets `STORAGE_BUCKET=memberry-dev`; `services/api-ts/.env.example` line 88 sets `STORAGE_BUCKET=monobase-files`; docker-compose default is `monobase-files`. Boot succeeds either way (schema is `z.string().default('monobase-files')`), but a contributor copying the root example then running `bun infra:up` against api-ts gets a mismatched bucket — uploads land in the wrong namespace. P3 doc-drift. |
| `CORS_ORIGINS` default covers actual frontend ports (3003/3004) | PASS in schema (`['http://localhost:3003', 'http://localhost:3004']`); **INFO** — `services/api-ts/.env.example` line 34 shows `CORS_ORIGINS=http://localhost:3000,http://localhost:7213` which is the *legacy* port pair. The schema default rescues anyone who deletes the line; anyone copying it as-is loses the frontend origins. P3 doc-drift. |
| `BETTER_AUTH_SECRETS` rotation format `version:key` validated | PASS — `parseSecrets()` throws on malformed entries |

## Frontend Build Sanity (Static)

Both `vite.config.ts` files compile-check cleanly:
- `apps/memberry/vite.config.ts` — explicit `port: 3004`, `tsConfigPaths`, `tanstackRouter` with generated route tree, `viteReact`, esbuild `pure: ['console.log']` (drops dev logs from prod bundles).
- `apps/admin/vite.config.ts` — explicit `port: 3003`, same plugin stack, `routeFileIgnorePattern: '.test.'` keeps test-suffixed files out of the route tree.

No obvious mis-config (missing plugin, wrong port literal, wrong proxy target). Vite would start.

## API Bootstrap Sanity (Static)

`services/api-ts/src/index.ts` chain:
1. `parseConfig()` (Zod) — fail-fast on bad env
2. Hono app + middleware stack
3. Drizzle migration runner (`migrations/` auto-applied on start)
4. Routes registered from `generated/openapi/routes.ts`
5. WebSocket comms upgrade
6. Listen on `config.server.host:config.server.port`

The `generate` script (`bun scripts/generate.ts`) regenerates routes/validators/registry — must run after any TypeSpec change before `bun dev` (per CLAUDE.md "Restart API server after adding new route registrations").

## Findings Summary

| Severity | Finding |
|----------|---------|
| WARN | Stripe-mock compose service lacks healthcheck. Non-blocking but means `bun infra:up` can return ready while stripe-mock is still binding. |
| WARN | `STORAGE_BUCKET` and `CORS_ORIGINS` default values diverge between root `.env.example` and `services/api-ts/.env.example`. Schema defaults rescue boot but doc-drift causes subtle silos. |
| INFO | Host port 3030 → container port 3000 mapping for Grafana means internal config references `:3000` while users access `:3030` — already correct, just worth noting for log triage. |
| INFO | No dependency-pinning probe done (lockfile-only check) — out of scope for Tier 1. |

## Was a Live Boot Attempted?

**No.** Per the dimension contract, this agent does NOT boot servers. The Tier-1 contract is met by source-scanning configs, scripts, schemas, and docker-compose for structural validity and port/env consistency. Live boot is the responsibility of `/oli-check --runtime --live` (Tier 3) and CI's standard `bun infra:up && bun dev` smoke check.

## What Would Make This BLOCK

- Zod schema fails to parse a documented `.env.example` key (would surface as a typecheck error on `parseConfig()`)
- Vite config syntax errors
- Port collision in declared host-port matrix
- Missing `dev` script in a workspace package.json
- docker-compose file invalid (yaml syntax / unknown service keys)

None of those triggered. Result stands at PASS with 2 WARN (compose healthcheck gap, env-example doc-drift) and 2 INFO.
