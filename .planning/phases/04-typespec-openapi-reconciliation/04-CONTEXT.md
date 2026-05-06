# Phase 4: TypeSpec/OpenAPI Reconciliation - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

All 6 custom modules (dues, membership, events, training, elections, certificates) get TypeSpec definitions that produce OpenAPI specs and auto-generated SDK hooks. Hand-wired routes are replaced with generated routes+validators. Frontend manual fetch calls are replaced with generated React Query hooks. After this phase, every endpoint in the system is documented in OpenAPI and accessible via auto-generated SDK.

</domain>

<decisions>
## Implementation Decisions

### TypeSpec Authoring Strategy
- Mirror existing TypeSpec patterns from base modules (billing, booking, person) exactly — consistency over optimization
- Author all 6 custom modules in one pass — shared patterns, single build/verify cycle
- Include all CRUD operations per module — complete API surface, future-proof, matches base module coverage
- Use Phase 3's unified `orgId` field naming throughout (locked from Phase 3)

### Route Migration Strategy
- Replace hand-wired routes with TypeSpec-generated routes immediately — generated routes include validators, keeps one pattern
- Keep existing handler business logic — handlers have working business logic, only swap the route/validator layer
- Add ALL endpoints to TypeSpec — goal is 100% OpenAPI coverage (SPEC-08), no manual route remnants

### SDK & Frontend Integration
- Replace all manual fetch calls with generated React Query hooks — SPEC-07 requires this, eliminates manual boilerplate
- Regenerate SDK in same build step — `bun run build` in specs/api triggers OpenAPI → SDK pipeline
- Update frontend imports in this phase — complete the TypeSpec→SDK→frontend chain end-to-end

### Claude's Discretion
- TypeSpec file naming and internal organization within `specs/api/src/modules/`
- Order of module implementation (all 6 in one pass, but sequencing within the pass)
- Handling of edge-case endpoints that don't fit standard CRUD patterns

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing TypeSpec modules at `specs/api/src/modules/` (billing.tsp, booking.tsp, person.tsp, etc.) — templates for custom modules
- TypeSpec build pipeline: `cd specs/api && bun run build` → OpenAPI + types
- SDK generation: `packages/sdk-ts/` auto-generates from OpenAPI via `@hey-api/openapi-ts`
- Route generation: `cd services/api-ts && bun run generate` produces routes + validators

### Established Patterns
- TypeSpec modules follow: `.tsp` definition file + `.md` documentation file
- Generated output: `services/api-ts/src/generated/openapi/` (routes, validators, registry)
- Handler pattern: Router → Validators → Handlers → Repositories
- SDK pattern: Generated TanStack Query hooks consumed by frontend apps

### Integration Points
- 6 custom handler directories: `services/api-ts/src/handlers/{dues,membership,events,training,elections,certificates}/`
- Frontend apps: `apps/account/`, `apps/memberry/` — import from `@monobase/sdk-ts`
- OpenAPI spec: `specs/api/dist/openapi/openapi.json` — single source of truth
- Route registration: `services/api-ts/src/index.ts` or equivalent app setup

</code_context>

<specifics>
## Specific Ideas

No specific requirements — follow established TypeSpec patterns from base modules.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
