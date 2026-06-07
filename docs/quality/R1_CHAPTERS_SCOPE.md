# R1 Chapters — Scope Pass (R1.2)

Branch: `feature/member-rebuild` @ `14b5836f`
Generated: 2026-06-07

## Contract surface — `specs/api/src/association/member/chapters.tsp`

19 operationIds across 4 interfaces (all preserved verbatim per SDK_BASELINE_OPS.json freeze):

| Interface | OperationId | HTTP |
|---|---|---|
| ChapterAffiliationManagement | createChapterAffiliation | POST /association/member/chapter-affiliations |
| ChapterAffiliationManagement | getChapterAffiliation | GET /association/member/chapter-affiliations/:affiliationId |
| ChapterAffiliationManagement | listChapterAffiliations | GET /association/member/chapter-affiliations |
| ChapterAffiliationManagement | updateChapterAffiliation | PATCH /association/member/chapter-affiliations/:affiliationId |
| ChapterAffiliationManagement | deleteChapterAffiliation | DELETE /association/member/chapter-affiliations/:affiliationId |
| ChapterAffiliationManagement | setPrimaryChapterAffiliation | POST /association/member/chapter-affiliations/:affiliationId/set-primary |
| OrgChaptersManagement | listOrgChapters | GET /association/member/chapters |
| AffiliationTransferManagement | createAffiliationTransfer | POST /association/member/affiliation-transfers |
| AffiliationTransferManagement | getAffiliationTransfer | GET /association/member/affiliation-transfers/:transferId |
| AffiliationTransferManagement | listAffiliationTransfers | GET /association/member/affiliation-transfers |
| AffiliationTransferManagement | approveTransferBySource | POST .../approve-source |
| AffiliationTransferManagement | approveTransferByTarget | POST .../approve-target |
| AffiliationTransferManagement | denyAffiliationTransfer | POST .../deny |
| AffiliationTransferManagement | completeAffiliationTransfer | POST .../complete |
| RoyaltySplitManagement | createRoyaltySplit | POST /association/member/royalty-splits |
| RoyaltySplitManagement | getRoyaltySplit | GET /association/member/royalty-splits/:royaltySplitId |
| RoyaltySplitManagement | listRoyaltySplits | GET /association/member/royalty-splits |
| RoyaltySplitManagement | updateRoyaltySplit | PATCH /association/member/royalty-splits/:royaltySplitId |
| RoyaltySplitManagement | deleteRoyaltySplit | DELETE /association/member/royalty-splits/:royaltySplitId |

## Wipe-set (handler .ts to delete in R1.3)

18 in `services/api-ts/src/handlers/association:member/`:

```
createChapterAffiliation.ts
getChapterAffiliation.ts
listChapterAffiliations.ts
updateChapterAffiliation.ts
deleteChapterAffiliation.ts
setPrimaryChapterAffiliation.ts
createAffiliationTransfer.ts
getAffiliationTransfer.ts
listAffiliationTransfers.ts
approveTransferBySource.ts
approveTransferByTarget.ts
denyAffiliationTransfer.ts
completeAffiliationTransfer.ts
createRoyaltySplit.ts
getRoyaltySplit.ts
listRoyaltySplits.ts
updateRoyaltySplit.ts
deleteRoyaltySplit.ts
```

1 anomaly in `services/api-ts/src/handlers/default/`:

```
listOrgChapters.ts              (generator put it under default/, must consolidate to new module)
listOrgChapters.test.ts         (characterization — KEEP, move with handler)
```

Total handler .ts files: **19**

## Keep-set (do NOT delete)

| Path | Reason |
|---|---|
| `services/api-ts/src/handlers/association:member/chapters.test.ts` | Characterization spec — black-box exercises chapter affiliation + royalty handlers via routes |
| `services/api-ts/src/handlers/association:member/transfer-lifecycle.test.ts` | Characterization spec — affiliation transfer state-machine flows |
| `services/api-ts/src/handlers/default/listOrgChapters.test.ts` | Characterization spec — listOrgChapters response shape |
| `services/api-ts/src/handlers/association:member/repos/chapters.repo.ts` | Preserve (per user constraint, no redesign) |
| `services/api-ts/src/handlers/association:member/repos/chapters.schema.ts` | Preserve — `core/domain-event-consumers.ts:45` imports `chapterAffiliations, affiliationTransfers` from this exact path. Moving would force consumer rewrite. |

Decision: **repos stay at `association:member/repos/`**. Only handlers move to new module path. This keeps domain-event-consumer + test-utils/preload-pristine imports stable.

## Out-of-scope (different `.tsp`, different module — leave alone)

```
services/api-ts/src/handlers/platformadmin/listNationalChapters.ts
services/api-ts/src/handlers/platformadmin/getNationalChapterDetail.ts
services/api-ts/src/handlers/platformadmin/national-endpoints.test.ts
```

These come from `specs/api/src/modules/platform-admin-custom.tsp`, not `chapters.tsp`. The `/admin/national/chapters*` routes belong to the `platformadmin` rebuild sub-domain (R7 in the master plan).

## Consumers of `chapters` code (post-move audit checklist)

Schema importers (path stable — no breakage):
- `services/api-ts/src/core/domain-event-consumers.ts:45`
- `services/api-ts/src/test-utils/preload-pristine.ts:29`

Repo importers (path stable — no breakage):
- All 18 handlers in wipe-set (will be re-emitted by generator)

Route registry (`services/api-ts/src/generated/openapi/routes.ts`):
- Regenerated after R1.4 — will pick up new import paths once generator config in `services/api-ts/scripts/generate.ts` resolves chapters operationIds → `handlers/member/chapters/` instead of `handlers/association:member/`.

## New module target

```
services/api-ts/src/handlers/member/chapters/
├── createChapterAffiliation.ts
├── getChapterAffiliation.ts
├── listChapterAffiliations.ts
├── updateChapterAffiliation.ts
├── deleteChapterAffiliation.ts
├── setPrimaryChapterAffiliation.ts
├── listOrgChapters.ts                  ← consolidated from handlers/default/
├── createAffiliationTransfer.ts
├── getAffiliationTransfer.ts
├── listAffiliationTransfers.ts
├── approveTransferBySource.ts
├── approveTransferByTarget.ts
├── denyAffiliationTransfer.ts
├── completeAffiliationTransfer.ts
├── createRoyaltySplit.ts
├── getRoyaltySplit.ts
├── listRoyaltySplits.ts
├── updateRoyaltySplit.ts
├── deleteRoyaltySplit.ts
├── chapters.test.ts                    ← moved from association:member/
├── transfer-lifecycle.test.ts          ← moved from association:member/
└── listOrgChapters.test.ts             ← moved from handlers/default/
```

## Verification checklist before R1.3

- [x] 19 operationIds enumerated, cross-checked against handler filenames (1:1 match, no orphans)
- [x] Repos confirmed at stable path (no move)
- [x] Schema confirmed at stable path (domain-event-consumers safe)
- [x] platformadmin handlers excluded (different .tsp)
- [x] listOrgChapters anomaly flagged for consolidation
- [x] Test files identified as characterization spec (KEEP)

Ready to proceed to R1.3 (wipe).
