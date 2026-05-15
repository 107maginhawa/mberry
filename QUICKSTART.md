# Quickstart

Get Memberry running locally in ~10 minutes.

## Prerequisites

- **Bun** >= 1.2.21 — [install](https://bun.sh)
- **PostgreSQL** >= 14 — local install or Docker
- **Node.js** >= 18 — some tooling needs it

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Start database

**Option A — Local Postgres:**
```bash
createdb monobase
```

**Option B — Docker (includes MinIO, Mailpit, Stripe mock):**
```bash
cd services/api-ts
docker compose -f docker-compose.deps.yml up -d
```

### 3. Configure environment

```bash
cp services/api-ts/.env.example services/api-ts/.env
cp apps/account/.env.example apps/account/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/memberry/.env.example apps/memberry/.env
```

If using local Postgres (not Docker), update `DATABASE_URL` in `services/api-ts/.env`:
```
DATABASE_URL=postgres://your-user@localhost:5432/monobase
```

### 4. Generate types and routes

```bash
cd specs/api && bun run build
cd ../../services/api-ts && bun run generate
```

### 5. Start the API server

```bash
cd services/api-ts
bun dev
```

Migrations run automatically on startup. API is at http://localhost:7213.

### 6. Seed data

With the API server running (step 5), open a new terminal:

```bash
cd services/api-ts
bun run db:seed       # Creates base data (association, orgs, 2 test users)
```

**Seed scripts (run in order if you want full demo data):**

| Script | Requires API running? | What it creates |
|--------|----------------------|-----------------|
| `db:seed` | Yes | 1 association, 2 orgs, tiers, categories, 2 test users |
| `db:seed-modules` | No | Sample data for events, training, billing, etc. |
| `db:seed-rich` | No | 50 memberships, positions, credits, payments, registrations |

`db:seed-scenarios` is the newer replacement that does all of the above via API-driven journeys (idempotent, safe to re-run).

### 7. Start frontend apps

```bash
# Terminal — Account app (auth, profile, settings)
cd apps/account && bun dev     # http://localhost:3002

# Terminal — Admin app (platform ops)
cd apps/admin && bun dev       # http://localhost:3003

# Terminal — Memberry app (membership, dues, events, training)
cd apps/memberry && bun dev    # http://localhost:3004
```

## Test credentials

After running `db:seed`, you can sign in at http://localhost:3002/auth/sign-in. Check the seed script output for the created email/password.

## Common commands

```bash
bun install                              # Install all deps
cd specs/api && bun run build            # Regenerate OpenAPI + types
cd services/api-ts && bun run generate   # Regenerate routes/validators
cd services/api-ts && bun test           # Run API tests
cd services/api-ts && bun run db:generate # Generate migration after schema change
cd services/api-ts && bun run db:studio  # Open Drizzle Studio (DB browser)
```

## Architecture at a glance

```
TypeSpec definitions (specs/api/)
    ↓ generates
OpenAPI spec + TypeScript types (@monobase/api-spec)
    ↓ generates
Routes + validators + handler stubs (services/api-ts/src/generated/)
    ↓ you implement
Handler business logic (services/api-ts/src/handlers/)
    ↓ generates
SDK with TanStack Query hooks (packages/sdk-ts/)
    ↓ consumed by
Frontend apps (apps/account, apps/admin, apps/memberry)
```

## Three apps

| App | Port | Purpose |
|-----|------|---------|
| **account** | 3002 | Auth, profile, settings — shared across all products |
| **admin** | 3003 | Platform ops dashboard — association management, feature flags |
| **memberry** | 3004 | Product app — membership, dues, events, training, credits |

## Next steps

- [CONTRIBUTING.md](./CONTRIBUTING.md) — development workflows and conventions
- [CLAUDE.md](./CLAUDE.md) — AI assistant guide (useful if you use Claude Code)
- [specs/api/CONTRACT.md](./specs/api/CONTRACT.md) — API wire contract
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — system architecture
