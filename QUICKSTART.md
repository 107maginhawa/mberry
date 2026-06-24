# Quickstart

Get the Memberry **engine** running locally in ~10 minutes. The lean frontend
apps (`apps/org`, `apps/member`, `apps/console`) are built next and not yet
present — see [CLAUDE.md](./CLAUDE.md) for the current phase.

## Prerequisites

- **Bun** ≥ 1.2.21 — [install](https://bun.sh)
- **Docker** — for Postgres + MinIO + Mailpit + stripe-mock

## Setup

```bash
# 1. Install
bun install

# 2. Infra (Postgres + MinIO + Mailpit + stripe-mock via docker-compose)
bun run infra:up

# 3. Env
cp services/api-ts/.env.example services/api-ts/.env
#   if using non-Docker Postgres, set DATABASE_URL in that file

# 4. Generate types + routes
cd specs/api && bun run build
cd ../../services/api-ts && bun run generate

# 5. Start the API (migrations run automatically on startup) → http://localhost:7213
bun dev

# 6. Seed dev data (in a second terminal, API running)
cd services/api-ts && bun run db:seed
```

## Common commands

```bash
cd specs/api && bun run build              # regenerate OpenAPI + types
cd services/api-ts && bun run generate     # regenerate routes/validators
cd services/api-ts && bun test             # engine unit + integration tests
bun run test:contract                      # Hurl contract suite
cd services/api-ts && bun run db:generate  # migration after a schema change
cd services/api-ts && bun run db:studio    # Drizzle Studio (DB browser)
```

## Architecture at a glance

```
TypeSpec (specs/api/)
   ↓ build
OpenAPI + TS types (@monobase/api-spec)
   ↓ generate
Routes + validators (services/api-ts/src/generated/)
   ↓ you implement
Handler logic (services/api-ts/src/handlers/)
   ↓ generate
Typed SDK + hooks (packages/sdk-ts/)
   ↓ consumed by
Lean apps on packages/ui (apps/org, apps/member, apps/console — planned)
```

## Next steps

- [CLAUDE.md](./CLAUDE.md) — architecture, Execution Standards, current phase
- [DESIGN.md](./DESIGN.md) — design law (accessibility baseline for older users)
- [VERTICAL_TDD.md](./VERTICAL_TDD.md) — test-first protocol
- [CONTRIBUTING.md](./CONTRIBUTING.md) — engine dev patterns
- [specs/api/CONTRACT.md](./specs/api/CONTRACT.md) — API wire contract
