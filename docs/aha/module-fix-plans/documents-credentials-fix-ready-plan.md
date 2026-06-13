# AHA Fix-Ready Plan: Documents & Credentials

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Documents & Credentials |
| Module slug | documents-credentials |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/documents-credentials-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md` |
| Audit decision | FAIL (carried from gap plan §24) |
| Superpowers used | No (organize-only pass; static review of gap plan + referenced files; no Superpowers agent invoked) |
| Organizer decision | PARTIALLY READY |
| Reason | The P1 backend/data fixes (G3, G4, G7) and the credentials test-hardening (G8) are fully fix-ready with concrete evidence and clear test-first ordering. The headline P0 trust chain (G1) and its routing partner (G2) are real and high-value but their final shape is gated on a product decision (Q1: canonical card-verify token/URL format) — backend HMAC-validation groundwork can begin, but the URL/route contract should not be frozen until Q1 is answered. The certificates batch (G5/G6) carries a schema migration + backfill decision (Q8) and a cross-module seam with m09 training, so it is fix-ready only behind a migration plan. Hence PARTIALLY READY: start with the unblocked documents + credentials + cron work; sequence the verification-chain and certificates work behind their decisions. |
| Limitations | (1) TanStack Router runtime winner among the 3 conflicting `/verify/$param` routes was not executed in a browser — conflict is structurally certain, winner is `[NEEDS CONFIRMATION]` (Q2). (2) Org-logo SVG upload pathway (m11 §11.8) lives outside this module's handlers; inspected at seam level only and deferred pending Q4. (3) Several P2 items depend on product decisions (Q3, Q5, Q7) that scope rather than block. (4) This is an organize-only pass — no source/tests inspected beyond what the gap plan references; no fixes, no code edits, no git. |

## 2. Fix Strategy Summary

**What to fix first (unblocked, highest-confidence):** Batch B1 (documents reliability/permission/compliance) — G3 (write `document_access_log` rows on view/download) and G4 (enforce `status` on `searchDocuments` so members see published-only; wire the ignored `tag` param). Both are self-contained, share one TypeSpec regen (G4), have concrete evidence, and replace a known fake-green test (`ac-m11.documents.test.ts`). Also unblocked: Batch B2 (G7 license-renewal-alert cron — a standalone job addition mirroring `dues.reminderProcessor`) and Batch D (G8 credentials per-handler unit suites — a test-first prerequisite that must land before any credentials handler is touched).

**What to gate, not skip:** The P0 verification chain (G1) and route shadowing (G2) form one coherent batch (A) but are gated on product decision Q1 (canonical card-verify token/URL format). The backend HMAC-validation endpoint groundwork can start, but the final URL/route contract must wait for Q1 so already-distributed `/verify/<certNumber>` artifact URLs are not broken. The certificates batch (C: G5 PDF QR/real-data + G6 real-trainingId) requires a database migration + backfill decision (Q8) and coordination with the m09 training seam `[CROSS-MODULE RISK]`; treat it as a separate `04` pass behind a migration plan.

**What not to fix:** Everything in §11 (Do Not Build) and §10 (Deferred) — especially API-key verification (M11-R3/PRD 11.6, PRD-deferred), persisted `MemberCard` entity (`[DO NOT OVERBUILD]`), relocating credentials schema out of `association:member/repos/` (7 inbound importers), the SVG sanitization pipeline (Q4 contradiction), and storage virus scanning.

**Major risks:** (1) Shared-file concentration — `core/domain-event-consumers.ts` (G7/G12/G13), TypeSpec→generated registry (G4/G6), `handlers/person/` id-card files (G1), `routeTree.gen.ts` (G2). Keep batches path-scoped. (2) Fake-green tests (`ac-m11.documents.test.ts` AC-M11-005/006; body-visible verify E2E) must be replaced/deepened in the same batch that fixes the underlying gap. (3) Printed-artifact URL stability — any `/verify/*` URL change must preserve already-distributed certificate verification URLs.

**One pass or multiple:** Multiple. Documents (B1) + cron (B2) + credentials tests (D) are safe in the first pass(es). Verification chain (A) needs Q1. Certificates (C) needs Q8 + migration. Do not combine A, C, and the TypeSpec regen of B1 into a single risky batch.

**Shared/platform/database work required:** Yes — isolated into Batch E (shared/platform: domain-event-consumers, TypeSpec pipeline, person id-card files, router tree) and Batch F (database/schema: certificate uniqueness/trainingId migration). These are NOT buried inside module-local batches.

## 3. Active Fix Scope

Only P0/P1/selected P2 and V1 REQUIRED/selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | G1 — ID-card QR verification broken end-to-end: unsigned in-app QR (`/verify/<memberId>`), truncated PDF QR text, no backend `GET /verify/:token`, `/verify/$token` page calls nonexistent endpoint | P0 | V1 REQUIRED | A (gated on Q1) + E + F-adjacent (person files) | Spec's P0 trust workflow (WF-071→WF-072); QRs always fail verification today — misleading trust UX | `id-card.tsx:82`; `getMyIdCardPdf.ts:181-191`; `verify/$token.tsx:22`; `app.ts:514-515` (no token route); `routes.ts:2666` |
| FIX-002 | G2 — `/verify` route shadowing: 3 sibling dynamic routes (`$token`/`$certificateNumber`/`$credentialNumber`) all match `/verify/:anything`; at most one reachable | P1 | V1 REQUIRED | A (gated on Q1) + E (router tree) | Whichever route loses, its QR/share links render the wrong verifier; structurally compromises all 3 verify surfaces | `routes/verify/` (3 files); `routeTree.gen.ts:165-176`; winner `[NEEDS CONFIRMATION]` (Q2) |
| FIX-003 | G3 — `document_access_log` never written on view/download (sole writer is meta-log in `getDocumentAccessLog.ts:46`); AC-M11-005 unit test is in-memory simulation (fake-green) | P1 | V1 REQUIRED | B1 | Compliance/audit feature (M11-R5) advertised by API+spec produces no data; fake-green test hides it | `getDocument.ts:32-33`; `downloadDocument.ts:50-57`; `getDocumentAccessLog.ts:46`; `ac-m11.documents.test.ts:70-110` |
| FIX-004 | G4 — `searchDocuments` has no `status` enforcement: members list draft/archived docs; officer status filter is a no-op; `tag` param also ignored | P1 | V1 REQUIRED | B1 + E (TypeSpec regen) | Draft documents are officer WIP; member exposure violates WF-073 publish semantics; permission gap | `searchDocuments.ts:40-52`; `validators.ts:10269-10280`; `documents.repo.ts:72`; `document-library.tsx:237` |
| FIX-005 | G5 — Certificate PDF: no QR; placeholder "Training Event"/"Organization"; GET route cannot carry JSON overrides; client-controlled identity fields on a genuinely-numbered cert | P1 | V1 REQUIRED | C (gated on Q8/migration) + E | Printed cert is the employer-facing artifact; today lacks QR + real data and content is forgeable while carrying a verifiable number | `certificate-template.ts` (0 QR refs); `generateCertificatePdf.ts:39-65`; `app.ts:520`; `certificate-preview.tsx:48` |
| FIX-006 | G6 — `bulkIssueCertificates` sets `trainingId = organizationId` → max one bulk cert per member per org; no real training linkage; spec invariant "one per person per training" unimplementable | P1 | V1 REQUIRED | C + F (migration) | Second completed training in same org can't get a certificate — blocks recurring CPD journey (core product value) `[CROSS-MODULE RISK]` (m09) | `bulkIssueCertificates.ts:46`; `MODULE_SPEC.member.certificates.md` §4; `certificates.schema.ts` unique constraint |
| FIX-007 | G7 — License renewal alerts never generated (only `seed/layer-5-gap-fill.ts` writes the table; no cron/job) | P1 | V1 REQUIRED | B2 | "Nudge before license expiry" is a headline credential feature for healthcare professionals; silently does nothing in production | grep: `license_renewal_alerts` writers = seed only; `association:member/jobs/index.ts` has no license job; `listLicenseRenewalAlerts.ts`, `acknowledgeLicenseRenewalAlert.ts` |
| FIX-008 | G8 — member/credentials unit coverage: 2 files / 21 handlers; issue/revoke/verify/public-lookup untested at unit level | P1 | V1 RECOMMENDED | D (test-first prerequisite) | Trust-critical surface unprotected; must be covered before any credentials handler fix is safe `[TEST GAP]` | `member/credentials/` listing; `MODULE_SPEC.member.credentials.md` §7 self-acknowledged |
| FIX-009 | G10 — 0 unit tests for `getMyIdCard.ts`, `getMyIdCardPdf.ts`, `id-card-data.ts`; 0 for `downloadDocument.ts` | P2 | V1 RECOMMENDED | D (folded into A/B1 fixes) | P0/P1-workflow code paths with no protection; needed to safely drive G1/G3 fixes `[TEST GAP]` | `handlers/person/` test listing; grep `downloadDocument` in `documents/*.test.ts` = 0 |
| FIX-010 | G12 — `training.completed` consumer notifies "certificate ... available to download" even when no certificate was issued | P2 | V1 RECOMMENDED | B2 (or C; reword path is cheap) — scope partly gated on Q5 | Misleading member journey M-26; cheap one-consumer-block gate | `domain-event-consumers.ts:1101-1140`; issuance is manual bulk-issue |
| FIX-011 | G13 — `verification.requested` event has no consumer; certificate verifications unlogged (asymmetric with `credential_verification_log`) | P2 | V1 RECOMMENDED | B2 + E (consumer file) | m11 §10b + PRD M11-R2 audit-logging requirement; lost audit signal | `verifyCertificatePublic.ts:28`; grep consumers = 0 |
| FIX-012 | G16 — ID-card HMAC secret = `AUTH_SECRET ?? 'fallback-secret'`; cert verify falls back to empty-string secret | P2 | V1 RECOMMENDED | A (folds into G1) | Forgeable signatures if env unset; secret-reuse smell; fail-closed needed in prod | `id-card-data.ts:75`; `verifyCertificatePublic.ts:21` |
| FIX-013 | G11 — `credential.issued`/`credential.revoked` documented in spec §6 but never emitted; no member notification on issuance/revocation | P2 | V1 RECOMMENDED | D-adjacent / B2 (emit + consumer, OR amend spec) | Spec/code contract lie; cheap to resolve; consumer pattern already exists | `MODULE_SPEC.member.credentials.md` §6 vs grep `member/credentials/*.ts` emits = 0 |
| FIX-014 | G14 — Staleness-window messaging (PRD 11.5 30-day rule) absent from verify pages | P2 | V1 RECOMMENDED | A (after verify pages are correct) | Verifiers can't judge currency vs authenticity; trivial UI change but pointless before G1/G2 land | `verify/$certificateNumber.tsx`; `verify/$credentialNumber.tsx` |
| FIX-015 | G15 — Platform branding missing from certificate PDF; ID PDF says "Powered by" vs spec "Verified by Memberry" | P2 | V1 RECOMMENDED | C (folds into G5 PDF work) | PRD 11.7 non-removable v1 branding; cheap footer addition alongside G5 | `getMyIdCardPdf.ts:199`; `certificate-template.ts` |

> Excluded from active scope (routed to §8/§9/§10/§11): G17 (P3 doc-sync — deferred to platform doc-drift batch, not module-fix scope); WF-075 credential template designer UI (V2); M11-R3 API-key verification (V2/PRD-deferred); persisted MemberCard (DO NOT ADD); SVG sanitization pipeline (`[NEEDS PRODUCT DECISION]` Q4); storage virus scan / stale-row reaper / storage domain events (V2); credentials-schema relocation (DO NOT ADD). The `[NEEDS PRODUCT DECISION]` certificate auto-issuance question (Q5) scopes G12 but does not block the reword.

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A — Verification chain (P0 + routing) | Canonical card-verify endpoint + both QRs encode full verify URL + UI consumes signed payload; collapse `/verify/*` routing; fail-closed secret; staleness messaging | FIX-001, FIX-002, FIX-012, FIX-014 | High (touches person files, router tree, public URL shapes; printed-artifact stability) | Requires product decision first (Q1). Backend HMAC-validation groundwork may start now; freeze URL/route contract only after Q1. Run as its own later `04` pass. |
| Batch B1 — Documents reliability/permission/compliance | Write `document_access_log` rows on view/download (replace fake-green AC test); enforce `status` on `searchDocuments` (published-only for non-officers) + wire `tag` | FIX-003, FIX-004, FIX-009 (downloadDocument tests) | Medium (G4 needs one TypeSpec regen → see Batch E) | Run in current/next `04` pass — unblocked, highest confidence. G4 contract change isolated to Batch E step. |
| Batch B2 — Credentials/notification lifecycle (jobs + events) | Daily license-expiry cron → idempotent renewal alerts; gate "certificate available" notification on cert existence; add `verification.requested` audit consumer | FIX-007, FIX-010, FIX-011 | Medium (G7 standalone job; G10/G11/G13 edit shared consumer file → see Batch E) | Run after or alongside B1. G7 fully unblocked. FIX-010 reword unblocked; FIX-011 emit-vs-amend-spec is a small decision. |
| Batch C — Certificates PDF + training linkage | Server-resolved cert PDF data + embedded HMAC QR + branding footer + strip client identity overrides; real `trainingId` in bulk-issue contract + uniqueness on real training + update `certificate.bulk_generate` job payload | FIX-005, FIX-006, FIX-015 | High (schema migration + backfill of issued artifacts; m09 cross-module seam) | Requires database/schema fix first (see Batch F) and migration/backfill decision (Q8). Run as a separate later `04` pass coordinated with training-credits. |
| Batch D — Test hardening / regression coverage | Per-handler credentials unit suites (issue/revoke/verify/public-lookup/license CRUD/ack); id-card + downloadDocument unit suites | FIX-008, FIX-009 | Low (tests only; no behavior change) | Run FIRST or in lockstep with the batches that touch those handlers. FIX-008 MUST precede any credentials handler fix. |
| Batch E — Shared/platform dependency fix (ISOLATED) | TypeSpec `SearchDocumentsQuery.status`/`tag` addition + regenerate (for G4); `core/domain-event-consumers.ts` edits (G7 cron wiring effects, G10/G11/G12/G13 consumer blocks); `handlers/person/` id-card file edits (G1); `routeTree.gen.ts` regeneration (G2) | Supports FIX-001, FIX-002, FIX-004, FIX-007, FIX-010, FIX-011, FIX-013 | High (blast radius: SDK + both apps consume generated registry; consumer file shared by 9 module owners; public URLs) | Execute the relevant Batch E step within the SAME `04` pass as its owning module batch, but as a clearly-labeled isolated step. Run `check:sdk-compat` after any TypeSpec change. Do NOT bundle unrelated shared edits together. |
| Batch F — Database/schema dependency fix (ISOLATED) | `certificates` schema: stop storing organizationId in `trainingId`; re-key `certificate_training_person_unique` on real training; migration + backfill for existing rows (Q8) | Supports FIX-005, FIX-006 | High (rewrites uniqueness semantics on already-issued artifacts) | Requires database/schema fix first AND product/eng decision on backfill (Q8). Must land before/with Batch C handler changes. Plan migration + backfill explicitly; do not run blind. |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-003 | Handler-level access-log test: `getDocument` and `downloadDocument` each create a `document_access_log` row (`action: 'view'`/`'download'`) on success; best-effort try/catch does not break the response | backend/unit + integration | A view/download produces a real persisted log row, not a self-referential meta-log | Replace fake-green `handlers/documents/ac-m11.documents.test.ts` (AC-M11-005 block); add `handlers/documents/downloadDocument.test.ts` (new) |
| FIX-004 | `searchDocuments` status enforcement: member role + a draft doc → not listed; officer role + status filter → respected; `tag` filter actually narrows results | backend/unit + contract (hurl) | Members see published-only; officer filter and tag param are no longer no-ops | Extend `handlers/documents/searchDocuments.test.ts` (or `documents-handlers.test.ts`); extend `specs/api/tests/contract/.../assoc-documents-flow.hurl` |
| FIX-001 | `id-card-data` payload round-trip + HMAC verify; `getMyIdCardPdf` rendered QR URL is full + decodable; card-verify endpoint contract test (valid / tampered / truncated token) | backend/unit + contract (hurl) | Signed payload survives QR encode→decode and validates; new endpoint returns valid/invalid correctly | New `handlers/person/id-card-data.test.ts`, `handlers/person/getMyIdCardPdf.test.ts`; new contract file for the card-verify route (gated on Q1 shape) |
| FIX-002 | Single-verify-route dispatch test: cert number, credential number, and card token each render the correct result body (not "not found") | E2E/Playwright (core journey) | One URL per surface resolves to the correct verifier — no shadowing | Deepen `apps/memberry/tests/e2e/member/certificates.spec.ts:55-63` (currently asserts body-visible only); add per-surface assertions |
| FIX-005 | Certificate PDF content test: rendered PDF text contains the real training title + org name + cert number; QR bytes present; client-supplied identity overrides rejected/ignored | backend/unit | PDF shows DB-resolved data + a QR; content is not client-forgeable | Extend `member/certificates/generateCertificatePdf.test.ts` and `certificate-template.test.ts` |
| FIX-006 | Bulk-issue with real trainingId: two issuances for the same person/org but different trainings both succeed; uniqueness keyed on real training | backend/unit + contract + migration/data test | A member can receive certificates for multiple trainings in one org | Extend `member/certificates/bulkIssueCertificates.test.ts`; extend `specs/api/tests/contract/.../certificates-bulk-issue.hurl`; add migration test |
| FIX-007 | Renewal-alert cron test: a license expiring in N days → an alert row is inserted; re-running the cron is idempotent (no duplicates) | backend/unit (job) | The cron actually generates alerts and is safe to re-run | New job test under `association:member/jobs/` (mirror `dues.reminderProcessor` test pattern) |
| FIX-008 | Per-handler credentials suites: issue, revoke, verify (authenticated + public), public-lookup PII projection, license CRUD, alert acknowledge | backend/unit | Trust-critical credential ops behave correctly and are protected before any fix touches them | New per-handler `*.test.ts` files under `handlers/member/credentials/` (extend `credentials.test.ts`, `lookupCredentialPublic.test.ts`) |
| FIX-009 | `downloadDocument` auth matrix (admin / member-of-org / outsider; redirect behavior); id-card file unit coverage | backend/unit + permission/RBAC | Hand-wired download auth is enforced; id-card builders behave | New `handlers/documents/downloadDocument.test.ts`; new `handlers/person/getMyIdCard*.test.ts` |
| FIX-010 | `training.completed` notification gated on certificate existence: no cert → no "available to download" message (or a different message) | backend/unit | Members are not told a certificate exists when none was issued | Extend `core/domain-event-consumers.ts` tests (notification block) |
| FIX-011 | `verification.requested` consumer writes an audit/verification record for certificate verifications | backend/unit | Certificate verification attempts are logged (symmetric with credentials) | Extend domain-event-consumers tests |
| FIX-012 | Card-verify path uses a dedicated/fail-closed secret; production mode with unset secret fails closed (no `'fallback-secret'`/`''`) | backend/unit (prod-mode) | Signatures cannot be forged via a known fallback secret | Extend `handlers/person/id-card-data.test.ts`; extend `member/certificates/verifyCertificatePublic-hmac.test.ts` |
| FIX-013 | Spec/code reconciliation: if emitting, `issueDigitalCredential`/`revokeDigitalCredential` emit the event and a consumer sends a notification | backend/unit | Issuance/revocation produces the documented event + notification (or the spec is corrected — decision-dependent) | Extend `handlers/member/credentials/` tests + consumer tests (if emit chosen) |
| FIX-014 | Verify page shows issuedAt prominently + a >30-day stale hint | frontend/component (or E2E assertion) | Staleness messaging renders per PRD 11.5 | Extend verify-page component tests; or assert in the deepened verify E2E |

> Reserve E2E/Playwright for the core trust journey only (FIX-002 dispatch + the post-fix download→extract-verify-URL→assert-valid journey). All other coverage is backend/unit or contract. Prefer extending existing test files over creating new ones where a suitable file exists. Do NOT create or modify any tests during this organize pass.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `apps/memberry/src/routes/_authenticated/my/id-card.tsx`; `handlers/person/getMyIdCard.ts`, `getMyIdCardPdf.ts`, `utils/id-card-data.ts`; new card-verify route (handler + TypeSpec or hand-wired in `app.ts`); `apps/memberry/src/routes/verify/$token.tsx` | cross-module (person/ files) + shared/platform (route registration) | High — person-owned files; new public endpoint; printed QR URLs |
| FIX-002 | `apps/memberry/src/routes/verify/` (collapse 3 files), `routeTree.gen.ts` (regenerated), QR/share URL builders in `id-card.tsx` + `certificate-preview.tsx` | shared/platform (router) | High — changes live public URL shapes; must preserve `/verify/<certNumber>` |
| FIX-003 | `handlers/documents/getDocument.ts`, `downloadDocument.ts`; `handlers/documents/repos/` (DocumentAccessLogRepository write) | module-local | Low–Medium — new writes on read paths (best-effort) |
| FIX-004 | `specs/api/src/association/core/documents.tsp` (add `status`/`tag` to query) → regenerate; `handlers/documents/searchDocuments.ts`; `generated/openapi/validators.ts` (regenerated, do not hand-edit) | module-local + shared/platform (generated) | Medium — TypeSpec regen touches SDK + both apps |
| FIX-005 | `member/certificates/generateCertificatePdf.ts`, `certificate-template.ts`, `certificate-qr.ts` (reuse); `app.ts:520` (GET→server-resolved data, drop body overrides) | module-local | Medium — PDF artifact + route shape |
| FIX-006 | `specs/api/src/association/member/certificates.tsp` (real `trainingId` in bulk-issue body) → regenerate; `member/certificates/bulkIssueCertificates.ts`; `certificates.schema.ts` (uniqueness); `association:member/jobs/index.ts` (`certificate.bulk_generate` payload) | module-local + database/schema + shared/platform (generated, jobs) | High — migration on issued rows; m09 seam |
| FIX-007 | `association:member/jobs/index.ts` (new cron); license-expiry scan logic; `LicenseRenewalAlertRepository` (in `credits.repo.ts`) | module-local (job) + shared/platform (jobs registry) | Low–Medium — additive job |
| FIX-008 | `handlers/member/credentials/*.test.ts` (new/extended) | module-local (tests) | None (tests only) |
| FIX-009 | `handlers/documents/downloadDocument.test.ts`, `handlers/person/getMyIdCard*.test.ts` (new) | module-local + cross-module (person) tests | None (tests only) |
| FIX-010 | `core/domain-event-consumers.ts` (`training.completed` block, lines ~1101-1140) | shared/platform | Medium — shared consumer file |
| FIX-011 | `core/domain-event-consumers.ts` (new `verification.requested` consumer); `verifyCertificatePublic.ts` (already emits) | shared/platform | Medium — shared consumer file |
| FIX-012 | `handlers/person/utils/id-card-data.ts:75`; `member/certificates/verifyCertificatePublic.ts:21`; `core/config.ts` (new `ID_CARD_QR_SECRET` or reuse `CERTIFICATE_QR_SECRET`) | module-local + shared/platform (config) | Low–Medium — config + fail-closed behavior |
| FIX-013 | `handlers/member/credentials/issueDigitalCredential.ts`, `revokeDigitalCredential.ts`; `core/domain-event-consumers.ts` (if emit) OR `MODULE_SPEC.member.credentials.md` §6 (if amend) | module-local + shared/platform (consumer, if emit) | Low |
| FIX-014 | `apps/memberry/src/routes/verify/$certificateNumber.tsx`, `$credentialNumber.tsx` (or collapsed route from FIX-002) | module-local (frontend) | Low |
| FIX-015 | `member/certificates/certificate-template.ts`; `handlers/person/getMyIdCardPdf.ts:199` ("Verified by Memberry") | module-local | Low |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-004, FIX-006 | shared/platform | TypeSpec → OpenAPI → routes/validators generate pipeline (`specs/api` build + `bun run generate`) | Adding query/body fields regenerates `generated/**` consumed by SDK + both apps; must run `check:sdk-compat` | During fix (in Batch E step), not a prerequisite blocker |
| FIX-001, FIX-009 | cross-module | `handlers/person/` id-card files (`getMyIdCard.ts`, `getMyIdCardPdf.ts`, `utils/id-card-data.ts`) | G1 fix edits person-owned files; scope-limited but crosses module ownership | No (coordinate within Batch A) |
| FIX-002 | shared/platform | Memberry router `routeTree.gen.ts` + already-distributed `/verify/*` URLs | Route collapse regenerates the tree and changes public URLs printed on artifacts | No, but preserve `/verify/<certNumber>` shape (redirects if changed) |
| FIX-007, FIX-010, FIX-011 | shared/platform | `core/domain-event-consumers.ts` (single file shared by 9 module owners) | Concentrated edits; must be small, separately tested | No (isolate in Batch E; one well-tested edit per consumer) |
| FIX-006 | cross-module | m09 training module (real `trainingId` source; `training.completed` payload) | Certificate↔training linkage is the m09↔m11 seam; training-credits audit already completed per audit order | Coordinate with training-credits `[CROSS-MODULE RISK]` |
| FIX-005, FIX-006 | database/schema | `org_certificate_seq` + `certificate_training_person_unique` on `certificates.schema.ts` | G6 changes uniqueness semantics on already-issued artifacts → migration + backfill | Yes — Batch F migration must land before/with Batch C |
| FIX-012 | shared/platform | `core/config.ts` secret config (`ID_CARD_QR_SECRET` / `CERTIFICATE_QR_SECRET`) | Fail-closed crypto config; reused across verify paths | No (folds into Batch A) |
| FIX-008 | shared/platform | `association:member/repos/credentials.{schema,repo}.ts` + licenses in `credits.repo.ts` (7 inbound importers) | Credentials tests/fixes import across module dirs; schema MUST NOT be moved `[SHARED DEPENDENCY]` | Do not move; import in place |
| FIX-001, FIX-005, FIX-002 | product decision | Q1 (canonical verify token/URL format), Q3 (audit-trail vs table), Q8 (cert backfill) | Determine final shape of A and C | Q1 before freezing A; Q8 before Batch F |
| (SVG logo) | product decision / missing-spec | PRD 11.8 vs `MODULE_SPEC.storage.md` BR-31 (contradiction) | Org-logo SVG flow impossible today; raster-only de facto | Out of active scope (Q4) — deferred |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1 — Canonical card-verify token/URL format: reuse credential public-verify token semantics, or new `GET /verify/:token` validating the `id-card-data` HMAC payload? | ✅ **DECIDED 2026-06-13** | FIX-001, FIX-002, FIX-014 | Determines the entire G1 fix shape and printed-artifact URL stability | **Unify on the existing credential public-verify token family** — add an id-card HMAC verifier branch to the already-shipped single `/verify/$id` dispatch (resolveVerifyKind, Step 40). Preserves distributed URLs; one verify code path. Ready for Batch A `04`. |
| ~~Q2 — Which `/verify/$param` route currently wins TanStack matching?~~ | `[RESOLVED Step 40, 2026-06-13]` | FIX-002 | Moot — routes collapsed to a single `/verify/$id` dispatching by id-shape (`resolveVerifyKind`). Confirmed live Step 40: credential/cert/token each reach the correct verifier, no shadowing. | ✅ |
| Q3 — Does platform `x-audit`/`auditAction` satisfy M11-R5, or is module-owned `document_access_log` the required record? | `[NEEDS PRODUCT DECISION]` | FIX-003 | Scopes G3 — write-through to the table vs UI-rewire to platform audit | Recommended: keep both (table feeds officer-facing log UI). Confirm before B1 closes; default to write-through |
| Q5 — Auto-issue certificates on `training.completed`+attendance, or remain officer-initiated bulk issuance? | `[NEEDS PRODUCT DECISION]` | FIX-010 (and certificate issuance pipeline) | Determines whether G12 is a reword or an issuance-pipeline build; affects m09 seam | Default to officer-initiated for V1; G12 reword is safe regardless. Defer pipeline build |
| Q7 — Intended member/admin UI for professional licenses + renewal alerts in V1, or API-only until admin credentials UI lands? | `[NEEDS PRODUCT DECISION]` | FIX-007 | Affects whether the cron's alert output is surfaced in a UI; cron + notification value exists even without a page | Build the cron (unblocked); confirm whether a UI surface is in V1 scope. Notifications can carry the alert if no page |
| Q8 — Existing certificates with `trainingId = organizationId`: backfill strategy when G6 lands (null out / map via credit entries / freeze)? | `[RESOLVED Step 38, 2026-06-13]` — **Option A: nullable + lazy-link** (NULL bogus rows, partial-unique WHERE trainingId IS NOT NULL, require real trainingId on new issuance) | FIX-006 (Batch F) | Migration safety for already-issued artifacts | DONE — see Decisions §Step 38. Unblocks Batch F → Batch C |
| Q6 — Zero-credit trainings: generate a certificate? | `[NEEDS CONFIRMATION]` | FIX-005, FIX-006 (test design) | Edge case in PDF/issuance test design | Confirm during Batch C test design (minor) |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| ~~Batch A URL/route contract freeze (FIX-001 final shape, FIX-002 collapse target)~~ | `[RESOLVED Step 40, 2026-06-13]` | DONE — Q1 reused credential-number + `/verify/$id` (Step 29); FIX-002 routing collapsed (Steps 29–38); FIX-012 fail-closed secret; FIX-014 staleness. **Step 40 closed FIX-001**: ID-card PDF now draws a scannable QR of `/verify/<credentialNumber>` (shared `core/pdf/qr.ts`); verify chain confirmed LIVE — credential/cert/token shapes each dispatch to the correct verifier, no shadowing. See fix-report §Step 40 + `evidence/playwright-findings/verify-chain-e2e-step40.md`. | ✅ Batch A fully resolved |
| ~~Batch F certificate uniqueness migration + backfill (enables FIX-006)~~ | `[RESOLVED Step 39, 2026-06-13]` | DONE — migration `0069` (nullable trainingId + partial unique `WHERE training_id IS NOT NULL` + NULL-out bogus rows + `certificate_type`); journal idx 69. See fix-report §Step 39. | ✅ |
| ~~Batch C handler changes (FIX-005/FIX-006/FIX-015)~~ | `[RESOLVED Step 39, 2026-06-13]` | DONE — FIX-006 real `trainingId`; FIX-005 server-resolved PDF + verify QR (forgery surface closed); FIX-015 "Verified by Memberry". GREEN. m09 training-selector seam flagged (fix-report §F/C.8) — new certs land NULL (Option A lazy-link) until officer form supplies a real trainingId. | ✅ (seam follow-up tracked) |
| FIX-007 alert UI surface | `[NEEDS PRODUCT DECISION]` (Q7) | UI placement for license alerts is undecided | Q7 answered. (The cron itself + notification path are NOT blocked.) |
| SVG org-logo upload + sanitization (m11 §11.8) | `[NEEDS PRODUCT DECISION]` (Q4) | PRD 11.8 (sanitize SVG) contradicts `MODULE_SPEC.storage.md` BR-31 (hard-block SVG) | Q4 resolved; until then raster-only logos stand (out of active scope) |
| FIX-013 emit-vs-amend choice | `[NEEDS PRODUCT DECISION]` (small) | Whether to emit `credential.issued`/`credential.revoked` + consumer or correct the spec | Product picks one; both are cheap |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Verification API keys + per-key rate limiting + PA-15 admin UI | M11-R3 / PRD 11.6 (gap plan §23) | V2 DEFERRED | PRD explicitly defers key management to platform engineering; no `ApiKey` schema exists; public verify endpoints cover V1 |
| Credential template designer UI | WF-075 (gap plan §23) | V2 DEFERRED | Feature flag `credential_templates` defaults false; API exists; spec marks P2 |
| Storage virus scanning | gap plan §13/§23 | V2 DEFERRED | Spec-acknowledged production-hardening; MIME allowlist is the V1 barrier |
| `file.completed`/`file.deleted` storage domain events | gap plan §23 | V2 DEFERRED | Spec-flagged candidate cleanup; no current consumer need |
| Stale-`uploading` row reaper job | gap plan §13/§23 | V2 DEFERRED | Spec stance: add when observed problem |
| `stored_file` orphan scrub on `person.deleted` | gap plan §13 | `[CROSS-MODULE RISK]` / V2 DEFERRED | Belongs to person/core-platform audit; candidate consumer, not a documents-credentials V1 fix |
| SVG logo upload + sanitization pipeline | gap plan §23 (PRD 11.8) | V2 DEFERRED / `[NEEDS PRODUCT DECISION]` (Q4) | Storage deliberately blocks SVG (BR-31); raster logos suffice for V1; needs Q4 + sanitizer promotion |
| m11 §20 stale handler paths + CLAUDE.md nonexistent `certificates/` dir doc-sync | G17 (P3) | `[DO NOT OVERBUILD]` for module scope | P3 doc-drift; route to the existing platform doc-drift batch (audit index §18), not this module's fix pass |
| Deepen QR-verification E2E assertions (beyond FIX-002 dispatch) | gap plan §18/§22 | V1 RECOMMENDED but sequence-after | The post-fix download→extract-URL→assert-valid journey lands AFTER Batch A; not a first-pass item |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Persisted `MemberCard` entity + S3-cached card PDFs | gap plan §6/§23 | On-the-fly generation deliberately satisfies BR-19 (`domain-event-consumers.ts:1029-1032`); a card table reintroduces the staleness the design removed `[DO NOT OVERBUILD]` |
| Moving credentials schema out of `association:member/repos/` | gap plan §13/§23 | 7 inbound importers; specs forbid; zero behavioral gain; mega-module split owns this later `[DO NOT OVERBUILD]` |
| Wiring `listCertificates.ts` helper as a route | gap plan §6/§12/§23 | Explicit marker-comment prohibition (resolution `0e696707`); intentional non-route helper |
| Offline-scanner mobile verification app/SDK | gap plan §23 | PRD mentions offline HMAC property only; no V1 actor needs a custom scanner `[DO NOT OVERBUILD]` |
| Expanding credential-template feature beyond existing API (no designer UI until flag flips) | gap plan §6 | Adds complexity for a flagged-off P2 feature; keep API only |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | No backend card-verify endpoint exists and the two QRs encode non-verifiable values (raw UUID; truncated payload). Fixing the endpoint + QR encoders fixes the whole chain — not a patch. Final URL shape gated on Q1. |
| FIX-002 | Root cause | Three sibling dynamic routes structurally collide on `/verify/:anything`. Collapsing to one dispatching route (or distinct static prefixes) removes the cause, not the symptom. |
| FIX-003 | Root cause | The write path simply does not exist on `getDocument`/`downloadDocument`; the only writer is a meta-log. Adding the write at the read paths is the root fix; the fake-green AC test must be replaced to prove it. |
| FIX-004 | Root cause | `status` is absent from the TypeSpec query → stripped by validator → handler can't filter. Adding the field + handler enforcement fixes the cause; `tag` is the same class of no-op. |
| FIX-005 | Root cause | The PDF template has zero QR support and the GET route can't carry the JSON overrides the handler reads, so it falls back to placeholders. Server-resolving data + embedding the existing `certificate-qr` is the root fix; removing client overrides closes the forgery surface. |
| FIX-006 | Root cause | A data-model defect (`trainingId = organizationId`) corrupts the uniqueness key. Accepting a real trainingId + re-keying uniqueness fixes the cause; needs a migration for existing rows (symptom-cleanup is the backfill). |
| FIX-007 | Root cause | No cron/job ever writes `license_renewal_alerts`; the read/ack handlers exist but have no producer. Adding the cron is the root fix. |
| FIX-008 | Root cause (test debt) | Trust-critical handlers have no unit protection (2/21). This is a prerequisite, not a behavior fix; it must precede credentials changes. |
| FIX-009 | Root cause (test debt) | P0/P1 code paths (id-card, downloadDocument) have zero unit coverage; needed to drive G1/G3 safely. |
| FIX-010 | Symptom (reword) / Root (gate) | The notification fires on `training.completed` regardless of issuance. Gating on certificate existence is the root fix; a reword is the minimal symptom patch. Choice scoped by Q5. |
| FIX-011 | Root cause | `verification.requested` is emitted with zero consumers; adding the audit consumer fixes the lost-signal cause. |
| FIX-012 | Root cause | HMAC secret falls back to a known/forgeable value (`'fallback-secret'`/`''`). Dedicated secret + fail-closed-in-prod removes the forgery cause. |
| FIX-013 | Unclear (spec vs code) | Either the code should emit the documented events or the spec is wrong. Decision (Q1-adjacent small product call) determines which; both are root-level reconciliations, not patches. |
| FIX-014 | Symptom-adjacent (UX completeness) | Staleness messaging is a missing-feature UI add per PRD 11.5; only meaningful once verify pages are correct (after A). |
| FIX-015 | Root cause (completeness) | Branding is simply absent from the certificate template; adding the footer is the root fix per PRD 11.7. |

## 13. Recommended First Fix Batch

**Batch name:** Batch B1 — Documents reliability / permission / compliance (with the Batch E TypeSpec step for G4).

**Included Fix IDs:** FIX-003 (access-log write), FIX-004 (searchDocuments `status`/`tag` enforcement), FIX-009 (downloadDocument unit tests, folded in).

**Why this batch comes first:**
- It is fully unblocked — no product decision required (G3 defaults to write-through per recommended Q3 answer; G4 is a contained TypeSpec field add).
- Highest evidence confidence and lowest blast radius among the P1 set; module-local handlers plus one isolated TypeSpec regen.
- It directly replaces a known fake-green test (`ac-m11.documents.test.ts` AC-M11-005), turning false confidence into real coverage.
- It closes two real V1 defects: a compliance/audit feature that produces no data (G3) and a permission gap where members can list draft/archived documents (G4).
- It does not touch the gated verification chain (Q1) or the migration-dependent certificates work (Q8), so it can ship without waiting on decisions.

**Tests to write first (RED):**
1. `getDocument` + `downloadDocument` each create a real `document_access_log` row (replace fake-green `ac-m11.documents.test.ts` AC-M11-005 block).
2. `downloadDocument` auth matrix (admin / member-of-org / outsider; redirect) — FIX-009.
3. `searchDocuments` status enforcement: member + draft doc → not listed; officer filter respected; `tag` narrows results — backend/unit + extend `assoc-documents-flow.hurl`.

**Explicit out-of-scope for this batch:**
- FIX-001 / FIX-002 / FIX-012 / FIX-014 (Batch A — gated on Q1).
- FIX-005 / FIX-006 / FIX-015 (Batch C — gated on Q8 + Batch F migration + m09 seam).
- FIX-007 / FIX-010 / FIX-011 (Batch B2 — run next, not first).
- FIX-008 credentials suites (Batch D — required before any credentials handler change, not part of B1).
- Everything in §10 (Deferred) and §11 (Do Not Build).
- G17 doc-sync (P3, routed to platform doc-drift batch).

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Documents & Credentials
- **Exact module slug:** documents-credentials
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/documents-credentials-fix-ready-plan.md`
- **Exact batch to execute first:** Batch B1 — Documents reliability / permission / compliance (FIX-003, FIX-004, FIX-009), including the isolated Batch E TypeSpec step for FIX-004 (`SearchDocumentsQuery.status`/`tag` add → regenerate → `check:sdk-compat`).
- **Tests to prioritize (write RED first):**
  1. Handler-level `document_access_log` write tests for `getDocument` + `downloadDocument` (replace the fake-green `ac-m11.documents.test.ts` AC-M11-005 block).
  2. `downloadDocument` auth matrix (admin / member-of-org / outsider).
  3. `searchDocuments` status enforcement (member published-only; officer filter; `tag`) — unit + `assoc-documents-flow.hurl`.
- **Files likely to touch:** `handlers/documents/getDocument.ts`, `handlers/documents/downloadDocument.ts`, `handlers/documents/searchDocuments.ts`, `handlers/documents/repos/` (DocumentAccessLogRepository write), `specs/api/src/association/core/documents.tsp` (add `status`/`tag`), then `bun run generate` (do NOT hand-edit `generated/openapi/validators.ts`). Tests under `handlers/documents/`.
- **Shared/database cautions:**
  - FIX-004 requires the TypeSpec→generate pipeline; run `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate` then `check:sdk-compat` — this regen touches the SDK and both apps. Keep it as the only contract change in this batch.
  - Do NOT touch `core/domain-event-consumers.ts` in this batch (it belongs to B2/A/C).
  - Do NOT move credentials schema (`association:member/repos/`, 7 inbound importers) `[SHARED DEPENDENCY]`.
  - Write access-log rows best-effort (try/catch like the existing meta-log) so a logging failure never breaks a view/download response.
- **Items NOT to implement (this pass and beyond, unless explicitly re-scoped):**
  - Batch A verification chain (FIX-001/002/012/014) until Q1 is answered.
  - Batch C certificates (FIX-005/006/015) until Q8 + Batch F migration land and the m09 seam is confirmed.
  - Any §10 Deferred item: API-key verification, credential-template designer UI, storage virus scan, storage domain events, stale-row reaper, SVG sanitization (Q4), orphan-file scrub.
  - Any §11 Do Not Build item: persisted `MemberCard`, relocating credentials schema, wiring `listCertificates.ts` as a route, offline-scanner app, expanding credential templates.
  - G17 doc-sync (P3) — route to the platform doc-drift batch, not here.
  - Do NOT start credentials handler fixes before Batch D (FIX-008) per-handler suites exist.

---

## Decisions — Step 29 (2026-06-12) — Q1 card-verify token/URL RESOLVED

User delegated to engineering judgment ("your call whats best").

**Decision: reuse the existing credential token + existing `verify/$token` route.**
Do NOT invent a new HMAC `GET /verify/:token` surface.

- Rationale: a credential token + `verify/$token.tsx` route already exist; reusing
  them avoids a second token system and avoids freezing a new unstable printed-URL
  contract. Consolidated roadmap §17 ("Do Not Build") explicitly flags inventing a
  new `/verify/:token` route before Q1 as overbuild.
- Shape (Batch A verify-chain): the ID-card QR/share link resolves to the existing
  credential-token verify route; the verify endpoint validates the existing token
  rather than minting a parallel HMAC scheme.

**Unblocks Batch A (Q1).** Sequenced after elections Batch F per roadmap §8.

## Decisions — Step 38 (2026-06-13) — Q8 cert-schema backfill RESOLVED

User delegated to engineering judgment; chose **Option A — Nullable + lazy-link**.

**Gap confirmed in code:** `bulkIssueCertificates.ts:46` sets `trainingId: body.organizationId`
(the bulk-issue body has no `trainingId`, only `trainingTitle`), so every bulk-issued cert
has `trainingId == organizationId`. The uniqueness key `certificate_training_person_unique`
on `(trainingId, personId)` (`certificates.schema.ts:30`) therefore collapses to
`(orgId, personId)` → one bulk cert per person per org, ever. Data-model corruption.

**Decision: Option A — nullable `trainingId` + lazy-link.**
- Drop `notNull()` on `certificate.trainingId`.
- Migration NULLs out the bogus `trainingId == organizationId` rows (pre-launch pilot →
  existing rows are seed/test data; no distributed printed artifacts; low blast radius).
- Replace `unique('certificate_training_person_unique').on(trainingId, personId)` with a
  **partial unique** index `WHERE trainingId IS NOT NULL`.
- Handler + TypeSpec require a real `trainingId` on NEW bulk issuance (FIX-006).
- Historical rows stay unlinked-but-valid. NOT chosen: full credit-entry remap (B, fragile
  fuzzy join — bulk only stored `trainingTitle`) and freeze/reissue (C, invalidates certs).
  Optional best-effort credit-entry backfill may run as a later follow-up, non-blocking.

**Unblocks Batch F (certificate uniqueness migration + backfill) → Batch C (FIX-005/006/015:
cert PDF gen + HMAC QR + branding + real `trainingId`).** Decision-free from here; see
continuation prompt `docs/aha/outputs/CONTINUE-39-prompt.md`.

## Status — Batch A FULLY CLOSED (2026-06-13)

Batch A (verify chain) is **COMPLETE**. See fix-report sections:

| Fix ID | Status | Closed In |
| --- | --- | --- |
| FIX-001 (ID-card QR verification end-to-end) | **Fixed** | Batch A (endpoint/route reuse) + A2 (member-card credential producer) + Step 40 (scannable PDF QR + live E2E) |
| FIX-002 (`/verify` route shadowing → single `/verify/$id` dispatch) | **Fixed** | Batch A + verified live Step 40 (no shadowing for cert/credential/token shapes) |
| FIX-012 (fail-closed credential verify secret) | **Fixed** | Batch A + D2 (closed the `verifyDigitalCredentialAuthenticated` surface) |
| FIX-014 (30-day staleness messaging + **fake-green AC-M11-005/006 replacement**) | **Fixed** | Batch A (staleness) + B1 (AC-M11-005 real coverage) + **Batch A FIX-014 hardening pass 2026-06-13 (AC-M11-006 real coverage)** |

The last fake-green test the original Batch A prompt named — `ac-m11.documents.test.ts`
**AC-M11-006** (version history, asserting a test-local closure) — is now replaced with
real handler-driven coverage in `uploadNewDocumentVersion.test.ts`. No production behavior
changed; documents suite 230/0; api-ts typecheck clean; no migration; no TypeSpec/regen.
