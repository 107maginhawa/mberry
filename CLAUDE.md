# CLAUDE.md

This file provides AI-specific guidance for Claude Code when working with the Monobase Application Platform.

## Documentation Map

For detailed information, refer to:
- **[README.md](./README.md)** - Project overview, installation, commands, technology stack
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Development workflows, coding standards, testing guidelines
- **[specs/api/CONTRACT.md](./specs/api/CONTRACT.md)** - Wire-level API contract every implementation must satisfy
- **[specs/api/IMPLEMENTING.md](./specs/api/IMPLEMENTING.md)** - Playbook for adding a new server impl or client SDK in any language

## Repository Overview

**Monobase Application Platform** — a vertical-neutral monorepo template for SaaS products. Provides identity, billing, scheduling, communications, storage, and notifications as composable primitives. Built on Bun for ~3× faster execution than Node.js.

**Key Technologies**: Bun, PostgreSQL, Drizzle ORM, Hono API, TypeSpec, TanStack Router, Better-Auth, OneSignal, S3/MinIO

**Spec-first, polyglot-ready monorepo.** The OpenAPI document at
`specs/api/dist/openapi/openapi.json` is the single source of truth.
Every server implementation and every client SDK is generated from it,
and any language can have its own (`-ts`, `-rs`, `-go`, …) sibling
workspace.

**Monorepo Structure**:
- `apps/` - Frontend applications:
  - `memberry/` - Product app — membership, dues, events, training, auth, profile, settings (port 3004)
  - `admin/` - Platform ops dashboard (port 3003)
- `services/` - Backend services:
  - `api-ts/` - Reference TypeScript API impl (Hono + Drizzle). Sibling impls (`api-rs`, `api-go`, …) are documented in `specs/api/IMPLEMENTING.md` but not yet present.

- `specs/api/` - TypeSpec API definitions; compiled to OpenAPI + TypeScript types. Also home of the contract docs and Hurl contract tests under `tests/contract/`.
- `packages/` - Shared packages:
  - `eslint-config/` - Shared ESLint flat configs (`base`, `react`, `next`)
  - `sdk-ts/` - Reference TypeScript client SDK (generated from OpenAPI via `@hey-api/openapi-ts`). Hand-written extras: client/transport, flows, utils/patch, react/use-optimistic-mutation.
  - `typescript-config/` - Shared TypeScript configs

  Note: `@monobase/api-spec` (consumed by SDK + apps for generated OpenAPI types) lives at `specs/api/`, not under `packages/`.
- `scripts/run-contract-tests.ts` - Runs the Hurl contract suite against `$API_URL`
- `.github/workflows/contract.yml` - CI: boots the impl, runs Hurl + Schemathesis
- `.claude/skills/` - 20 Claude Code skills for end-to-end development workflow (br-extract, commit, contract-scaffold, db-migrate, debug, dev-api, dev-app, develop, frontend-module, handler, module-review, persona-audit, prd, pre-commit, shadcn, test-api, test-contract, test-e2e, typecheck, typespec). Surface as `/skill-name` in Claude Code sessions.

## Business Domain Modules

The API service has **26 handler directories** under `services/api-ts/src/handlers/` (counts below exclude `*.test.ts` files; numbers may drift — re-run `find services/api-ts/src/handlers/<mod> -maxdepth 1 -name '*.ts' -not -name '*.test.ts' | wc -l` for the latest). Most route through TypeSpec-generated routes; a small set remains hand-wired in `services/api-ts/src/app.ts` for middleware-ordering or legacy reasons.

**Core Identity**:
1. **person** — Central PII hub (~27 handlers)

**Association** (mega-module domain — split deferred, see ROADMAP):
2. **association:member** — Membership, chapters, officers, positions, credits, credentials, elections, committees (~193 handlers). Owns spec content for m05-membership, m10-credit-tracking, m11-documents-credentials, m12-elections-governance, m19-committee-management.
3. **association:operations** — Analytics, training, events under association umbrella (~69 handlers).

**Platform**:
4. **platformadmin** — Admin-tier operations (~45 handlers).

**Membership** (legacy standalone, mostly migrated; some hand-wired):
5. **membership** — Applications, approvals, tiers (~15 handlers).
6. **dues** — Invoicing, payments, funds (~8 handlers).
7. **invite** — Org invitations (~4 handlers).

**Billing**:
8. **billing** — Stripe Connect integration (~16 handlers).

**Events/Training**:
9. **booking** — Time-based scheduling (~19 handlers).
10. **events** — Event management (~11 handlers).
11. **elections** — Voting endpoints not yet migrated to TypeSpec (~5 handlers, hand-wired for deleteElection legacy path).

**Note**: there is no `training/` handler directory — training/CPD lifecycle lives inside `association:member/` (CreditService, ProfessionalLicense, credit entries) and partly in `association:operations/`.

**Communications** (2 by-design bounded contexts):
12. **communication** — Templates, message queue, announcements, person subscriptions, saved segments (~43 handlers).
13. **comms** — Real-time WebSocket video calls, chat rooms, DMs (~13 handlers).

**Note**: there is no `communications/` (with `s`) handler directory — older docs called it out, but org announcements ended up inside `communication/`.

**Content**:
14. **documents** — Document management with access-log tracking (~16 handlers).
15. **certificates** — Certificate generation (~5 handlers; some impls re-exported from `association:member/`).
16. **storage** — File upload/download via S3/MinIO (~6 handlers).
17. **reviews** — NPS review system (~4 handlers).

**Marketplace**:
18. **marketplace** — Vendor + offers marketplace (~9 handlers).
19. **advertising** — Sponsored placement (~7 handlers).

**Compliance**:
20. **audit** — Compliance logging (~1 handler).
21. **email** — Transactional email queue (~13 handlers).
22. **notifs** — Multi-channel notifications via OneSignal (~5 handlers).
23. **surveys** — Surveys + polls (~16 handlers).
24. **jobs** — Background job registry (~7 handlers).
25. **onboarding** — Onboarding flow (~2 handlers).
26. **default** — Default route landing (~1 handler).

Authentication is handled by Better-Auth (integrated, not a separate module).

## Key Architectural Patterns

### Person-Centric Design
The Person module is the central PII safeguard for user data.

### Consent Management
Consent management is planned but **not yet implemented** in the database schema. No JSONB consent fields exist on the Person model currently. See `docs/_archive/oli/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` §7 for current Person table structure.

### Handler verb conventions

| Verb prefix | When to use |
|---|---|
| `get*` | Read a single resource by id (`getMembership`). |
| `list*` | List resources (`listMemberships`, optional filters). |
| `create*` | Create a brand new resource. **Default** when in doubt. |
| `update*` | Mutate an existing resource (PATCH semantics). |
| `delete*` | Remove a resource. |
| `upsert*` | Idempotent create-or-update (e.g., `upsertDuesFunds`). |
| `bulk*` | Operate on many at once (`bulkRecordPayments`). |
| `mark*` | Flip a state field (`markDuesInvoicePaid`). Lighter than `update*`. |
| `cancel*` / `complete*` / `approve*` / `deny*` / `revoke*` / `confirm*` / `cast*` / `certify*` | State-machine transitions where the verb names the transition (`cancelEvent`, `castBallot`). |
| `add*` | **Restricted.** Use only for appending into an existing parent (`addRosterMember`, `addTicketComment`) — not for top-level resource creation. Prefer `create*` for new resources. |
| `register*` | **Restricted to user-action semantics** where "register" is the domain term (`registerForEvent`). Otherwise prefer `create*Registration`. |
| `submit*` | **Restricted to user-submission semantics** where "submit" is the domain term (`submitPaymentProof`, `submitSurveyResponse`). Otherwise prefer `create*`. |

Do not introduce `new*` / `make*` / `do*` / `process*` prefixes. Resolve such drift to one of the verbs above. Frontend hook names follow `useGet*`, `useList*`, `useCreate*`, etc., generated from the corresponding operation id.

### API-First Development
Always follow this workflow:
1. Define APIs in TypeSpec (`specs/api/src/modules/`)
2. Generate OpenAPI + TypeScript types (`cd specs/api && bun run build`)
3. Generate routes/validators/handlers (`cd services/api-ts && bun run generate`)
4. Implement handler business logic (`services/api-ts/src/handlers/`)
5. Use generated types from `@monobase/api-spec` in frontends

**Why**: Type safety across frontend/backend, single source of truth, auto-generated docs

**⚠️ CRITICAL - Never Edit Generated Files**:
- `services/api-ts/src/generated/openapi/*` - Routes, validators, registry (regenerated every time)
- `services/api-ts/src/generated/better-auth/*` - Auth schema and specs
- `services/api-ts/src/generated/migrations/*` - Database migrations

**✅ Only Edit**:
- TypeSpec files (`specs/api/src/modules/*.tsp`)
- Handler implementations (`services/api-ts/src/handlers/{module}/*.ts`)
- Database schemas (`services/api-ts/src/handlers/{module}/repos/*.schema.ts`)

See [CONTRIBUTING.md#code-generation](./CONTRIBUTING.md#code-generation---do-not-edit) for complete details.

### Configuration Approach
Environment variables are parsed into typed configuration objects (see `services/api-ts/src/core/config.ts`). Not file-based configuration.

### OneSignal Multi-App Architecture
OneSignal follows an **app-agnostic pattern** like other services (Storage, Email, Billing):

**Single App ID Approach**:
- Use the **same** `ONESIGNAL_APP_ID` across all frontends
- Frontend apps: Set `VITE_ONESIGNAL_APP_ID` to the same value
- Backend API: Uses same app ID to send notifications

**Optional App Tagging**:
- Set `VITE_ONESIGNAL_APP_TAG=web` (or `mobile`, etc.) in frontend `.env` (optional)
- Apps auto-tag themselves on initialization
- Most notifications ignore tags (app-agnostic)
- Use `targetApp` parameter only for app-specific announcements

**Why This Works**:
- OneSignal uses `external_id` (person ID) to target users across devices/apps
- Users with multiple roles receive notifications in whichever app they're using

**API Pattern**:
```typescript
// Send to user (app-agnostic - default)
notificationRepo.createNotificationForModule({
  recipient: personId,
  type: 'booking.confirmed',
  channel: 'push',
  // No targetApp - reaches user in any app
});

// Send only to a specific app (rare)
notificationRepo.createNotificationForModule({
  recipient: personId,
  type: 'system',
  channel: 'push',
  targetApp: 'web', // Only if VITE_ONESIGNAL_APP_TAG is configured
});
```

### Module Structure Pattern
Backend handlers follow: **Router → Validators → Handlers → Repositories**

Each handler directory contains:
- Handler files (CRUD operations)
- `repos/` - Database repositories + schema
- `jobs/` - Background job definitions
- `utils/` - Module-specific utilities

## Compliance Considerations

When working with regulated data:

### Data Privacy
- **Audit Trails**: All user data access is logged with Pino
- **Consent Validation**: Consent management not yet implemented in schema (planned)
- **Role-Based Access**: Verify user roles via Better-Auth
- **Correlation IDs**: Include in all log entries for traceability

### Data Security
- Use Drizzle ORM for type-safe, SQL-injection-proof queries
- Validate all inputs with Zod schemas
- Never log sensitive personal information (PII) in plain text
- Follow secure patterns in existing handlers

## Critical Conventions

See [CONTRIBUTING.md#critical-conventions](./CONTRIBUTING.md#critical-conventions) for the full list. Key gotchas:
- **No `/api` prefix** in backend route registration (Vite proxy strips it)
- **Use `sonner`** for toasts, not shadcn `useToast`
- **Auth route is `/auth/sign-in`**, not `/login`
- **Restart API server** after adding new route registrations (no hot-reload)
- **NEVER delete handler files to fix type errors** — fix the types instead. If handlers have TS errors, update signatures to match generated validator types from `@/generated/openapi/validators`

## OpenAPI Specification

The canonical API reference is at: `specs/api/dist/openapi/openapi.json`

**Before implementing frontend features**:
1. Check the OpenAPI spec for endpoint definitions
2. Import TypeScript types from `@monobase/api-spec/types`
3. Validate your implementation matches the schema

**Helpful commands**: See [README.md#api-schema-reference](./README.md#api-schema-reference)

## Database Patterns

### Drizzle ORM Usage
- Use prepared statements for performance
- Leverage type inference from schema definitions
- Use transactions for multi-table operations
- Reference existing patterns in `services/api-ts/src/handlers/*/repos/`

### Migration Workflow
1. Modify schema in `services/api-ts/src/handlers/{module}/repos/*.schema.ts`
2. Generate migration: `cd services/api-ts && bun run db:generate`
3. Review generated SQL in `src/generated/migrations/`
4. Migrations run automatically on server start

**Details**: See [CONTRIBUTING.md#database-workflow](./CONTRIBUTING.md#database-workflow)

## Frontend Development

### Memberry App (Vite + TanStack Router)
- **Port**: 3004
- **Routing**: File-based in `src/routes/`
- **Auth**: Better-Auth with TanStack integration
- **Data Fetching**: TanStack Query
- **UI Components**: Radix UI primitives via `@/components` (shadcn/ui patterns)

The former `apps/account` features (auth, profile, settings) have been merged into `apps/memberry/`.

**Standards**: See [CONTRIBUTING.md#coding-standards](./CONTRIBUTING.md#coding-standards)

## Testing Approach

- **API**: Bun test framework (`cd services/api-ts && bun test`)
- **Frontend**: Playwright E2E tests (`cd apps/memberry && bun run test:e2e`)
- **Type Safety**: TypeScript checking across all workspaces

**Details**: See [CONTRIBUTING.md#testing-requirements](./CONTRIBUTING.md#testing-requirements)

## Common Commands Quick Reference

**Full command reference**: See [README.md#available-commands](./README.md#available-commands)

Essential commands:
```bash
# Install dependencies
bun install

# API-first workflow
cd specs/api && bun run build              # Generate OpenAPI + types
cd ../../services/api-ts && bun run generate  # Generate routes/validators

# Start development
cd services/api-ts && bun dev        # API on port 7213
cd apps/memberry && bun dev          # Memberry app on port 3004

# Database
cd services/api-ts && bun run db:generate  # Generate migration
cd services/api-ts && bun run db:studio    # Open Drizzle Studio

# Testing
cd services/api-ts && bun test             # API tests
cd apps/memberry && bun run test:e2e       # E2E tests
```

## Important Notes

### What Exists
- ✅ **apps/memberry** - Product app — membership, dues, events, training, auth, profile, settings (port 3004). Includes merged account features.
- ✅ **apps/admin** - Platform ops dashboard (port 3003)
- ✅ **services/api-ts/** - Reference Hono + Drizzle API
- ✅ **specs/api/** (`@monobase/api-spec`) - TypeSpec sources + generated OpenAPI + TS types
- ✅ **packages/sdk-ts/** - Auto-generated TanStack Query hooks + hand-written client/flows/utils
- ✅ **packages/eslint-config/** - Shared ESLint flat configs
- ✅ **specs/api/tests/contract/** - Hurl contract suite (97 .hurl files)
- ✅ **.claude/skills/** - 20 Claude Code skills for end-to-end development workflow
- ✅ **Authentication** via Better-Auth (integrated, not a separate module)
- ✅ **25 handler directories** under `services/api-ts/src/handlers/` (~58% with TypeSpec coverage)

### Multi-App Architecture
Production apps follow a 2-app pattern:
- `apps/memberry` (port 3004) — product app with all features: membership, dues, events, training, auth, profile, settings. The former `apps/account` has been fully merged here.
- `apps/admin` (port 3003) — ops/admin dashboard.

All apps share the same API and SDK.

### What's Intentionally Absent
- This template ships **no domain-vertical apps or modules**. Add your own
  (e.g., `apps/admin`, `services/api-ts/src/handlers/tenant/`) on top of the base.

### Deferred Work

All P0/P1 risks resolved (gate satisfied 2026-05-12). Planned work tracked in [ROADMAP.md](./ROADMAP.md).

- P1-11 (association:member mega-module split) deferred — original plan sized for 157 files, current count is ~193 (post-Phase-35 cleanup); see `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md` and re-scope before execution. See `.audits/PRODUCTION_AUDIT.md` for module ownership notes.
- Phase 35 migrated all 24 pre-migration routes to TypeSpec. A small number of routes remain hand-wired in `app.ts` by design (middleware ordering, public unauthenticated paths, or migrations explicitly deferred for complex governance flows like `deleteElection`).

## Development Protocol

New modules follow [VERTICAL_TDD.md](./VERTICAL_TDD.md) — test-first, vertical slices, per-module gate enforcement. See that doc for the exact step sequence.

## When in Doubt

1. Check [README.md](./README.md) for commands and setup
2. Check [CONTRIBUTING.md](./CONTRIBUTING.md) for development patterns
3. Check [VERTICAL_TDD.md](./VERTICAL_TDD.md) for test-first development protocol
4. Reference existing handlers in `services/api-ts/src/handlers/` for implementation patterns
5. Check OpenAPI spec at `specs/api/dist/openapi/openapi.json` for API contracts

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Memberry**

A generic healthcare Association Management System (AMS) built on the Monobase monorepo template. Manages membership, dues, events, training, credits, communications, and governance for healthcare professional associations. Starts with Philippine dental associations, expands to medical and global. Two apps: memberry (product app with auth/profile), admin (ops dashboard).

**Core Value:** Members can manage their association membership, track continuing education credits, and stay current on dues — from any device, with minimal friction.

### Constraints

- **Tech stack**: Bun, PostgreSQL, Drizzle ORM, Hono API, TypeSpec, TanStack Router — established, not changing
- **Spec-first**: OpenAPI at `specs/api/dist/openapi/openapi.json` is single source of truth
- **Module pattern**: Router → Validators → Handlers → Repositories (established, follow it)
- **Test-first**: VERTICAL_TDD.md protocol — vertical slices per module, not horizontal layers
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| br-extract | Extract business rules for a module from business-rules.md, derive test specs with edge cases, and update br-registry.json. Use before writing any tests, when starting a module, or "extract BRs", "what rules apply to {module}", "derive test cases". | `.claude/skills/br-extract/SKILL.md` |
| commit | Create a conventional commit with proper format and branch naming. Use after /pre-commit passes and changes are ready to ship. | `.claude/skills/commit/SKILL.md` |
| contract-scaffold | Generate FAILING Hurl contract test scenarios from OpenAPI spec for a module. RED phase for API contracts — scaffolds .hurl files with auth flows, happy paths, error codes, and multi-step journeys. Use after backend GREEN, "write contract tests", "scaffold hurl", "contract RED phase". | `.claude/skills/contract-scaffold/SKILL.md` |
| db-migrate | Create or modify Drizzle ORM database schemas and generate migrations. Use when adding tables, fields, indexes, or relationships to the database. | `.claude/skills/db-migrate/SKILL.md` |
| debug | Troubleshooting procedures for common development issues. Use when encountering errors with ports, database, types, builds, or dependencies. | `.claude/skills/debug/SKILL.md` |
| dev-api | Start the API development server on port 7213. Use when you need the backend running for development or testing. | `.claude/skills/dev-api/SKILL.md` |
| dev-app | Start the account app development server on port 3002. Use when you need the frontend running for development or testing. | `.claude/skills/dev-app/SKILL.md` |
| develop | Orchestrator agent that takes a PRD or feature description and drives end-to-end implementation by dispatching the right skills in the right order. Use when given a PRD, feature spec, or multi-step development task. | `.claude/skills/develop/SKILL.md` |
| frontend-module | Build a frontend feature in apps/account using the auto-generated @monobase/sdk-ts hooks. Use when implementing UI for an existing API module or a new feature spanning routes/components/forms. | `.claude/skills/frontend-module/SKILL.md` |
| handler | Implement API handler business logic and database repository for a module. Use after /typespec has generated handler stubs. Follows the exact pattern from services/api-ts/src/handlers/person/createPerson.ts. | `.claude/skills/handler/SKILL.md` |
| module-review | Validate module completeness, consistency, test coverage, and boilerplate integrity. Use after implementing a module and before committing. Wired into /develop Phase 3 as mandatory gate. | `.claude/skills/module-review/SKILL.md` |
| persona-audit | Validate module user journeys against defined personas before implementation. Finds dead ends, missing states, role confusion, and unreachable features. Use before /develop, "audit persona journey", "who uses this", "journey audit", or when starting a new module. | `.claude/skills/persona-audit/SKILL.md` |
| prd | Analyze a PRD (Product Requirements Document) and produce a structured technical implementation plan mapped to the Monobase monorepo patterns. Use when given a PRD file, pasted requirements, or feature description that needs to be broken down into implementation tasks. | `.claude/skills/prd/SKILL.md` |
| pre-commit | Run the full pre-commit verification checklist (typecheck + tests + build). Use before committing any changes to ensure everything passes. | `.claude/skills/pre-commit/SKILL.md` |
| shadcn | Add shadcn/ui components to a frontend app using the CLI. NEVER manually create or edit files in src/components/ui/. Use when a component needs a new shadcn/ui primitive. | `.claude/skills/shadcn/SKILL.md` |
| test-api | Run API service unit tests using the Bun test runner. Use after implementing handlers or making backend changes to verify correctness. | `.claude/skills/test-api/SKILL.md` |
| test-contract | Run the Hurl contract suite against any running API impl on $API_URL. Use after handler changes, before shipping API work, or to verify a new server impl is contract-compliant. | `.claude/skills/test-contract/SKILL.md` |
| test-e2e | Run Playwright E2E tests for frontend apps. Use after implementing frontend features or before shipping UI changes. | `.claude/skills/test-e2e/SKILL.md` |
| typecheck | Run TypeScript type checking across all workspaces (API service and frontend apps). Use before committing or when diagnosing type errors. | `.claude/skills/typecheck/SKILL.md` |
| typespec | Author TypeSpec API definitions and run the full code generation pipeline (OpenAPI + types + routes + validators + handler stubs). Use when creating new API endpoints or modifying existing ones. | `.claude/skills/typespec/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
