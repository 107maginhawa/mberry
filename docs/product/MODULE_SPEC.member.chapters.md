# MODULE_SPEC: member/chapters

Sub-domain #1 of 9 in the `association:member` mega-module rebuild (Step 6 R1).

## 1. Purpose

Owns the chapter-affiliation surface of an association: which member belongs
to which chapter (single primary + secondary affiliations), how a member
transfers between chapters, and how dues revenue is split between the
national org and each chapter via percentage-based royalty rules.

## 2. Bounded Context

In scope:
- Chapter affiliation records (`chapter_affiliation`) — many-to-one between
  person and chapter org, with primary/secondary status.
- Inter-chapter transfer state machine (`affiliation_transfer`):
  `requested → pendingTargetApproval → approved → completed`, plus the
  terminal `denied` branch from any pre-`completed` state.
- Royalty split configuration (`royalty_split`) — pairs a chapter id with
  `(nationalPercentage, chapterPercentage)` that must sum to 100.
- The narrow read endpoint `listOrgChapters` used by the member directory
  filter UI.

Out of scope:
- Per-chapter member directory listings — owned by `member/directory`.
- National-tier cross-chapter analytics (`/admin/national/chapters*`) —
  owned by `platformadmin` (different `.tsp`).
- Officer terms, positions, governance — owned by `member/governance`
  (R2 sub-domain).

Adjacent modules and the seams between them:

| Adjacent module | Seam |
|---|---|
| `person` | Subscribes to `person.deleted` and clears this person's affiliations + transfers. |
| `member/governance` | Officer-term + position checks gate chapter-scoped approvals (currently expressed via TypeSpec role extensions, not hand-wired). |
| `dues` | Consumes royalty split rules when computing payment distribution per invoice — read-only consumer. |
| `platformadmin` | National-tier aggregate views read this module's tables but do not mutate them. |

## 3. Handler Inventory

All handlers live at `services/api-ts/src/handlers/member/chapters/`.

| Handler file | Verb | Auth required | Audit action | Notes |
|---|---|---|---|---|
| createChapterAffiliation.ts | POST /association/member/chapter-affiliations | `association:admin` | `create chapter-affiliation` | Default `status=active`, `isPrimary` optional (defaults false). |
| getChapterAffiliation.ts | GET /association/member/chapter-affiliations/{id} | `association:admin`, `chapter:officer` | — | Read. |
| listChapterAffiliations.ts | GET /association/member/chapter-affiliations | `association:admin`, `chapter:officer` | — | Filters: `personId`, `chapterId`, `status`. |
| updateChapterAffiliation.ts | PATCH /association/member/chapter-affiliations/{id} | `association:admin` | `update chapter-affiliation` | PATCH semantics; `isPrimary` flip clears the previous primary in same tenant. |
| deleteChapterAffiliation.ts | DELETE /association/member/chapter-affiliations/{id} | `association:admin` | `delete chapter-affiliation` | 409 if it is the person's only active affiliation. |
| setPrimaryChapterAffiliation.ts | POST .../{id}/set-primary | `association:admin` | `update chapter-affiliation` | Idempotent — re-pinning the same row returns 200 unchanged. |
| listOrgChapters.ts | GET /association/member/chapters | `association:member` | — | Distinct chapter rows for the current org's directory filter. |
| createAffiliationTransfer.ts | POST /association/member/affiliation-transfers | `association:member:owner`, `association:admin` | `create affiliation-transfer` | Owner-self path lets a member submit; admin path lets staff submit on behalf. |
| getAffiliationTransfer.ts | GET .../{id} | `association:admin`, `chapter:officer` | — | Read. |
| listAffiliationTransfers.ts | GET /association/member/affiliation-transfers | `association:admin`, `chapter:officer` | — | Filters: `personId`, `status`, `fromChapterId`, `toChapterId`. |
| approveTransferBySource.ts | POST .../{id}/approve-source | `association:admin`, `chapter:officer` | `update affiliation-transfer` | `requested → pendingTargetApproval`; `pendingSourceApproval → approved` if target already approved. |
| approveTransferByTarget.ts | POST .../{id}/approve-target | `association:admin`, `chapter:officer` | `update affiliation-transfer` | Mirror of source approval. |
| denyAffiliationTransfer.ts | POST .../{id}/deny | `association:admin`, `chapter:officer` | `deny affiliation-transfer` | Terminal. 409 if already `denied` or `completed`. |
| completeAffiliationTransfer.ts | POST .../{id}/complete | `association:admin` | `complete affiliation-transfer` | Creates the new affiliation, marks the old `transferred`, sets primary on the new. 409 unless `approved`. |
| createRoyaltySplit.ts | POST /association/member/royalty-splits | `association:admin` | `create royalty-split` | 400 unless `nationalPercentage + chapterPercentage = 100`. |
| getRoyaltySplit.ts | GET /association/member/royalty-splits/{id} | `association:admin` | — | Read. |
| listRoyaltySplits.ts | GET /association/member/royalty-splits | `association:admin` | — | Filters: `membershipId`, `chapterId`. |
| updateRoyaltySplit.ts | PATCH /association/member/royalty-splits/{id} | `association:admin` | `update royalty-split` | PATCH must preserve sum=100. |
| deleteRoyaltySplit.ts | DELETE /association/member/royalty-splits/{id} | `association:admin` | `delete royalty-split` | — |

19 handlers · 11 mutating ops carry `x-audit` · 0 hand-wired `requireOfficerTerm` / `requirePosition`
(all auth expressed via role extensions on the operation).

## 4. TypeSpec source

`specs/api/src/association/member/chapters.tsp` — 19 operationIds across
4 interfaces: `ChapterAffiliationManagement`, `OrgChaptersManagement`,
`AffiliationTransferManagement`, `RoyaltySplitManagement`.

Routed via `specs/api/src/main.tsp` under `@tag("Member/Chapters")` on
all 4 interfaces (R1 retag — was `@tag("Association:Member")`; one
interface previously had no tag, which was the root cause of
`listOrgChapters.ts` landing in the `default/` module dir).

## 5. Database schema

- `services/api-ts/src/handlers/association:member/repos/chapters.schema.ts`
- `services/api-ts/src/handlers/association:member/repos/chapters.repo.ts`

Schema stays under `association:member/repos/` on purpose: `core/domain-event-consumers.ts`
imports `chapterAffiliations` + `affiliationTransfers` from this exact
path. Moving the schema would force a cascade rewrite for zero
behavioral gain.

Tables:
- `chapter_affiliation` — (personId, chapterId, organizationId, status, isPrimary, affiliatedAt)
- `affiliation_transfer` — (personId, fromChapterId, toChapterId, status, requestedBy, approvedBySource?, approvedByTarget?, completedAt?)
- `royalty_split` — (chapterId, nationalPercentage, chapterPercentage)

## 6. Cross-module dependencies

Emits domain events — none directly. State changes are routed through
audit middleware (`@extension("x-audit", ...)`).

Consumes events:
- `person.deleted` → `core/domain-event-consumers.ts` clears
  `chapterAffiliations` and `affiliationTransfers` for the deleted person.
  The handler here owns no consumer code; the consumer lives in
  `core/domain-event-consumers.ts` per the centralized cascade design.

Calls into other modules: none. All cross-module reach happens through
domain events, not direct handler calls.

## 7. Test coverage status

- **Unit tests**: 30 cases across 3 files in
  `services/api-ts/src/handlers/member/chapters/`:
  - `chapters.test.ts` (9 cases — affiliation contract + royalty domain rules)
  - `transfer-lifecycle.test.ts` (16 cases — full state machine)
  - `listOrgChapters.test.ts` (5 cases — read shape + edge nulls)
  All 19 handlers are referenced — 100% file coverage.

- **Contract scenarios**: 5 Hurl files in
  `specs/api/tests/contract/member/chapters/`:
  - `list-org-chapters.hurl`
  - `chapter-affiliation-crud.hurl` (full roundtrip — create → get → list → patch → set-primary → delete → 404)
  - `affiliation-transfer-lifecycle.hurl` (create → source-approve → target-approve → complete)
  - `affiliation-transfer-deny.hurl` (terminal deny + idempotency)
  - `chapter-affiliation-rbac.hurl` (401 + 403 edges)
  - `royalty-split-crud.hurl` (sum=100 constraint + CRUD)

- **E2E**: deferred to the broader chapters feature work in `apps/memberry/`
  (no chapter-management UI yet; module exposes admin-tier endpoints
  consumed by `apps/admin`).

## 8. Hand-wired routes (if any)

None. All 19 ops go through the generated route registry. No entries in
`docs/quality/HAND_WIRED_ROUTES.yaml`.

## 9. Known gotchas

- **Schema path asymmetry**: handlers live at `handlers/member/chapters/`
  but the schema lives at `handlers/association:member/repos/`. Domain
  events depend on the schema path — do not move the schema during R2-R9
  without first refactoring `core/domain-event-consumers.ts:45`.
- **Sum-to-100 invariant**: enforced in the repo (`RoyaltySplitRepository`).
  Pre-validation in the handler is not sufficient — the repo guards re-entry
  during PATCH where one field is omitted.
- **`isPrimary` flip is a tenant-scoped transaction**: setting primary on
  an affiliation clears it on all sibling affiliations for the same
  `(personId, organizationId)`. Direct `UPDATE` outside the repo will
  break this invariant.
- **Transfer completion creates a new affiliation row** rather than mutating
  the old. The old row is set to `status='transferred'`. Code that aggregates
  affiliations must filter `status='active'`.
- **`listOrgChapters` only returns chapters with at least one active
  affiliation in the current org** — a brand-new tenant with no members
  will see an empty list. Not a bug.

## 10. AI extension checklist

To add a new endpoint to this module:

1. Add the operation to `specs/api/src/association/member/chapters.tsp`
   with `@operationId(...)`, the appropriate verb, `@useAuth(bearerAuth)`,
   and the right `@extension("x-security-required-roles", ...)`. Add
   `@extension("x-audit", #{ action, resourceType })` for any mutation.
2. Wire the interface in `specs/api/src/main.tsp` under `@tag("Member/Chapters")`.
3. `cd specs/api && bun run build` — regenerates OpenAPI.
4. `cd services/api-ts && bun run generate` — emits handler stub at
   `services/api-ts/src/handlers/member/chapters/`.
5. Implement the handler (use `ChapterAffiliationRepository` etc. from
   `@/handlers/association:member/repos/chapters.repo`).
6. Add unit tests in `member/chapters/*.test.ts`.
7. Add at least one contract scenario in
   `specs/api/tests/contract/member/chapters/`.
8. Run: `bun run check:sdk-compat` — must show 0 op drift after baseline
   is unfrozen (post-Step-6 close).

Forbidden:
- Editing `services/api-ts/src/generated/**` (audit / route registry / validators).
- Hand-wiring routes in `services/api-ts/src/app.ts` for chapters operations.
- Inline `await auditAction(...)` / `requireOfficerTerm(ctx)` /
  `requirePosition(ctx, [...])` calls in this module's handlers —
  prefer `@extension` on the TypeSpec operation. (Currently zero inline
  calls — keep it that way.)
- Moving `repos/chapters.schema.ts` without first updating
  `core/domain-event-consumers.ts`.
