# Memberry

A deliberately small healthcare **Association Management System** for Philippine
dental chapters. The wedge is **money** — dues + renewals collected over PH
payment rails (GCash / bank transfer via PayMongo). Built on Bun.

Strategy + scope are locked — see **[DESIGN.md](./DESIGN.md)** (design law) and
**[CLAUDE.md](./CLAUDE.md)** (architecture, standards, current phase).

## Architecture: thin apps over a frozen, tested engine

```
memberry/
├── services/api-ts/   THE ENGINE — Hono + Drizzle, ~8000 tests, contract-gated.
│                      Frozen + additive-only. The PH-payment adapter is net-new
│                      code behind the billing seam.
├── specs/api/         TypeSpec → OpenAPI (single source of truth) → types + routes.
├── packages/
│   ├── sdk-ts/        Generated typed client (regenerate after any spec change).
│   ├── ui/            Shared design system — ALL apps build on this, no forks.
│   ├── eslint-config/ typescript-config/ vitest-test-shim/
├── apps/              (empty) — the lean apps are built next:
│   ├── org/           PLANNED — officer: roster, dues, renewals, events+pay.
│   ├── member/        PLANNED — thin dashboard + login-free pay-link page.
│   └── console/       PLANNED — basic platform-operator app.
└── docker/  testing/  scripts/  .github/
```

The previous full platform (`apps/memberry`, `apps/admin`, the 26-module product
docs) was deleted in the lean cleanup — full reference at `/desktop/memberry-full`.
The API engine and CI moat were kept untouched.

## Prerequisites

- **Bun** ≥ 1.2.21 ([bun.sh](https://bun.sh))
- **Docker** (Postgres + MinIO + mailpit via `docker-compose.yml`)
- **Hurl** — for the contract suite (`bun run test:contract`)

## Quick start

```bash
bun install
bun run infra:up                               # Postgres + MinIO + mail (docker)

cd specs/api && bun run build                  # OpenAPI + TS types
cd ../../services/api-ts && bun run generate    # routes/validators
bun run db:seed                                 # seed dev data
bun dev                                         # API on :7213
```

See [QUICKSTART.md](./QUICKSTART.md) for the short version.

## API-first workflow (the established loop)

TypeSpec (`specs/api/src/`) → `bun run build` → `cd services/api-ts && bun run
generate` → implement handler logic → regenerate the SDK (`bun run --filter
@monobase/sdk-ts generate`). Frontends import generated types from
`@monobase/api-spec`. **Never edit generated files.** Full standards in
[CLAUDE.md](./CLAUDE.md); dev patterns in [CONTRIBUTING.md](./CONTRIBUTING.md);
test protocol in [VERTICAL_TDD.md](./VERTICAL_TDD.md).

## Testing

```bash
cd services/api-ts && bun test          # engine unit + integration (real-PG)
bun run test:contract                   # Hurl contract suite (the cross-impl gate)
bun run typecheck                       # all workspaces
```

Contract scenarios live under `specs/api/tests/contract/`; CI
(`.github/workflows/contract.yml`) runs them on every PR. The OpenAPI spec at
`specs/api/dist/openapi/openapi.json` is the single source of truth — any
language can ship a sibling impl behind the same `$API_URL`
(see `specs/api/IMPLEMENTING.md`).

## Tech stack

Bun · PostgreSQL · Drizzle ORM · Hono · TypeSpec/OpenAPI · Better-Auth ·
React 19 + TanStack Router (lean apps) · `packages/ui` design system ·
PayMongo (PH payments, net-new) · S3/MinIO storage.
