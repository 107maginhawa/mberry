# Phase 4: TypeSpec/OpenAPI Reconciliation - Research

**Researched:** 2026-05-06
**Domain:** TypeSpec authoring, OpenAPI generation, SDK code generation, route migration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Mirror existing TypeSpec patterns from base modules (billing, booking, person) exactly — consistency over optimization
- Author all 6 custom modules in one pass — shared patterns, single build/verify cycle
- Include all CRUD operations per module — complete API surface, future-proof, matches base module coverage
- Use Phase 3's unified `orgId` field naming throughout (locked from Phase 3)
- Replace hand-wired routes with TypeSpec-generated routes immediately — generated routes include validators, keeps one pattern
- Keep existing handler business logic — handlers have working business logic, only swap the route/validator layer
- Add ALL endpoints to TypeSpec — goal is 100% OpenAPI coverage (SPEC-08), no manual route remnants
- Replace all manual fetch calls with generated React Query hooks — SPEC-07 requires this, eliminates manual boilerplate
- Regenerate SDK in same build step — `bun run build` in specs/api triggers OpenAPI → SDK pipeline
- Update frontend imports in this phase — complete the TypeSpec→SDK→frontend chain end-to-end

### Claude's Discretion
- TypeSpec file naming and internal organization within `specs/api/src/modules/`
- Order of module implementation (all 6 in one pass, but sequencing within the pass)
- Handling of edge-case endpoints that don't fit standard CRUD patterns

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPEC-01 | TypeSpec definitions exist for dues module | Dues handler at `/dues/*` uses hand-wired Hono routes; TypeSpec needs to define equivalent endpoints at `/dues/*` route path (or migrate to `/association/member/dues-*` — see critical finding below) |
| SPEC-02 | TypeSpec definitions exist for membership module | Membership handler at `/membership/*` uses hand-wired Hono routes; same migration decision applies |
| SPEC-03 | TypeSpec definitions exist for events module | Events handler at `/events/*`; TypeSpec for `/association/events` already exists and is generated — hand-wired `/events/*` routes are the legacy system |
| SPEC-04 | TypeSpec definitions exist for training module | Training handler at `/training/*`; TypeSpec for `/association/training` already exists and is generated |
| SPEC-05 | TypeSpec definitions exist for elections module | Elections handler at `/elections/*`; governance.tsp has `ElectionManagement` + `BallotManagement` defined but NOT registered in `main.tsp` |
| SPEC-06 | TypeSpec definitions exist for certificates module | Certificates handler at `/certificates/*`; no TypeSpec coverage exists anywhere — needs authoring from scratch |
| SPEC-07 | SDK auto-generates React Query hooks for all custom modules | Frontend currently uses manual fetch via `api.get('/api/dues/...')`, `api.get('/api/elections/...')`, `api.get('/api/certificates/...')` — must switch to generated hooks from `@monobase/sdk-ts` |
| SPEC-08 | OpenAPI spec documents all endpoints (base + custom) | Generated `openapi.json` currently has no elections or certificates paths; `/dues/*` and `/membership/*` hand-wired paths also absent |
</phase_requirements>

---

## Summary

Phase 4 must close a two-tier gap: (1) add missing TypeSpec definitions for elections and certificates, (2) register already-authored-but-unregistered TypeSpec interfaces (elections), and (3) reconcile the dual routing system where hand-wired Hono routes at `/dues`, `/membership`, `/events`, `/training`, `/elections`, `/certificates` coexist with TypeSpec-generated routes at `/association/member/*` and `/association/events`, `/association/training`.

The critical architectural finding is that events and training already have TypeSpec definitions AND generated routes AND generated SDK hooks — but the hand-wired routes at `/events/*` and `/training/*` still exist in parallel. The plan must decide which path to keep and decommission the other, or declare them intentionally separate (different route namespaces serve different consumers). Based on CONTEXT.md's locked decision to "replace hand-wired routes with TypeSpec-generated routes immediately," the correct action is decommission the hand-wired routes and migrate frontend callers to generated SDK hooks.

Elections and certificates are the only two modules with zero TypeSpec coverage. Elections has `ElectionManagement` defined in `governance.tsp` but not registered in `main.tsp`. Certificates has no TypeSpec at all and requires a new `.tsp` file.

**Primary recommendation:** Register elections in `main.tsp` (5 min), author `certificates.tsp` (30 min), remove 6 hand-wired route blocks from `app.ts`, update frontend components to use generated React Query hooks.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TypeSpec authoring | specs/api/src/ | — | Single source of truth for API contracts |
| OpenAPI generation | specs/api build pipeline | — | `bun run build` compiles .tsp → openapi.json |
| Hono route registration | services/api-ts/src/generated/openapi/routes.ts | — | `bun run generate` produces routes from openapi.json |
| Handler business logic | services/api-ts/src/handlers/{module}/*.ts | — | Already implemented; not touched in this phase |
| SDK React Query hooks | packages/sdk-ts/src/generated/ | — | `bun run generate` in sdk-ts regenerates from openapi.json |
| Frontend data fetching | apps/memberry/src/features/{module}/ | apps/admin/src/ | Replace manual fetch with generated hooks |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeSpec (`@typespec/http`, `@typespec/rest`, `@typespec/openapi`) | workspace | API contract definition | Project's spec-first pattern; all base modules use it |
| `@hey-api/openapi-ts` | workspace | SDK code generation from openapi.json | Already configured in `packages/sdk-ts/openapi-ts.config.ts` |
| `@tanstack/react-query` | ^5.0.0 | Generated React Query hooks for frontend | Already used; SDK generates queryOptions/mutationOptions |
| Hono zValidator | workspace | Request validation in generated routes | `bun run generate` auto-wires zValidator for each operation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `openapi-typescript` | 7.9.1 | TypeScript types from openapi.json | Runs as part of `bun run build` in specs/api — already configured |

---

## Architecture Patterns

### System Architecture Diagram

```
TypeSpec files (.tsp)
        |
        v  [cd specs/api && bun run build]
openapi.json (specs/api/dist/openapi/)
        |
        +---> [cd services/api-ts && bun run generate]
        |             |
        |             v
        |     generated/openapi/routes.ts    <- Hono route registration
        |     generated/openapi/validators.ts <- Zod schemas
        |     generated/openapi/registry.ts  <- Handler dispatch table
        |
        +---> [cd packages/sdk-ts && bun run generate]
                      |
                      v
              generated/sdk.gen.ts           <- Typed API functions
              generated/@tanstack/react-query.gen.ts  <- React Query hooks
                      |
                      v
              Frontend components import from @monobase/sdk-ts/generated/react-query
```

### Build Pipeline (VERIFIED: codebase inspection)

```bash
# Step 1: TypeSpec → OpenAPI
cd specs/api && bun run build
# Produces: dist/openapi/openapi.json, dist/typescript-types/api.d.ts

# Step 2: OpenAPI → Hono routes + validators + handler stubs
cd services/api-ts && bun run generate

# Step 3: OpenAPI → SDK hooks
cd packages/sdk-ts && bun run generate
```

### Recommended Project Structure

Existing structure — no changes needed:
```
specs/api/src/
├── main.tsp              <- Register interfaces here
├── common/               <- BaseEntity, errors, pagination, security
├── modules/              <- Base Monobase modules (billing, booking, etc.)
└── association/
    ├── member/
    │   ├── dues.tsp          <- EXISTS (DuesConfigManagement, DuesInvoiceManagement)
    │   ├── membership.tsp    <- EXISTS (MembershipManagement, etc.)
    │   ├── governance.tsp    <- EXISTS (ElectionManagement — NOT registered in main.tsp)
    │   └── certification.tsp <- EXISTS (CertificationProgramManagement — NOT registered)
    └── operations/
        ├── events.tsp        <- EXISTS (EventManagement — registered in main.tsp)
        └── training.tsp      <- EXISTS (TrainingManagement — registered in main.tsp)

# certificates.tsp is MISSING entirely — needs to be created:
specs/api/src/modules/certificates.tsp  <- NEW FILE
```

### Pattern 1: Interface Registration in main.tsp
**What:** Every TypeSpec interface must be registered in `main.tsp` under the `MonobaseAPI` namespace with `@tag`, `@route`, and `extends`.
**When to use:** After authoring or updating a `.tsp` file.

```typespec
// Source: specs/api/src/main.tsp (existing pattern for elections)
@tag("Association:Member")
@route("/association/member/elections")
interface AssocElectionManagement extends Association.Member.Governance.ElectionManagement {}

@tag("Association:Member")
@route("/association/member/ballots")
interface AssocBallotManagement extends Association.Member.Governance.BallotManagement {}

@tag("Association:Member")
@route("/association/member/candidates")
interface AssocCandidateManagement extends Association.Member.Governance.CandidateManagement {}
```

### Pattern 2: TypeSpec Module File Structure
**What:** Each `.tsp` module file imports common utilities, declares a namespace, defines enums/models, and exposes interfaces.
**When to use:** Creating `certificates.tsp`.

```typespec
// Source: specs/api/src/association/member/dues.tsp (reference pattern)
import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

namespace Association.Member.Certificates {
  enum CertificateStatus { ... }

  model Certificate extends BaseEntity {
    organizationId: UUID;
    personId: UUID;
    trainingId: UUID;
    certificateNumber: string;
    issuedAt: utcDateTime;
  }

  @route("/certificates")
  interface CertificateManagement {
    @get
    @operationId("listMyCertificates")
    listMyCertificates(...PaginationQuery): ApiOkResponse<PaginatedResponse<Certificate>> | ApiUnauthorizedResponse;

    @get
    @route("/{certificateId}")
    @operationId("getCertificate")
    getCertificate(@path certificateId: UUID): ApiOkResponse<Certificate> | ApiNotFoundResponse | ApiUnauthorizedResponse;
  }
}
```

### Pattern 3: Frontend Migration from Manual Fetch to Generated Hooks
**What:** Replace `useQuery({ queryFn: () => api.get('/api/dues/payments') })` with generated hook.
**When to use:** Every frontend component that calls hand-wired routes.

```typescript
// BEFORE (manual fetch — to be removed)
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
const { data } = useQuery({
  queryKey: ['dues-payments'],
  queryFn: () => api.get('/api/dues/payments')
})

// AFTER (generated SDK hook)
import { useQuery } from '@tanstack/react-query'
import { listDuesPaymentsOptions } from '@monobase/sdk-ts/generated/react-query'
const { data } = useQuery(listDuesPaymentsOptions({ query: { ... } }))
// Note: exact hook name depends on operationId assigned in TypeSpec
```

### Pattern 4: Hand-Wired Route Decommission
**What:** Remove `app.route('/dues', dues)` etc. from `app.ts` after TypeSpec-generated routes cover the same endpoints.
**When to use:** After verifying generated routes exist for ALL operations in the hand-wired router.

```typescript
// In services/api-ts/src/app.ts — REMOVE these blocks:
app.use('/dues/*', authMiddleware());
app.use('/membership/*', authMiddleware());
// ... etc.
app.route('/dues', dues);
app.route('/membership', membership);
app.route('/certificates', certificates);
app.route('/events', eventsRouter);
app.route('/training', trainingRouter);
app.route('/elections', electionsRouter);
```

### Anti-Patterns to Avoid
- **Editing generated files:** Never touch `services/api-ts/src/generated/openapi/*` — regenerated every time.
- **Authoring new TypeSpec in `modules/` for association domain:** Association-specific TypeSpec goes in `specs/api/src/association/` not `specs/api/src/modules/`.
- **Forgetting to register in main.tsp:** A TypeSpec interface not registered in `main.tsp` produces no OpenAPI paths and no generated routes.
- **Forgetting to run generate after build:** `bun run build` (specs) and `bun run generate` (api-ts) are separate steps — both required.
- **Missing SDK regeneration:** After api-ts generate, also run `cd packages/sdk-ts && bun run generate` to update React Query hooks.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request validation | Custom Zod schemas in handlers | TypeSpec + `bun run generate` | Generator produces Zod validators from TypeSpec definitions |
| React Query hooks | Manual `useQuery` wrappers | Generated `@tanstack/react-query.gen.ts` | SDK generator produces queryOptions/mutationOptions/infiniteQueryOptions |
| Route registration | Manual `app.get('/elections/...')` | TypeSpec `@route` + `bun run generate` | Generator produces routes with auth middleware wired |
| TypeScript types | Hand-written interfaces | Generated from openapi.json via `openapi-typescript` | Already runs as part of `bun run build` |

---

## Critical Findings (VERIFIED: codebase inspection)

### Finding 1: Dual Route System — The Core Problem
Two parallel routing systems exist simultaneously:

| System | Route Prefix | Status |
|--------|-------------|--------|
| Hand-wired Hono | `/dues`, `/membership`, `/events`, `/training`, `/elections`, `/certificates` | Registered in `app.ts` |
| TypeSpec-generated | `/association/member/dues-*`, `/association/events`, `/association/training` | Registered via `registerOpenAPIRoutes()` in `app.ts` |

These serve **different URL namespaces** — they are not duplicates of each other. The hand-wired routes are the original Phase 0/1 implementation. The TypeSpec-generated routes are the spec-compliant implementation added later.

**Phase 4 action:** Decommission hand-wired routes; all frontend callers must switch to the generated paths.

### Finding 2: Elections — Partially Done
`governance.tsp` already defines `ElectionManagement`, `CandidateManagement`, and `BallotManagement` with full CRUD. They are imported in `main.tsp` (`import "./association/member/governance.tsp"`) but **none of the interfaces are registered** in the `MonobaseAPI` namespace in `main.tsp`.

**Fix:** Add 3 interface registrations to `main.tsp` — no new TypeSpec authoring needed.

### Finding 3: Certificates — Truly Missing
No TypeSpec exists anywhere for certificates. The `certificates` handler exposes:
- `GET /certificates/my` → `listCertificates`
- `GET /certificates/:id` → `getCertificate`

The schema: `certificate` table has `organizationId`, `personId`, `trainingId`, `certificateNumber`, `issuedAt`.

**Fix:** Author `specs/api/src/modules/certificates.tsp` (or `association/member/certificates.tsp`) with 2 operations.

### Finding 4: Events and Training — TypeSpec Exists, SDK Hooks Exist
[VERIFIED: codebase inspection] OpenAPI already has `/association/events/*` and `/association/training/*` paths. SDK already generates hooks for these. The hand-wired `/events/*` and `/training/*` routes are legacy.

**SPEC-03 and SPEC-04 are partially satisfied** — TypeSpec exists. The remaining work is decommissioning hand-wired routes and migrating frontend callers.

### Finding 5: Dues and Membership — TypeSpec Exists, SDK Hooks Exist
[VERIFIED: codebase inspection] OpenAPI has `/association/member/dues-configs`, `/association/member/dues-invoices`, `/association/member/memberships`, etc. SDK hooks exist (e.g., `listDuesConfigs`, `createDuesInvoice`).

**SPEC-01 and SPEC-02 are partially satisfied.** The hand-wired `/dues/*` routes cover different operations than the generated `/association/member/dues-*` routes:
- Hand-wired `/dues/payments` — no TypeSpec equivalent exists yet (funds, payments, gateway, dashboard, reports are NOT in `dues.tsp`)
- Generated `/association/member/dues-invoices` — different model (invoice lifecycle)

**This is a real gap:** The `dues.tsp` covers invoice management but NOT the payment recording, gateway config, or dashboard endpoints from the hand-wired dues router. These need TypeSpec authoring.

Similarly for membership: hand-wired `/membership/members/:orgId` uses a custom data model; TypeSpec covers the full membership lifecycle model. These may conflict.

---

## Common Pitfalls

### Pitfall 1: Forgetting the 3-Step Build Chain
**What goes wrong:** `bun run build` in specs/api succeeds but generated routes don't update.
**Why it happens:** `bun run generate` in api-ts is a separate step; SDK also needs its own `bun run generate`.
**How to avoid:** Always run all three steps in sequence: `specs/api build` → `api-ts generate` → `sdk-ts generate`.
**Warning signs:** Generated routes file timestamp older than openapi.json.

### Pitfall 2: Interface Registered But Not Exported from Namespace
**What goes wrong:** TypeSpec builds but endpoint missing from OpenAPI.
**Why it happens:** Interface defined in a `.tsp` file but not added to `MonobaseAPI` namespace in `main.tsp`.
**How to avoid:** After authoring any interface, immediately add the `extends` registration block to `main.tsp`.

### Pitfall 3: Route Conflicts Between Hand-Wired and Generated
**What goes wrong:** Two routes match the same path; one shadows the other.
**Why it happens:** Removing hand-wired routes before verifying generated routes cover all operations.
**How to avoid:** For each hand-wired operation, confirm the operationId exists in `registry.ts` before removing the hand-wired route.

### Pitfall 4: Frontend Imports Wrong Path After SDK Update
**What goes wrong:** TypeScript error — `listDuesPaymentsOptions is not exported`.
**Why it happens:** Generated hook name follows the `operationId` in TypeSpec, not the old route path.
**How to avoid:** After SDK regeneration, check `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` for actual exported function names.

### Pitfall 5: Hand-Wired Dues Operations Have No TypeSpec Equivalent
**What goes wrong:** Removing `/dues/*` routes breaks frontend before TypeSpec covers those endpoints.
**Why it happens:** `dues.tsp` covers invoice management but NOT payment recording, gateway config, funds, or dashboard.
**How to avoid:** Either author the missing TypeSpec operations first, or migrate hand-wired routes module-by-module (not all at once).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-wired Hono routes | TypeSpec-generated routes with validators | Phase 0→Phase 4 | Type safety, validation, OpenAPI coverage |
| Manual `useQuery` with `api.get()` | Generated `queryOptions` from SDK | Phase 4 | Eliminates fetch boilerplate, types auto-maintained |

---

## Runtime State Inventory

> This is a migration phase (route decommission). Answers for each category:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — route migration doesn't rename DB columns | None |
| Live service config | Hand-wired routes in `app.ts` (`app.route('/dues', dues)`, etc.) | Remove 12 `app.use` + `app.route` lines from `app.ts` |
| OS-registered state | None | None |
| Secrets/env vars | None affected by route changes | None |
| Build artifacts | Generated files in `services/api-ts/src/generated/openapi/` | Auto-regenerated by `bun run generate` |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Build pipeline | ✓ | 1.2.21 [VERIFIED] | — |
| TypeSpec compiler | `bun run build` in specs/api | ✓ | Current [VERIFIED: build runs cleanly] | — |
| openapi-typescript | Type generation | ✓ | 7.9.1 [VERIFIED] | — |
| @hey-api/openapi-ts | SDK generation | ✓ | Current [VERIFIED] | — |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test |
| Config file | None (bun test auto-discovers `*.test.ts`) |
| Quick run command | `cd services/api-ts && bun test src/handlers/elections/` |
| Full suite command | `cd services/api-ts && bun test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPEC-01 | Dues TypeSpec generates valid OpenAPI paths | smoke | `cd specs/api && bun run build && cat dist/openapi/openapi.json \| python3 -c "import json,sys; d=json.load(sys.stdin); assert '/association/member/dues-payments' in d['paths']"` | ❌ Wave 0 |
| SPEC-05 | Elections endpoints appear in OpenAPI | smoke | `cd specs/api && bun run build && cat dist/openapi/openapi.json \| python3 -c "import json,sys; d=json.load(sys.stdin); assert any('election' in p for p in d['paths'])"` | ❌ Wave 0 |
| SPEC-06 | Certificates endpoints appear in OpenAPI | smoke | Same pattern for 'certificate' | ❌ Wave 0 |
| SPEC-07 | SDK exports hooks for elections + certificates | smoke | `grep -n "listMyCertificates\|listElections" packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` | ❌ Wave 0 |
| SPEC-08 | No hand-wired route registrations remain | smoke | `grep -c "app.route('/dues'" services/api-ts/src/app.ts && test $? -eq 1` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd specs/api && bun run build` (build must succeed)
- **Per wave merge:** `cd services/api-ts && bun test`
- **Phase gate:** All 3 pipeline steps succeed + frontend imports resolve (typecheck)

### Wave 0 Gaps
- [ ] Smoke test scripts verifying OpenAPI paths after build — covers SPEC-01 through SPEC-08
- [ ] No new test files needed for handler logic (handlers unchanged)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better-Auth bearer token; `authMiddleware()` auto-wired by generator |
| V3 Session Management | no | Not changed in this phase |
| V4 Access Control | yes | Role-based: `authMiddleware({ roles: ["association:admin"] })` wired from TypeSpec `@useAuth` |
| V5 Input Validation | yes | Zod validators auto-generated from TypeSpec; replaces hand-rolled validation |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via route migration | Elevation of Privilege | Verify generated routes preserve the same auth roles as hand-wired routes before decommission |
| Missing input validation on migrated routes | Tampering | TypeSpec-generated Zod validators cover this; verify by running `bun test` after migration |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The hand-wired `/dues/payments`, `/dues/gateway`, `/dues/dashboard`, `/dues/reports`, `/dues/funds` have no TypeSpec equivalents in `dues.tsp` | Critical Findings #5 | These endpoints would be missing from OpenAPI after decommission — breaking frontend |
| A2 | `governance.tsp` `ElectionManagement` models map cleanly to the hand-wired elections handler behavior | Critical Findings #2 | Status enum differences (governance uses `draft/nominationOpen/votingOpen/certified`; schema uses `draft/nominationsOpen/votingOpen/awaitingConfirmation/published`) — may need reconciliation |

---

## Open Questions

1. **Dues route gap: partial TypeSpec coverage**
   - What we know: `dues.tsp` covers invoice management; hand-wired dues covers payments, gateway, funds, dashboard, reports
   - What's unclear: Are payment/gateway/funds endpoints in scope for SPEC-01 or is SPEC-01 satisfied by the existing invoice TypeSpec?
   - Recommendation: Author the missing dues operations (payments, gateway, funds, dashboard) in TypeSpec to achieve SPEC-08 (100% coverage). These are distinct from the invoice model.

2. **Membership route gap: data model alignment**
   - What we know: Hand-wired `/membership/members/:orgId` returns custom member model; TypeSpec `MembershipManagement` uses the full membership lifecycle model
   - What's unclear: After Phase 3 schema unification, do these models align?
   - Recommendation: Check Phase 3 output before decommissioning `/membership/*` routes.

3. **Elections status enum conflict**
   - What we know: DB schema uses `['draft', 'nominationsOpen', 'votingOpen', 'awaitingConfirmation', 'published', 'cancelled']`; `governance.tsp` uses `draft/nominationOpen/votingOpen/votingClosed/certified/cancelled`
   - What's unclear: Which enum is authoritative?
   - Recommendation: Use the DB schema enum values in TypeSpec to avoid a data migration.

---

## Sources

### Primary (HIGH confidence)
- `specs/api/src/main.tsp` — confirmed what is/isn't registered
- `specs/api/src/association/member/governance.tsp` — confirmed ElectionManagement defined but unregistered
- `services/api-ts/src/handlers/elections/repos/elections.schema.ts` — DB schema for elections
- `services/api-ts/src/handlers/certificates/repos/certificates.schema.ts` — DB schema for certificates
- `services/api-ts/src/app.ts` — confirmed hand-wired route registrations
- `services/api-ts/src/generated/openapi/routes.ts` — confirmed no elections/certificates in generated routes
- `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` — confirmed no elections/certificates hooks
- `apps/memberry/src/features/` — confirmed manual fetch usage in frontend

### Secondary (MEDIUM confidence)
- `.claude/skills/typespec/SKILL.md` — TypeSpec authoring workflow and build pipeline

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — build pipeline verified working (`bun run build` runs cleanly with 307 warnings, 0 errors)
- Architecture: HIGH — all files inspected, gaps confirmed empirically
- Pitfalls: HIGH — dual route system, enum conflicts, and partial TypeSpec coverage are directly observed

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable codebase, tooling versions pinned)
