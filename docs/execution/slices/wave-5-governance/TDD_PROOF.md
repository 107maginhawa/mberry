---
slice: wave-5-governance
phase: wave-5-elections-documents
generated-by: oli-confidence-stack
timestamp: 2026-05-24T14:00:00+08:00
---

## Context Loaded
- Design doc: `~/.gstack/projects/memberry/elad-mini-main-design-20260523-200235-wave5-governance.md` (APPROVED)
- Modules: Elections (7 handlers, 16 test files), Documents (15 handlers, 19 test files)
- TypeSpec: `specs/api/src/association/member/governance.tsp`, `specs/api/src/association/core/documents.tsp`

## Spec Items — Elections

| ID | Description | Test File | Status |
|----|-------------|-----------|--------|
| BR-33-001 | Min candidates required before voting opens | `updateElectionStatus.test.ts`, `br-33.election-integrity.test.ts` | COVERED |
| BR-33-002 | Active membership required to cast vote | `castVote.test.ts` (3 tests) | COVERED |
| BR-33-003 | Double-vote prevention (app + DB constraint) | `castVote.test.ts`, `elections-schema.test.ts` | COVERED |
| BR-33-004 | Vote voiding for removed nominees | `repos/elections.repo.nominees.test.ts` | COVERED |
| BR-34-001 | Nominee must be active member | `createNominee.test.ts`, `br-34.nomination-eligibility.test.ts` | COVERED |
| BR-34-002 | Nominee must have 6-month tenure | `createNominee.test.ts` | COVERED |
| BR-34-003 | Nominee must not be suspended | `createNominee.test.ts` | COVERED |
| BR-34-E2E | Nomination eligibility E2E flow | `nomination-eligibility-e2e.test.ts` | COVERED |
| H-08 | Only draft elections can open nominations | `updateElectionStatus.test.ts` | COVERED |
| H-09 | Active membership required for ballot access | `castVote.test.ts` | COVERED |
| AC-M12-001 | Election CRUD acceptance criteria | `ac-m12.elections.test.ts` (39 expects) | COVERED |
| SM-001 | Election state machine VALID_TRANSITIONS | `elections-lifecycle.test.ts` (34 expects) | COVERED |
| SM-002 | Schema constraints (date ordering, vote uniqueness) | `elections-schema.test.ts` (27 expects) | COVERED |
| CERT-001 | Officer transition on election certification | `certifyElection.test.ts` (39 expects) | COVERED |
| TALLY-001 | Vote tally grouped counts + voter count | `flow-04.election-vote-tally.test.ts` | COVERED |
| REPO-001 | ElectionsRepository CRUD + nominees | `repos/elections.repo.test.ts`, `repos/elections.repo.nominees.test.ts` | COVERED |
| CREATE-001 | createElection handler validation + error handling | `createElection.test.ts` (12 tests) | COVERED — Zod validation, auth, error sanitization |

## Spec Items — Documents

| ID | Description | Test File | Status |
|----|-------------|-----------|--------|
| AC-M11-001 | Document management acceptance criteria | `ac-m11.documents.test.ts` (15 expects) | COVERED |
| CRUD-001 | Document create/get/update/delete lifecycle | `documents-handlers.test.ts` (73 expects) | COVERED |
| CRUD-002 | Per-handler CRUD tests | `createDocument.test.ts` through `deleteDocument.test.ts` | COVERED |
| VER-001 | Version upload + increment + currentVersionId update | `uploadNewDocumentVersion.test.ts` | COVERED |
| VER-002 | Version list + get by ID | `listDocumentVersions.test.ts`, `getDocumentVersion.test.ts` | COVERED |
| LOG-001 | Access log view + meta-logging + pagination | `getDocumentAccessLog.test.ts` | COVERED |
| TAG-001 | Tag CRUD (create/get/list/update/delete) | 5 tag test files | COVERED |
| SEARCH-001 | Document search with filters + pagination | `searchDocuments.test.ts` | COVERED |
| SLICE-023 | Documents + credentials cross-concern | `slice-023-documents-credentials.test.ts` (72 expects) | COVERED |
| INT-001 | Document integration flows | `documents.test.ts` (35 expects) | COVERED |
| ARCHIVE-001 | Archive flow + source-state guard | `archiveDocument.test.ts` (5 tests) | COVERED — draft→archived blocked |
| REPO-001 | DocumentRepository unit tests | `repos/documents.repo.test.ts` (16 tests) | COVERED |
| FE-001 | Frontend component tests | `document-library.test.tsx` (6), `document-browser.test.tsx` (7) | COVERED |
| E2E-001 | E2E officer/member document workflows | `officer/documents.spec.ts` (6), `member/documents.spec.ts` (4) | COVERED |

## Verification Commands

```bash
# Elections backend
bun test services/api-ts/src/handlers/elections/ --timeout 30000

# Documents backend
bun test services/api-ts/src/handlers/documents/ --timeout 30000

# Frontend (after vitest EPIPE fix)
cd apps/memberry && bunx vitest run src/features/elections/ src/features/documents/
```

## Summary

- Elections: 17/17 spec items COVERED (172 tests, 390 expects)
- Documents: 14/14 spec items COVERED (186 tests, 279 expects)
- Combined: 31/31 COVERED (100%), 358 backend tests + 13 frontend tests + 10 E2E specs
