# Phase 3: Data Model Unification - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate the dual custom/TypeSpec-generated data model. Produce a single canonical schema per entity where Drizzle owns the DB definition and TypeSpec owns the API contract. Remove translation glue code (`tenantId` ↔ `organizationId`), standardize enum naming, and ensure all existing data survives migration with zero loss.

</domain>

<decisions>
## Implementation Decisions

### Identity Model Resolution
- **D-01:** `organizationId` is the canonical term (used in 15+ modules vs 3 for tenantId)
- **D-02:** Modules with both `tenantId` and `organizationId` — drop `tenantId` column, migrate data to `organizationId` via ALTER TABLE
- **D-03:** `organizationId` represents the association (dental/medical) that a member/resource belongs to
- **D-04:** Multi-org support via membership table (already modeled). Person has no direct org FK

### Schema Ownership Direction
- **D-05:** Dual-source model: Drizzle schemas = DB source of truth, TypeSpec = API contract source of truth. Alignment enforced by contract tests + type assertions
- **D-06:** "Unification" means: remove duplicate type definitions — each entity defined ONCE in Drizzle (DB) and ONCE in TypeSpec (API). No parallel definitions with different field names
- **D-07:** Long-term alignment via contract tests comparing Drizzle `InferSelectModel` types against `@monobase/api-spec` generated types

### Migration Strategy
- **D-08:** Single Drizzle migration with `ALTER TABLE RENAME COLUMN` — atomic, zero data loss
- **D-09:** Update seed scripts post-migration. Tests use Phase 0 deterministic fixture pattern
- **D-10:** Keep per-module enums (genuinely different state machines) but standardize naming convention to camelCase
- **D-11:** SDK regenerated from updated TypeSpec. No backward compat layer (pre-launch)

### Claude's Discretion
- Order of module migration (which modules first)
- Exact type assertion implementation (compile-time vs runtime)
- Whether to batch all renames in one migration or one-per-module

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `services/api-ts/src/core/database.schema.ts` — `baseEntityFields` shared by all 24 schema files
- `specs/api/src/modules/` — TypeSpec definitions for all API modules
- Phase 0 deterministic fixture helpers (`createTestUser`, `createTestOrg`, etc.)
- Existing Hurl contract tests in `specs/api/tests/contract/`

### Established Patterns
- Drizzle ORM with `pgTable` + `pgEnum` per module in `handlers/*/repos/*.schema.ts`
- TypeSpec → OpenAPI → `openapi-typescript` → `api.d.ts` pipeline
- `@monobase/api-spec` package exports types consumed by SDK and apps
- `baseEntityFields` provides id, createdAt, updatedAt, version, createdBy, updatedBy

### Integration Points
- 24 custom schema files across 15+ handler modules
- 3 modules use `tenantId`: training, events, membership
- `specs/api/dist/openapi/openapi.json` — regenerated from TypeSpec
- `packages/sdk-ts/` — regenerated from OpenAPI spec
- Seed scripts: `services/api-ts/src/seed.ts`, `seed-modules.ts`

### Key Files Affected
- `services/api-ts/src/handlers/association:operations/repos/training.schema.ts`
- `services/api-ts/src/handlers/association:operations/repos/events.schema.ts`
- `services/api-ts/src/handlers/association:member/repos/membership.schema.ts`
- All TypeSpec files in `specs/api/src/modules/` referencing `tenantId`
- Generated migrations in `services/api-ts/src/generated/migrations/`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — all recommendations accepted as-is. Standard approach: atomic rename migration, dual-source with test alignment, per-module enums with naming convention.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
