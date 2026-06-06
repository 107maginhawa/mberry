# Codebase Orientation

> Quick-reference for any developer to understand what lives where, why it matters, and what to watch out for.

## Data Flow

```
TypeSpec (.tsp) → OpenAPI JSON → Generated Routes/Validators + SDK Hooks → Handlers → Repos → PostgreSQL
                                                                                                   ↑
Frontend Apps (Memberry, Admin) ── consume SDK hooks ── call API ──────────────────────────────────┘
```

## The Matrix

| Layer | Location | What Lives There |
|-------|----------|-----------------|
| **Frontend — Product** | `apps/memberry/src/` | TanStack Router file-based routes, React components, feature modules, hooks, providers, auth flows (port 3004). Main user-facing app — membership, dues, events, training, profile, settings. Uses `sonner` for toasts, auth at `/auth/sign-in`. |
| **Frontend — Admin** | `apps/admin/src/` | Platform ops dashboard (port 3003). Same SDK + conventions as Memberry. Routes, components, admin-specific views. Smaller surface area. |
| **Backend — API** | `services/api-ts/src/` | Hono server, middleware stack (auth, rate-limit, audit, security, org-context), core services (~30 files: auth, billing, crypto, database, email, jobs, logging, domain-events, config). Entry point for all backend logic. |
| **Backend — Handlers** | `services/api-ts/src/handlers/` | 25 module directories, ~400+ handler files. Each module = self-contained business domain (person, billing, booking, dues, comms, etc.). Pattern: Router → Validators → Handler → Repo. This is where 80% of dev work happens. Vertical slice architecture — each module owns its logic + data access. |
| **Backend — Repos + Schemas** | `services/api-ts/src/handlers/*/repos/` | `*.schema.ts` = Drizzle ORM table definitions (source of truth for DB). `*.repo.ts` = all database queries, type-safe, SQL-injection-proof. Schemas auto-generate migrations — edit carefully. |
| **Backend — Generated** | `services/api-ts/src/generated/` | Routes, Zod validators, migrations, Better-Auth schema. **Never edit** — regenerated from TypeSpec + schemas. Changes vanish silently. |
| **API Spec (Source of Truth)** | `specs/api/src/modules/` | TypeSpec `.tsp` definitions. Everything generates from this — OpenAPI, SDK, validators, types. Breaking change here breaks all layers. |
| **OpenAPI Output** | `specs/api/dist/openapi/openapi.json` | Compiled API contract. SDK and validators generate from this. **Never edit** — always fix TypeSpec source instead. |
| **Shared SDK** | `packages/sdk-ts/` | Auto-generated TanStack Query hooks (`.gen.ts` — don't touch) + hand-written client, transport, flows (billing-onboarding, file-upload), WebRTC utils. Frontend's bridge to backend. |
| **Shared UI** | `packages/ui/` | Reusable React components (Radix/shadcn patterns). Shared by both apps. Add components via `shadcn` CLI only — never create `components/ui/` files manually. |
| **Shared Config** | `packages/eslint-config/`, `packages/typescript-config/` | Lint + TS compiler rules for all workspaces. Changes affect every package — run full typecheck after edits. |
| **Unit Tests — API** | `services/api-ts/src/tests/` + colocated `*.test.ts` | Bun test runner. 400+ test files colocated next to handlers. Run after handler/repo changes: `cd services/api-ts && bun test` |
| **E2E Tests** | `apps/memberry/tests/e2e/` | Playwright specs organized by domain (auth, security, cross-org, officer-reviews). Run before shipping frontend: `bun run test:e2e` |
| **Contract Tests** | `specs/api/tests/` | 97 Hurl files verifying API matches spec. Failing = real bug, not flaky. Behavioral source of truth for API correctness. |
| **Business Rules** | `docs/`, `.planning/REQUIREMENTS.md` | Domain rules, requirements, architecture decisions, gap analysis, roadmap planning. Not code — context for why code exists. |
| **CI/CD** | `.github/workflows/` | Build, test, deploy, contract test pipelines. Quality gate for production. Test changes in PR branch first. |
| **Audit Artifacts** | Root `AUDIT_04_*`, `.planning/quick/` | Coverage audits, debt tracking, interactive element audits, codebase health reports. Reference material, not runtime code. |

## Module Anatomy

Every backend module under `services/api-ts/src/handlers/` follows vertical slice architecture:

```
handlers/{module}/
├── create{Module}.ts       ← Handler (you write this)
├── get{Module}.ts
├── repos/
│   ├── {module}.schema.ts  ← DB schema (careful)
│   └── {module}.repo.ts    ← Data access (you write this)
├── jobs/                   ← Background tasks (optional)
└── utils/                  ← Module helpers (optional)
```

## Rebuild Cheat Sheet

| You Changed | What To Do | What It Affects |
|------------|-----------|-----------------|
| TypeSpec (`.tsp`) | Build specs → generate service → restart API | Everything |
| DB Schema | Generate migration → restart API | Migrations, repos, handlers |
| Handler | Restart API | That endpoint only |
| Core Service | Restart API | All endpoints using it |
| Frontend code | Nothing — hot reload | That app only |

## Test Cheat Sheet

| Type | Command | When |
|------|---------|------|
| API Unit | `cd services/api-ts && bun test` | After handler/repo changes |
| E2E | `cd apps/memberry && bun run test:e2e` | Before shipping frontend |
| Contract | `bun run test:contract` | After API behavior changes |
| Typecheck | `bun run typecheck` | Before every commit |

## Structure Assessment

> Audited against industry best practices for Bun/TypeScript monorepos. Peer-reviewed by independent expert.

### What's Right

| Area | Rating | Notes |
|------|--------|-------|
| Monorepo layout | ✅ | `apps/` + `services/` + `packages/` + `specs/` — standard Bun workspace layout |
| Vertical slice handlers | ✅ | Each module owns its handlers + repos + tests. Zero cross-handler imports. Strong cohesion. |
| Spec-first API | ✅ | TypeSpec → OpenAPI is industry best practice (Stripe, PostHog follow this pattern) |
| Frontend structure | ✅ | Consistent kebab-case naming, clean route/feature hybrid organization |
| Package boundaries | ✅ | SDK, UI, configs well-separated with clean exports |
| Generated code placement | ✅ | Inside `src/` — required by Drizzle config + handler imports. Correct for this stack. |
| Test organization | ✅ | 400+ tests colocated with source. E2E properly separated. Consistent pattern. |

### What Needs Fixing

| Priority | Issue | Detail | Fix |
|----------|-------|--------|-----|
| **HIGH** | Core → handler dependency inversion | `core/email.ts` imports from `handlers/email/repos/` and `handlers/association:member/repos/`. `core/org-scoped-persons.ts` imports from handler repos. Core layer should never depend on handler layer. | Extract interfaces/ports in core, implement in handlers. Dependency should flow: handlers → core, never core → handlers. |
| **MEDIUM** | No incremental build caching | No Turborepo/Nx. Every `bun run build` rebuilds all workspaces from scratch. | Add Turborepo for task-level caching, or accept the trade-off while codebase is small. |
| **MEDIUM** | Domain boundary confusion | `comms/` AND `communication/` both exist as handler dirs. `membership/` AND `association:member/` both exist. New devs won't know which to use. | Document the distinction (comms = real-time WebSocket, communication = async templates). Consider renaming for clarity. |
| **LOW** | association:member mega-module | 316 files in one handler directory — 3x larger than any other module. | Add feature subfolders within: `association:member/{credentials,dues,lifecycle,governance}/` |
| **LOW** | Schema validation gap | Drizzle schema files scattered across 25+ handler dirs. One typo breaks migration generation for entire service. | Add schema validation step to pre-commit hook. |
