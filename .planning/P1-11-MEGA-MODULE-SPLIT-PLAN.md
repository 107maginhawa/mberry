# P1-11: association:member Mega-Module Split Plan

**Created**: 2026-05-08
**Status**: Planning complete — execution is future work
**Source**: P0-P1-FIXES.md P1-11

---

## Problem

`services/api-ts/src/handlers/association:member/` contains **156 handler files + 14 test files + 14 repo/schema files** in a single directory. This causes:

- Merge conflicts on parallel work
- Cognitive overload navigating 180+ files
- Testing difficulty (can't run domain-specific test suites)
- Tight coupling between unrelated domains (elections ↔ dues ↔ directory)

## Current Structure

```
handlers/association:member/
├── 156 handler files (*.ts, non-test)
├── 14 test files (*.test.ts)
├── index.ts (router)
└── repos/
    ├── membership.{schema,repo}.ts    — core membership, applications, tiers, categories
    ├── dues.{schema,repo}.ts          — invoicing, payments, configs, financial
    ├── chapters.{schema,repo}.ts      — affiliations, transfers, royalty splits
    ├── governance.{schema,repo}.ts    — positions, officer terms
    ├── credentials.{schema,repo}.ts   — templates, digital credentials, licenses
    ├── credits.{schema,repo}.ts       — credit entries, compliance, transcripts
    └── directory.{schema,repo}.ts     — member directory profiles
```

## Proposed Split: 7 Sub-Modules

Aligned with existing TypeSpec domain boundaries in `specs/api/src/association/member/`.

### 1. `association:membership` (71 handlers)

**Domain**: Core membership lifecycle, dues, payments, institutional memberships
**TypeSpec**: `association/member/membership.tsp`, `association/member/dues.tsp`
**Repos**: `membership.{schema,repo}.ts`, `dues.{schema,repo}.ts`

Handlers include:
- Membership CRUD, applications, approval/rejection, renewal, termination
- Tiers, categories, roster, org-profile
- Dues config, invoicing, payments, webhooks, dunning, aging buckets
- Institutional memberships, seat allocation

**Rationale**: Membership and dues are tightly coupled (dues depend on membership status). Splitting them would create excessive cross-module imports. Keep as one module — still large but cohesive.

### 2. `association:chapters` (18 handlers)

**Domain**: Chapter affiliations, transfers, royalty splits
**TypeSpec**: `association/member/chapters.tsp`
**Repos**: `chapters.{schema,repo}.ts`

Handlers include:
- Chapter affiliation CRUD
- Transfer requests, approval (source/destination org)
- Royalty split configuration

**Rationale**: Self-contained domain with own schema. Only reads from membership to validate member exists.

### 3. `association:governance` (29 handlers)

**Domain**: Positions, officer terms, elections, ballots, nominations
**TypeSpec**: `association/member/governance.tsp`
**Repos**: `governance.{schema,repo}.ts`

Handlers include:
- Position management (CRUD)
- Officer term management (create, update, delete)
- Elections (create, open voting, close, certify)
- Candidates (nominate, withdraw)
- Ballots (cast, count)

**Rationale**: Elections and officer terms share the governance schema and are semantically inseparable. Merging keeps ballot → position → term lifecycle in one place.

### 4. `association:credentials` (14 handlers)

**Domain**: Credential templates, digital credentials, verification
**TypeSpec**: `association/member/credentials.tsp`
**Repos**: `credentials.{schema,repo}.ts`

Handlers include:
- Credential template CRUD
- Digital credential issuance, revocation
- Public credential verification
- Professional license management
- License renewal alerts

**Cross-module dependency**: `issueDigitalCredential` reads from `membership.repo` to verify active membership. After split, import via package path — no circular dependency since it's read-only.

### 5. `association:credits` (11 handlers)

**Domain**: CPD credit tracking, compliance reporting, transcripts
**TypeSpec**: `association/member/credits.tsp`
**Repos**: `credits.{schema,repo}.ts`

Handlers include:
- Credit entry CRUD (manual + system)
- Credit compliance report (officer view)
- Credit transcript generation
- Officer terms summary (cross-reference)

**Note**: `getCreditCompliance` and `listOfficerTermsSummary` already migrated to generated routes in P1-9.

### 6. `association:directory` (7 handlers)

**Domain**: Member directory profiles, public search
**TypeSpec**: `association/member/directory.tsp`
**Repos**: `directory.{schema,repo}.ts`

Handlers include:
- Directory profile CRUD
- Public profile view
- Directory search with filters

**Rationale**: Smallest module. Completely self-contained — only reads person data for display.

### 7. `association:certificates` (6 handlers)

**Domain**: Certificate generation and management
**TypeSpec**: `association/member/certificates.tsp`
**Repos**: Uses credentials repo for template data

Handlers include:
- Certificate template management
- Certificate generation from template
- Certificate verification

---

## Dependency Map

```
association:membership  ←── (reads) ── association:credentials
       ↑                                        ↑
       │ (reads member status)                   │ (reads templates)
       │                                         │
association:chapters    association:certificates ─┘
       
association:governance  (self-contained)
association:credits     ←── (reads membership for org context)
association:directory   ←── (reads person for display)
```

**No circular dependencies.** All cross-module reads flow one direction: toward `association:membership` as the core data source.

## Migration Strategy

### Phase 1: Create directories + move repos (low risk)

For each sub-module:
1. Create `handlers/{module}/` directory
2. Move repo files: `handlers/{module}/repos/`
3. Update import paths in moved files
4. Verify typecheck passes

### Phase 2: Move handlers (medium risk)

For each sub-module, ordered by independence (directory → certificates → credits → credentials → chapters → governance → membership):
1. Move handler files to new directory
2. Update imports in moved handlers
3. Update generated registry imports
4. Update router registrations
5. Run tests for moved handlers
6. Verify no broken imports across codebase

### Phase 3: Split router + update generated code

1. Create per-module `index.ts` router files
2. Update `services/api-ts/src/app.ts` to register sub-module routers
3. Re-run code generation to update registry paths
4. Run full test suite

### Phase 4: Clean up

1. Delete empty `association:member/` directory
2. Update CLAUDE.md module documentation
3. Update any references in planning docs

## Effort Estimates

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1: Create dirs + move repos | 2-3 hours | Low — no behavior change |
| Phase 2: Move handlers (per module) | 1-2 hours each × 7 = 7-14 hours | Medium — import path updates |
| Phase 3: Split router + codegen | 2-3 hours | Medium — route registration order |
| Phase 4: Cleanup | 1 hour | Low |
| **Total** | **12-21 hours** | |

## Execution Order

Start with smallest/most independent modules to validate the pattern:
1. `association:directory` (7 handlers, zero cross-deps)
2. `association:certificates` (6 handlers)
3. `association:credits` (11 handlers)
4. `association:credentials` (14 handlers, 1 cross-dep)
5. `association:chapters` (18 handlers)
6. `association:governance` (29 handlers)
7. `association:membership` (71 handlers — last, since everything depends on it)

## Success Criteria

- [ ] Each sub-module has its own directory under `handlers/`
- [ ] Each sub-module has its own `repos/` with relevant schema + repo files
- [ ] No handler file imports from another sub-module's `repos/` directly (use shared types)
- [ ] All existing tests pass without modification (only import path changes)
- [ ] `bun run typecheck` passes
- [ ] Generated routes still work (re-run `bun run generate`)
- [ ] No inline routes re-introduced in app.ts
