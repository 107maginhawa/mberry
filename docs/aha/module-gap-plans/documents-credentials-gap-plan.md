# AHA Module/Group Gap Plan: Documents & Credentials

Date: 2026-06-11
Prompt: `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Documents & Credentials |
| Module slug | documents-credentials |
| Type | Business Module |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/documents-credentials-gap-plan.md` |
| Primary PRD/spec used | `docs/product/modules/m11-documents-credentials/MODULE_SPEC.md` (v2.0, 2026-05-21) |
| Supporting PRDs/specs used | `docs/product/modules/m11-documents-credentials.md` (PRD v3 module page), `docs/product/modules/m11-documents-credentials/API_CONTRACTS.md`, `docs/product/MODULE_SPEC.member.credentials.md`, `docs/product/MODULE_SPEC.member.certificates.md`, `docs/product/MODULE_SPEC.storage.md`, `docs/quality/R3_CREDENTIALS_SCOPE.md`, `docs/quality/SCOPE.certificates.md` |
| PRD/spec coverage quality | Strong (multiple current specs; minor staleness in m11 §20 AI-instruction paths) |
| Paths inspected | `services/api-ts/src/handlers/documents/` (20 non-test files + 19 test files), `services/api-ts/src/handlers/member/credentials/` (21 handlers + 2 tests), `services/api-ts/src/handlers/member/certificates/` (11 non-test + 12 test files), `services/api-ts/src/handlers/storage/` (8 + 4 tests), `services/api-ts/src/handlers/person/getMyIdCard*.ts` + `person/utils/id-card-data.ts`, `services/api-ts/src/handlers/association:member/repos/credentials.{repo,schema}.ts`, `services/api-ts/src/core/domain-event-consumers.ts`, `services/api-ts/src/app.ts`, `specs/api/src/association/core/documents.tsp`, `specs/api/src/association/member/{credentials,certificates}.tsp`, `specs/api/src/modules/storage.tsp`, `services/api-ts/src/generated/openapi/{routes,validators}.ts` (read-only), `apps/memberry/src/routes/verify/*`, `apps/memberry/src/routes/_authenticated/my/{id-card,certificates}*`, `apps/memberry/src/routes/_authenticated/org/$orgSlug/{documents,officer/documents,officer/certificates}*`, `apps/memberry/src/features/{certificates,documents}/components/`, `apps/memberry/src/routeTree.gen.ts`, `specs/api/tests/contract/` (member/credentials 6 files, member/certificates 5 files, assoc-documents/tags/storage flows), `apps/memberry/tests/e2e/{member,officer,journeys}/` |
| PRDs/specs inspected | All listed above + `docs/aha/outputs/module-audit-index.md` |
| KG used | Yes (status notes only; `.understand-anything/` graph used as secondary evidence per `docs/aha/kg/knowledge-graph-status.md`) |
| KG refreshed | No (direct code inspection sufficed for all wiring questions) |
| `/understand-domain` used | Yes (status doc context only; product docs richer per `docs/aha/kg/domain-knowledge-status.md`) |
| `/understand-domain` refreshed | No |
| Webwright used | No — Static review sufficient; browser tooling skipped for batch run. |
| Playwright/E2E inspected | Yes (read-only inspection of existing specs; no execution — static review sufficient; browser tooling skipped for batch run) |
| Existing tests inspected | documents 19 unit test files, certificates 12, storage 4, credentials 2; 11 module Hurl files + 3 legacy assoc-* flows; 9 relevant E2E specs |
| Cross-cutting audit reviewed | Not Available (prompt 05 not yet run) |
| Database/schema audit reviewed | Not Available (prompt 06 not yet run) |
| Limitations | TanStack Router runtime winner among the three conflicting `/verify/$param` routes not executed in a browser — conflict is structurally certain, winner is `[NEEDS CONFIRMATION]`. Org-logo upload pathway (m11 §11.8) lives outside this module's handlers and was inspected only at seam level. |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| M11 Module Spec v2.0 | `docs/product/modules/m11-documents-credentials/MODULE_SPEC.md` | Module spec (primary) | Current, except §20 AI instructions reference nonexistent `handlers/certificates/` and `certificates/repos/` paths (actual: `handlers/member/certificates/`) | Workflows WF-071–WF-075, BR-18/19/20, M11-R1–R5, ACs, entities |
| M11 PRD module page | `docs/product/modules/m11-documents-credentials.md` | PRD | Current | Capabilities 11.1–11.8, journeys M-25/26/27, PA-15, screens, staleness-window rules |
| M11 API contracts | `docs/product/modules/m11-documents-credentials/API_CONTRACTS.md` | API contract | Current | Endpoint expectations |
| member/credentials handler spec | `docs/product/MODULE_SPEC.member.credentials.md` | Handler spec | Current; §6 claims `credential.issued`/`credential.revoked` events that do not exist in code (see §5) | 21-op inventory, schema-path asymmetry, gotchas |
| member/certificates handler spec | `docs/product/MODULE_SPEC.member.certificates.md` | Handler spec | Current (post-cutover, accurate file map) | 4 generated ops + hand-wired PDF, `trainingId = organizationId` invariant documented |
| storage handler spec | `docs/product/MODULE_SPEC.storage.md` | Handler spec | Current | BR-31 SVG exclusion, stale-upload + orphan-file known gaps |
| R3 credentials scope | `docs/quality/R3_CREDENTIALS_SCOPE.md` | Scope/acceptance doc | Current (2026-06-07) | Confirms thin-test-coverage follow-up and keep-set for credentials repos |
| Certificates scope | `docs/quality/SCOPE.certificates.md` | Scope doc | Current | Secondary |
| Audit index | `docs/aha/outputs/module-audit-index.md` | Audit index | Current (2026-06-11) | Module row §8; risk Medium; "audit after training-credits" |

## 3. Expected vs Actual

**Expected (per m11 spec + PRD):** Members download HMAC-QR-signed ID cards (WF-071, P0) and training certificates (WF-074, P0); the public verifies any card/certificate QR at `/verify/[token]` (WF-072, P0); officers manage versioned, access-logged org documents with draft→published→archived lifecycle (WF-073, P1); credential templates are a P2/flagged feature; the verification API with API keys is explicitly deferred to platform engineering (PRD 11.6 note).

**Actual:**

- **Documents (strongest surface).** 16 generated handlers + hand-wired `downloadDocument` (`app.ts:493`), full repo/schema (`document`, `document_version`, `document_tag`, `document_access_log`), state machine enforced in `updateDocument.ts` (draft→published→archived, archived terminal), strong RBAC via TypeSpec extensions (delete = President + admin, `documents.tsp:309-311`), versioning works, 2 Hurl flows, member + officer UI pages, E2E specs. **But** the access-log table is written by exactly one code path — the meta-log inside `getDocumentAccessLog.ts:46` — so M11-R5/AC-M11-005 (log every view/download) is not actually implemented, and `searchDocuments.ts` never filters or enforces `status`, so members can list draft/archived documents and the officer UI's status filter is a no-op (validator `SearchDocumentsQuery` has no `status` field).
- **Certificates.** Issuance is officer bulk-issue only (`bulkIssueCertificates.ts`); public verify by number + optional HMAC signature works and is contract-tested; PDF download is owner-scoped. **But** the rendered PDF contains no QR code at all (`certificate-template.ts` has zero QR references), renders placeholder "Training Event"/"Organization" because the GET route can't carry the body overrides the handler expects (`generateCertificatePdf.ts:39-50`, `app.ts:520`), and `bulkIssueCertificates.ts:46` sets `trainingId = organizationId`, capping each member at one bulk-issued certificate per org and severing the certificate↔training link the spec requires.
- **ID card.** In-app page (`/my/id-card`) and PDF endpoint exist, backend builds a proper HMAC-signed payload (`id-card-data.ts`). **But** the verification chain is broken end-to-end: the in-app QR encodes `${origin}/verify/${memberId}` (`id-card.tsx:82`) — a person UUID no verify endpoint accepts; the PDF prints `memberry.app/verify?p=<payload truncated to 40 chars>` (`getMyIdCardPdf.ts:182`); the frontend `/verify/$token` page calls `GET /api/verify/${token}` which has **no backend route** (only `/certificates/verify/:certificateNumber` and `/association/member/credentials/{lookup,public-verify}` exist). BR-18's signed payload is computed but never verifiable by anyone.
- **Verify routes.** Three sibling dynamic routes `/verify/$token`, `/verify/$certificateNumber`, `/verify/$credentialNumber` all match `/verify/:anything` — at most one of the three public verification pages is reachable.
- **Credentials.** All 21 ops implemented and routed (20 generated + hand-wired `lookupCredentialPublic`, `app.ts:337`), 6 Hurl files incl. RBAC edges, PII projection on public endpoints honored. **But** license renewal alerts have **no generator** — only `seed/layer-5-gap-fill.ts` writes `license_renewal_alerts`, so the "system-generated reminders" feature is dead in production — and unit coverage is 2 files / 21 handlers (spec-acknowledged follow-up).
- **Storage.** 6 handlers, BR-31 SVG exclusion enforced, contract + auth tests present. Spec-acknowledged gaps (stale `uploading` rows, orphan files on `person.deleted`, no virus scan) confirmed still open.
- **Spec deviations by design:** `MemberCard` is not persisted (cards generated on the fly — `domain-event-consumers.ts:1029-1032` documents this satisfying BR-19); ID-card/`person.updated` and `membership.status.changed` consumers send notifications instead of regenerating stored cards. This deviation is acceptable `[INFERRED]` but makes the spec's MemberCard entity Not Required for V1.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WF-071 / M-25 ID card download (P0) | Card preview + PDF with HMAC QR per org | Page + PDF exist; PDF QR text truncated; in-app QR unsigned `/verify/<memberId>` | `apps/memberry/src/routes/_authenticated/my/id-card.tsx` (lines 82, 86) | `app.ts:514-515`, `person/getMyIdCard{,Pdf}.ts`, `person/utils/id-card-data.ts` | none (on-the-fly by design) | E2E `member/digital-id-card.spec.ts` (shallow); 0 unit tests for the 3 id-card files | Partially Implemented | Yes — G1, G10 |
| WF-072 public verification (P0) | `/verify/[token]` validates HMAC, shows result | No backend `GET /verify/:token`; 3 conflicting frontend routes; cert + credential verify endpoints exist separately | `apps/memberry/src/routes/verify/{$token,$certificateNumber,$credentialNumber}.tsx` | `routes.ts:2666` (`/certificates/verify/:certificateNumber`), `app.ts:337` (credential lookup); no token route | `credential_verification_log` (credentials only) | Hurl `certificates-public-verify.hurl`, `credential-verify-public.hurl`; E2E `certificates.spec.ts:58` asserts only "body visible" | Partially Implemented | Yes — G1, G2 |
| WF-073 document management (P1) | Upload → draft → publish (visible to members) → archive; versions | CRUD + versions + state machine implemented; publish-visibility not enforced on list | member browser + officer library components | `documents/` handlers; `updateDocument.ts:7-12`; `searchDocuments.ts` (no status filter) | `documents.schema.ts` (`document_status` enum) | 19 unit files; `assoc-documents-flow.hurl`; E2E `journeys/document-lifecycle.spec.ts`, `member/documents.spec.ts`, `officer/documents.spec.ts` | Partially Implemented | Yes — G4 |
| WF-074 / M-26 certificate download (P0) | PDF with training title, dates, credits, org logo, QR, cert number | PDF renders placeholders; no QR; real data unreachable via GET | `certificate-preview.tsx:48` (`window.open` GET) | `generateCertificatePdf.ts:39-65`, `app.ts:520`, `certificate-template.ts` (no QR) | `certificates.schema.ts` | `generateCertificatePdf.test.ts`, `certificate-template.test.ts` (297 LOC) | Partially Implemented | Yes — G5 |
| WF-075 credential template mgmt (P2) | Template designer, flagged off by default | API CRUD complete; no designer UI (flag `credential_templates` default false) | none (no admin/memberry UI) | `member/credentials/{create,get,list,update,delete}CredentialTemplate.ts` | `credential_templates` | `credential-template-crud.hurl` | Implemented (API); UI Not Required for V1 | No (V2) |
| BR-18 HMAC QR | Modified QR rejected; offline authenticity | Cert HMAC sign/verify solid; ID-card QR chain broken (G1); in-app QR not signed at all | `id-card.tsx:137-142` | `certificate-qr.ts`, `id-card-data.ts:74-76` | — | `certificate-qr.test.ts`, `verifyCertificatePublic-hmac.test.ts`, `certificates-verify-hmac.hurl` | Partially Implemented | Yes — G1 |
| BR-19 / AC-M11-004 regenerate on change | Card reflects profile/status change | On-the-fly generation + notification consumers (acceptable redesign) | — | `domain-event-consumers.ts:1029-1096` | — | `slice-023-documents-credentials.test.ts` AC-M11-004 block | Implemented (by design deviation) `[INFERRED]` | No |
| BR-20 / AC-M11-002 cert availability | Cert available after completion + attendance, one per person per training | No automatic issuance; officer bulk-issue with `trainingId = organizationId`; `training.completed` consumer notifies "certificate available" regardless | — | `bulkIssueCertificates.ts:46`, `domain-event-consumers.ts:1101-1140` | `certificate_training_person_unique` on faked trainingId | `slice-023` AC-M11-002 block (repo-level only) | Partially Implemented | Yes — G6, G12 |
| M11-R3 verification API keys + rate limit | API-key verify endpoint | Not built; PRD 11.6 explicitly defers key management; no `ApiKey` table | — | — | none | — | Not Required for V1 (PRD-deferred) | No (V2) |
| M11-R4 / AC-M11-006 version history | Immutable versions | Implemented | officer version drawer | `uploadNewDocumentVersion.ts`, `listDocumentVersions.ts` | `document_version` | `uploadNewDocumentVersion.test.ts`, hurl flow lines 131-161 | Implemented | No |
| M11-R5 / AC-M11-005 access logging | Log entry per view/download | Only meta-log writer exists (`getDocumentAccessLog.ts:46`); `getDocument`/`downloadDocument` use platform audit only | — | `getDocument.ts:32-33`, `downloadDocument.ts:50-57` | `document_access_log` (mostly empty in prod) | `ac-m11.documents.test.ts:70-110` is a pure in-memory simulation (fake-green) | Missing (real path) | Yes — G3 |
| AC-M11-003 / BR-31 SVG sanitization | SVG logos sanitized | Storage blocks SVG entirely at MIME allowlist; sanitization exists only as test-encoded contract | — | `storage/uploadFile.ts` allowlist; `br-31.svg-upload-security.test.ts` | — | BR-31 suite; `slice-023` AC-M11-003 block | Implemented (stricter than spec) — policy conflict with PRD 11.8 | See §25 Q4 |
| PRD 11.5 staleness window (>30-day message) | Verify page shows generation date + regenerate advice | Not present on any verify page | `verify/$certificateNumber.tsx`, `$credentialNumber.tsx` | — | — | — | Missing | Yes — G14 (P2) |
| PRD 11.7 platform branding | "Verified by Memberry" non-removable on all docs | ID-card PDF has "Powered by Memberry" (`getMyIdCardPdf.ts:199`); certificate PDF has none | — | `certificate-template.ts` | — | — | Partially Implemented | Yes — G15 (P2) |
| m11 §10b events published | `CredentialGenerated`, `VerificationRequested`, `DocumentUploaded` consumed by Audit | `credential.generated` + `verification.requested` + `document.created` emitted, but `verification.requested` has **no consumer** (grep `domain-event-consumers.ts` = 0 hits) | — | `verifyCertificatePublic.ts:28`, `generateCertificatePdf.ts:77`, `createDocument.ts:65` | `credential_verification_log` written only by credential verify path | — | Partially Implemented | Yes — G13 (P2) |
| MODULE_SPEC.member.credentials §6 events | `credential.issued` / `credential.revoked` emitted → notification consumer | Not emitted anywhere (`grep` of `member/credentials/*.ts` = 0) | — | `issueDigitalCredential.ts`, `revokeDigitalCredential.ts` | — | — | Missing (spec/code mismatch) | Yes — G11 (P2) |
| License renewal alerts (credentials spec §1) | System generates alerts before expiry; member acknowledges | List + acknowledge handlers exist; **no job/cron writes alerts** — only `seed/layer-5-gap-fill.ts` | no UI for alerts found in memberry/admin | `listLicenseRenewalAlerts.ts`, `acknowledgeLicenseRenewalAlert.ts`; no scheduler entry in any `jobs/` dir | `license_renewal_alerts` | `license-renewal-alerts.hurl` (list shape + 404 only) | Partially Implemented | Yes — G7 |
| Credentials 21-op surface (R3 scope) | All ops live, public endpoints PII-safe | All routed; public lookup projects public fields only | `verify/$credentialNumber.tsx`, profile credential-list | 21 handlers; `app.ts:337` | `credentials.schema.ts` (5 tables) | 2 unit files / 21 handlers; 6 hurl files | Implemented but Untested (unit layer) | Yes — G8 `[TEST GAP]` |
| Storage 6-op surface | Presigned upload/download lifecycle | Implemented per spec | indirect (documents/certificates/avatar) | `storage/` handlers | `stored_file` | 4 unit files; `storage.hurl` + `storage-edge.hurl` | Implemented | Known spec-acknowledged gaps (§13) |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| WF-071/WF-072 + BR-18 (ID card verification) | ID-card QR verification broken end-to-end: in-app QR = unsigned `/verify/<memberId>`; PDF QR text = truncated `verify?p=` URL; no backend `GET /verify/:token`; `/verify/$token` page calls nonexistent endpoint | P0 | V1 REQUIRED | `id-card.tsx:82`, `getMyIdCardPdf.ts:181-191`, `verify/$token.tsx:22`, `app.ts` (no token route), `routes.ts:2666` | Define ONE canonical card-verify contract: backend `GET /verify/:token` (or reuse credential public-verify) that validates the `id-card-data.ts` HMAC payload; make both QRs encode that full URL; delete or rewire `verify/$token.tsx` |
| Frontend route integrity (WF-072) | Three sibling dynamic routes `/verify/$token`, `/verify/$certificateNumber`, `/verify/$credentialNumber` shadow each other — at most one public verification surface reachable | P1 | V1 REQUIRED | `apps/memberry/src/routes/verify/` (3 files), `routeTree.gen.ts:165-176` | Collapse to a single `/verify/$id` route that dispatches by id shape (cert number pattern `PDA-MM-YYYY-NNNN`, credential number, signed token) or distinct static prefixes (`/verify/cert/$n`, `/verify/credential/$n`) |
| M11-R5 / AC-M11-005 | `document_access_log` never written on view/download — only the meta-log in `getDocumentAccessLog.ts:46`; access-log UI/API shows an empty or self-referential log; AC unit test is an in-memory simulation | P1 | V1 REQUIRED | `getDocument.ts:32`, `downloadDocument.ts:50-57`, `ac-m11.documents.test.ts:70-110` | Write `DocumentAccessLogRepository.createOne({action:'view'|'download'})` in `getDocument` + `downloadDocument` (best-effort try/catch like meta-log); replace fake-green AC test with handler-level test |
| Credentials spec §1 (renewal alerts) | No code generates `license_renewal_alerts` — feature dead outside seed data | P1 | V1 REQUIRED | grep: only `seed/layer-5-gap-fill.ts` + handlers/read paths reference the table; no `scheduler.registerCron` for licenses in `association:member/jobs/index.ts` or `member/*/jobs/` | Add a daily cron (pattern: `dues.reminderProcessor`, `jobs/index.ts:19`) that scans `professional_licenses` expiring in N days and inserts alerts idempotently |
| WF-073 publish semantics | `searchDocuments` ignores document status: members can list draft/archived docs; officer UI status filter param is stripped by validator (no-op) | P1 | V1 REQUIRED | `searchDocuments.ts:40-52` (no status in filters), `validators.ts:10269-10280` (no `status` field), `documents.repo.ts:72` (repo supports it), `document-library.tsx:237` (sends ignored param) | Add `status` to TypeSpec query; default member-facing requests to `published` (or enforce by role in handler); wire officer filter |
| WF-074 / PRD 11.3 certificate PDF | PDF has no QR code and renders placeholder "Training Event"/"Organization"; GET route cannot carry the JSON overrides the handler reads; overrides are client-controlled (member can render arbitrary recipient/training/signatory on a genuinely-numbered cert) | P1 | V1 REQUIRED | `certificate-template.ts` (0 QR refs), `generateCertificatePdf.ts:39-63`, `app.ts:520` (GET), `certificate-preview.tsx:48` | Server-side: resolve training/org names from DB instead of body; embed QR of `verify/<certNumber>?signature=<hmac>` using existing `certificate-qr.ts`; drop client-supplied identity fields |
| BR-20 / AC-M11-002 data model | `bulkIssueCertificates` sets `trainingId = organizationId` → one certificate per member per org ever; certificate has no real training linkage; spec invariant "one per person per training" unimplementable | P1 | V1 REQUIRED | `bulkIssueCertificates.ts:46`; documented as known invariant in `MODULE_SPEC.member.certificates.md` §4 | Accept a real `trainingId` in the bulk-issue body (TypeSpec change) and key uniqueness on it; migration/backfill consideration for existing rows |
| R3 follow-up (test debt) | member/credentials: 2 unit test files for 21 handlers incl. trust-critical issue/revoke/public-verify | P1 | V1 RECOMMENDED | `member/credentials/` listing; `MODULE_SPEC.member.credentials.md` §7 self-declares thin | Per-handler unit suites for issue/revoke/verify/lookup + license CRUD before any fix work touches these handlers `[TEST GAP]` |
| MODULE_SPEC.member.credentials §6 | `credential.issued`/`credential.revoked` events documented but never emitted; members get no notification on issuance/revocation | P2 | V1 RECOMMENDED | grep `member/credentials/*.ts` emits = 0; no consumers in `domain-event-consumers.ts` | Either emit events + notification consumer, or correct the spec — pick one, don't leave the contract doc lying |
| m11 §10b VerificationRequested → Audit | `verification.requested` emitted by `verifyCertificatePublic.ts:28` has zero consumers; certificate verifications unpersisted (credentials side has `credential_verification_log`, certificates have nothing) | P2 | V1 RECOMMENDED | grep `domain-event-consumers.ts` = 0 hits | Add audit/log consumer or write a `certificate` row into a verification log; symmetric with credentials |
| PRD 11.5 staleness messaging | No "generated on [date] / older than 30 days" messaging on verify pages | P2 | V1 RECOMMENDED | `verify/$certificateNumber.tsx`, `$credentialNumber.tsx` | Render issuedAt prominently + stale hint; trivial UI change |
| PRD 11.7 branding | Certificate PDF lacks platform branding; ID PDF says "Powered by" not "Verified by" | P2 | V1 RECOMMENDED | `getMyIdCardPdf.ts:199`; `certificate-template.ts` | Add footer branding to certificate template |
| BR-18 secret hygiene | ID-card HMAC uses `AUTH_SECRET ?? 'fallback-secret'` (session secret reuse + forgeable fallback); certs correctly use `CERTIFICATE_QR_SECRET` | P2 | V1 RECOMMENDED | `id-card-data.ts:75`, `verifyCertificatePublic.ts:21` | Dedicated `ID_CARD_QR_SECRET` (or reuse CERTIFICATE_QR_SECRET), fail-closed when unset in production |
| m11 §20 AI instructions | Spec references `handlers/certificates/` and `certificates/repos/` which do not exist (actual `handlers/member/certificates/`) | P3 | V1 RECOMMENDED | `MODULE_SPEC.md:476-477` vs filesystem | Doc sync (batch with CLAUDE.md drift item already in audit index §18) |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Credential templates full CRUD API (5 ops) while feature flag `credential_templates` defaults false and no UI exists | `member/credentials/*CredentialTemplate.ts`; m11 §18 | Supported (m11 WF-075, P2) | Low | Keep; Do not expand (no designer UI until flag flips) |
| `verifyDigitalCredentialAuthenticated` (authenticated verify op) | `member/credentials/verifyDigitalCredentialAuthenticated.ts` | In R3 scope table; not in m11 PRD | Low | Keep |
| `listCertificates.ts` service-helper (not route-registered) | `member/certificates/listCertificates.ts`; kept per `MODULE_SPEC.member.certificates.md` §7 resolution `0e696707` with no-route marker | Documented decision | Low | Keep but clarify; `[DO NOT OVERBUILD]` — do not wire as a route |
| `getMyIdCard` JSON endpoint (`app.ts:514`) with no frontend consumer — UI rebuilds card data client-side from `/persons/me` + memberships | `id-card.tsx:41-51` vs `app.ts:514` | Spec expects single card source | Medium (duplicate source of truth; client card omits HMAC QR) | Keep but converge: UI should consume `getMyIdCard` payload (incl. signed QR) — folds into G1 fix |
| Document `accessLevel` tiering (`public`/`tenantOnly`/`privileged`/`restricted`/`confidential`) with officer downgrade (P0-04) | `searchDocuments.ts:25-37` | Not in m11 spec (spec only has status) | Low — useful, already tested | Keep |
| `view_access_log` meta-logging action | `getDocumentAccessLog.ts:44-57` | Not in spec (spec enumerates view/download) | Low | Keep |
| ID-card QR `timestamp`/`validUntil` replay-bounding fields | `id-card-data.ts:60-72` | Extension of BR-18 | Low | Keep |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| WF-071 ID card download | Member | Opens `/my/id-card` | select org → preview → download PDF | Page + PDF work; empty/loading/error states present | QR verify chain broken (G1) | `id-card.tsx`, `getMyIdCardPdf.ts` |
| WF-072 public verification | Public | Scan QR / open link | validate → show result | Works for certificate numbers + credential numbers at API level; frontend route conflict; no card-token path | G1, G2 | §5 rows 1–2 |
| WF-073 document mgmt | Officer | Upload | upload → draft → publish → archive; versions | Implemented incl. state machine; member visibility of drafts unfixed; access log unwritten | G3, G4 | `updateDocument.ts:7-12`, `searchDocuments.ts` |
| WF-074 certificate download | Member | Training completed | officer bulk-issue → member list → download PDF | List/detail/verify fine; PDF content + QR deficient; issuance not training-linked | G5, G6 | `bulkIssueCertificates.ts:46`, `certificate-template.ts` |
| WF-075 template mgmt | Officer/Admin | Designer | configure → save → applied | API only; flagged off | None for V1 | m11 §18 |
| License renewal | Member | License nearing expiry | system alert → member acknowledges → renews | Read/acknowledge endpoints only; nothing generates alerts; no UI surface found | G7 | grep results §5 row 4 |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| ID card: render preview | Photo/name/license/org/status/expiry | Implemented | `id-card.tsx` | V1 REQUIRED | Empty state for no membership present |
| ID card: QR encodes verifiable token | HMAC-signed payload, scannable → valid result | Missing | `id-card.tsx:82` (raw memberId) | V1 REQUIRED | P0 chain |
| ID card: PDF download | PDF with same QR | Partially Implemented | `getMyIdCardPdf.ts:182` truncated payload | V1 REQUIRED | |
| Public verify: token validation endpoint | `GET /verify/:token` HMAC check | Missing | no route in `app.ts`/`routes.ts` | V1 REQUIRED | |
| Public verify: certificate by number (+HMAC sig) | valid/invalid/notFound | Implemented | `verifyCertificatePublic.ts`, 3 hurl files | V1 REQUIRED | Solid |
| Public verify: credential by number | result + projected holder | Implemented | `lookupCredentialPublic.ts`, `credential-verify-public.hurl` | V1 REQUIRED | PII projection honored |
| Public verify: one reachable page per surface | Each link/QR resolves to correct page | Missing | route shadowing §5 row 2 | V1 REQUIRED | |
| Document upload → draft | create with storage key | Implemented | `createDocument.ts` | V1 REQUIRED | |
| Document publish → member visibility | members see published only | Partially Implemented | `searchDocuments.ts` no status filter | V1 REQUIRED | |
| Document version upload | immutable history | Implemented | `uploadNewDocumentVersion.ts` + hurl | V1 REQUIRED | |
| Document access logging | row per view/download | Missing | §5 row 3 | V1 REQUIRED | |
| Document archive | terminal state | Implemented | `archiveDocument.ts` | V1 REQUIRED | |
| Certificate issuance bound to training | one per person per training | Partially Implemented | `trainingId = organizationId` | V1 REQUIRED | |
| Certificate availability notification | only when cert actually exists | Partially Implemented | `domain-event-consumers.ts:1101-1140` notifies on `training.completed` regardless of issuance | V1 RECOMMENDED | Misleading message (G12) |
| Certificate PDF content | real training/org + QR + branding | Partially Implemented | §5 row 6 | V1 REQUIRED | |
| Credential issue/revoke | admin ops + audit | Implemented | handlers + `x-audit`; `digital-credential-lifecycle.hurl` | V1 REQUIRED | Unit-test thin |
| Renewal alert generation | cron creates alerts | Missing | §5 row 4 | V1 REQUIRED | |
| Renewal alert acknowledge | idempotent ack | Implemented | `acknowledgeLicenseRenewalAlert.ts` + hurl | V1 REQUIRED | |
| person.deleted cascade | credentials deleted; certificates anonymized | Implemented | `domain-event-consumers.ts:1307-1315`; credentials cascade per R3 doc | V1 REQUIRED | |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Download my ID card (M-25) | Member | Card + PDF | Implemented (minus QR chain) | G1 | V1 REQUIRED | §7 |
| Verify a scanned QR (M-27 recipient) | Public | Valid/invalid result | Partially Implemented | G1, G2 | V1 REQUIRED | §7 |
| Share verification link (M-27) | Member | Copy URL | Implemented for certificates (`certificate-preview.tsx:52-56`); ID-card link broken | G1 | V1 REQUIRED | |
| Download training certificate (M-26) | Member | Real-data PDF | Partially Implemented | G5 | V1 REQUIRED | |
| Officer bulk-issues certificates | Officer | Batch issue + numbering | Implemented (training linkage faked) | G6 | V1 REQUIRED | `certificates-bulk-issue.hurl` |
| Officer manages org documents | Officer | Upload/publish/version/archive | Implemented | G4 (visibility) | V1 REQUIRED | officer/documents UI + E2E |
| Member browses org documents | Member | Published docs only | Partially Implemented | G4 | V1 REQUIRED | `document-browser.tsx` |
| Officer reviews document access log | Officer | Who viewed/downloaded | Implemented but data never produced | G3 | V1 REQUIRED | `getDocumentAccessLog.ts` |
| Admin manages credential templates | Admin | CRUD via API | Implemented (API only, flag off) | No | V2 DEFERRED (UI) | §6 |
| Admin issues/revokes digital credential | Admin | Lifecycle + audit | Implemented | unit `[TEST GAP]` | V1 REQUIRED | hurl lifecycle |
| Member tracks professional license | Member/Admin | CRUD | Implemented | No member UI found for license CRUD `[NEEDS CONFIRMATION]` | V1 RECOMMENDED | `professional-license-crud.hurl` |
| Member receives renewal alert | Member | System-generated alert → acknowledge | Missing (generation) | G7 | V1 REQUIRED | §5 |
| Employer verifies via API key (11.6/PA-15) | Partner | Keyed API + rate limit | Missing by decision | No | V2 DEFERRED | PRD 11.6 note |
| Upload/download files (storage) | Any module | Presigned lifecycle | Implemented | spec-known gaps | V1 REQUIRED | storage spec §9 |

## 10. Critical Gaps

| # | Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | ID-card QR verification broken end-to-end (unsigned in-app QR; truncated PDF QR; no `GET /verify/:token` backend; `/verify/$token` page calls a nonexistent endpoint) | ID card / verification | **P0** | V1 REQUIRED | `id-card.tsx:82`; `getMyIdCardPdf.ts:181-191`; `verify/$token.tsx:22`; no route in `app.ts`/`generated/openapi/routes.ts` | WF-071/WF-072 are the spec's P0 workflows and the product's trust proposition; current QRs always fail verification — misleading trust UX | Single canonical card-verify endpoint validating `id-card-data.ts` HMAC payload; both QRs encode its URL; UI consumes backend card payload |
| G2 | `/verify` route shadowing: 3 sibling dynamic routes; at most one verification page reachable | Frontend routing | P1 | V1 REQUIRED | `routes/verify/` (3 files); `routeTree.gen.ts:165-176`; winner `[NEEDS CONFIRMATION]` | Whichever route loses, its QR/share links render the wrong verifier (e.g., credential number → "Certificate Not Found") | One dispatching route or distinct static prefixes; update QR/share URL builders |
| G3 | `document_access_log` never written for view/download; AC-M11-005 unit test is an in-memory simulation | Documents / compliance | P1 | V1 REQUIRED | `getDocument.ts:32`, `downloadDocument.ts:50-57`, sole writer `getDocumentAccessLog.ts:46`, `ac-m11.documents.test.ts:70-110` | Compliance/audit feature advertised by API + spec produces no data; fake-green test hides it | Write log rows in both handlers; real handler-level tests |
| G4 | `searchDocuments` has no status enforcement: members list drafts/archived; officer status filter no-op; `tag` param also ignored | Documents / permissions | P1 | V1 REQUIRED | `searchDocuments.ts:40-52`; `validators.ts:10269-10280`; `document-library.tsx:237`; repo supports status (`documents.repo.ts:72`) | Draft documents are officer work-in-progress; exposure to all members violates WF-073 publish semantics | Add `status` to TypeSpec query; default/force `published` for non-officers; wire `tag` |
| G5 | Certificate PDF: no QR; placeholder training/org names (GET cannot carry overrides); client-controlled identity fields on genuinely numbered cert | Certificates / trust | P1 | V1 REQUIRED | `certificate-template.ts` (0 QR refs); `generateCertificatePdf.ts:39-63`; `app.ts:520`; `certificate-preview.tsx:48` | Printed certificate is the artifact employers see: today it lacks QR + real data, and content is forgeable while carrying a verifiable number | Resolve data server-side; embed `certificate-qr` signature QR; remove client overrides for identity fields |
| G6 | `bulkIssueCertificates` sets `trainingId = organizationId` → max one bulk cert per member per org; no real training linkage | Certificates / schema | P1 | V1 REQUIRED | `bulkIssueCertificates.ts:46`; unique constraint note in `MODULE_SPEC.member.certificates.md` §4 | Second completed training in the same org cannot get a certificate — blocks the recurring CPD journey (core product value) `[CROSS-MODULE RISK]` (m09 training) | Real trainingId in bulk-issue contract; uniqueness on actual training |
| G7 | License renewal alerts never generated (no cron/job; only seed writes the table) | Credentials / lifecycle | P1 | V1 REQUIRED | grep: `license_renewal_alerts` writers = seed only; `association:member/jobs/index.ts` has no license job | "Nudge before license expiry" is a headline credential feature for healthcare professionals; it silently does nothing | Daily cron mirroring `dues.reminderProcessor` pattern |
| G8 | member/credentials unit coverage: 2 files / 21 handlers (issue/revoke/verify untested at unit level) | Tests | P1 | V1 RECOMMENDED | `member/credentials/` listing; spec §7 self-acknowledged | Trust-critical surface unprotected for safe fixing `[TEST GAP]` | Per-handler suites before/with any credentials fixes |
| G10 | 0 unit tests for `getMyIdCard.ts`, `getMyIdCardPdf.ts`, `id-card-data.ts`; 0 for `downloadDocument.ts` | Tests | P2 | V1 RECOMMENDED | `handlers/person/` test listing; grep `downloadDocument` in `documents/*.test.ts` = 0 | P0-workflow code paths with no protection | Add unit tests during G1/G3 fixes `[TEST GAP]` |
| G11 | `credential.issued`/`credential.revoked` documented but never emitted; no notifications | Credentials / events | P2 | V1 RECOMMENDED | `MODULE_SPEC.member.credentials.md` §6 vs grep = 0 | Spec/code contract lie; members unaware of issuance/revocation | Emit + consumer, or fix spec |
| G12 | `training.completed` consumer notifies "certificate ... available to download" even when no certificate has been issued | Certificates / UX | P2 | V1 RECOMMENDED | `domain-event-consumers.ts:1101-1140`; issuance is manual bulk-issue | Misleading member journey M-26 | Gate notification on certificate existence, or reword |
| G13 | `verification.requested` event has no consumer; certificate verifications unlogged (asymmetric with `credential_verification_log`) | Audit | P2 | V1 RECOMMENDED | `verifyCertificatePublic.ts:28`; grep consumers = 0 | m11 §10b + PRD M11-R2 audit-logging requirement | Add audit consumer |
| G14 | Staleness-window messaging (PRD 11.5, 30-day rule) absent from verify pages | Verification UX | P2 | V1 RECOMMENDED | `verify/$certificateNumber.tsx`, `$credentialNumber.tsx` | Verifiers can't judge currency vs authenticity | Show issuedAt + stale hint |
| G15 | Platform branding missing from certificate PDF; "Powered by" vs spec "Verified by Memberry" on ID PDF | PDFs | P2 | V1 RECOMMENDED | `getMyIdCardPdf.ts:199`; `certificate-template.ts` | PRD 11.7 non-removable v1 branding | Footer in template |
| G16 | ID-card HMAC secret = `AUTH_SECRET ?? 'fallback-secret'` | Security config | P2 | V1 RECOMMENDED | `id-card-data.ts:75` | Forgeable signatures if env unset; secret-reuse smell | Dedicated secret, fail-closed in prod |
| G17 | m11 §20 stale handler paths; CLAUDE.md nonexistent `certificates/` dir | Docs | P3 | V1 RECOMMENDED | `MODULE_SPEC.md:476-477` | Misroutes future AI/devs | Doc sync batch |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Scan in-app ID-card QR → verify | Valid result with member status | QR encodes `/verify/<personId-UUID>`; whichever verify page wins the route conflict queries cert/credential/token APIs with a UUID → always "not verified" | `id-card.tsx:82,137-142` | P0 | E2E: scan-equivalent — GET the QR URL, assert valid result renders |
| Scan PDF ID-card QR text → verify | Same | `memberry.app/verify?p=<40-char-truncated payload>`; `/verify` has no index route; payload truncated below decodability | `getMyIdCardPdf.ts:181-191` | P0 | Unit: payload round-trip from rendered URL; E2E verify page |
| Open `/verify/<credentialNumber>` from credential share | Credential lookup result | Route shadowed by sibling `$certificateNumber`/`$token` (one wins; others dead) `[NEEDS CONFIRMATION which]` | `routes/verify/` 3 siblings | P1 | E2E: one URL per surface asserting correct result body |
| Officer opens document access log | See member views/downloads | Log empty except self-inflicted `view_access_log` rows | `getDocumentAccessLog.ts:44-57` | P1 | Integration: download → access-log row exists |
| Member browses org documents | Published docs only | Drafts/archived included (status never filtered) | `searchDocuments.ts` | P1 | Backend test: member role + draft doc → not listed |
| Member downloads certificate PDF | Real training title/org, QR | "Training Event"/"Organization" placeholders, no QR | `generateCertificatePdf.ts:43-46`, GET route | P1 | Unit: PDF text contains real training title + QR present |
| Member completes 2nd training in same org → certificate | Second certificate issued | Unique constraint on (orgId-as-trainingId, personId) blocks | `bulkIssueCertificates.ts:46` | P1 | Backend test: two issuances same person/org different trainings |
| Member gets "certificate available" notification | Certificate exists | Notification fires on `training.completed` regardless | `domain-event-consumers.ts:1101-1140` | P2 | Unit: no cert → no/different notification |
| Existing E2E "verify page accessible" | Catches the above | Asserts only `body` is visible — passes on a broken page | `member/certificates.spec.ts:55-63` | P2 `[TEST GAP]` | Deepen assertion to result content |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `getMyIdCard` (JSON, `app.ts:514`) | API with no frontend consumer | `id-card.tsx` builds card from `/persons/me` + memberships instead | Duplicate source of truth; signed QR payload unused by UI | Wire UI to it during G1 fix |
| `verify/$token.tsx` page | UI calling nonexistent endpoint | `GET /api/verify/${token}` has no backend route | Dead/erroring page; shadow-route hazard | Rewire or delete in G1/G2 |
| Officer `status` filter in document library | UI field with no backend effect | `document-library.tsx:237` → validator strips param | Officer believes filter works | Fix with G4 |
| `tag` query param on searchDocuments | Validator field ignored by handler | `validators.ts:10279` vs `searchDocuments.ts:42-49` | Silent no-op filter | Wire with G4 |
| `license_renewal_alerts` read/ack surface | Feature with no producer | G7 evidence | Dead feature outside seeded demos | Add cron (G7) |
| `verification.requested` event | Emitted, no consumers | `verifyCertificatePublic.ts:28` | Lost audit signal | G13 |
| `body` overrides in `generateCertificatePdf` on a GET route | Dead-or-dangerous code path | `app.ts:520` GET + `ctx.req.valid('json')` | If ever reachable (proxy/POST), enables content forgery | Remove with G5 |
| `listCertificates.ts` service helper | Intentional non-route helper | `MODULE_SPEC.member.certificates.md` §7 (kept, marker comment) | None | Keep as documented |
| `ac-m11.documents.test.ts` AC-M11-005/006 blocks | In-memory simulation tests | Tests local closures, not handlers | False confidence (fake-green) | Replace alongside G3 |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| `certificates.trainingId` stores an organizationId (semantic corruption + uniqueness misuse) | schema/model | `bulkIssueCertificates.ts:46`; `certificates.schema.ts` unique constraint | P1 | G6 fix + backfill plan |
| `document_access_log` populated only by meta-logging | schema/data | `getDocumentAccessLog.ts:46` sole writer | P1 | G3 |
| `license_renewal_alerts` production-empty (seed-only writes) | schema/data | `seed/layer-5-gap-fill.ts` | P1 | G7 |
| Credentials schema lives at `handlers/association:member/repos/` while handlers live at `handlers/member/credentials/`; `ProfessionalLicenseRepository`/`LicenseRenewalAlertRepository` live in `credits.repo.ts` | schema location | `MODULE_SPEC.member.credentials.md` §5/§9 — deliberate, 7 inbound importers | P3 (accepted) | Leave; `[SHARED DEPENDENCY]` — only revisit in mega-module split `[DO NOT OVERBUILD]` |
| `stored_file` rows orphaned on `person.deleted` (no consumer scrubs) | schema/data | `MODULE_SPEC.storage.md` §9 | P2 | `[CROSS-MODULE RISK]` — note for person/core-platform audit; candidate consumer |
| Stale `uploading` rows never aged out | data lifecycle | `MODULE_SPEC.storage.md` §9 | P3 | Defer until observed (spec stance) |
| `SearchDocumentsQuery` missing `status` despite schema enum + repo support | API contract | `validators.ts:10269-10280` vs `documents.repo.ts:72` | P1 | G4 (TypeSpec change → regenerate) |
| Frontend rebuilds ID-card state from two endpoints while backend has canonical builder | state management | `id-card.tsx:41-51` vs `id-card-data.ts` | P2 | G1 |
| `verifyCertificatePublic` falls back to empty-string secret when config absent | API/config | `verifyCertificatePublic.ts:21` (`|| ''`) | P2 | Fail-closed with G16 |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Members can list draft/archived org documents | Documents read scope | `searchDocuments.ts` no status gate | P1 | G4 |
| Certificate PDF content client-forgeable on genuine cert number (if override path reachable); identity fields should never be client-supplied | Certificates integrity | `generateCertificatePdf.ts:39-63` | P1 | G5 |
| In-app ID-card QR exposes raw personId UUID in a public URL | PII minimization | `id-card.tsx:82` | P2 | G1 (signed opaque token) |
| HMAC fallback secrets (`'fallback-secret'`, `'' `) | Crypto config | `id-card-data.ts:75`, `verifyCertificatePublic.ts:21` | P2 | G16 fail-closed |
| Public endpoints PII projection (credential lookup/verify) correctly limited | Public surface | `lookupCredentialPublic.ts:72` area; spec §9 | OK | None |
| Documents RBAC via extensions is strong (delete = President + `x-require-position`; update = officer) | Documents admin | `documents.tsp:264-369` | OK | None |
| `downloadDocument` self-enforces org membership/admin (hand-wired, documented reason) | Documents download | `downloadDocument.ts:34-46`, `app.ts:493` | OK (untested) | Add unit test (G10) |
| Privileged accessLevel downgrade for non-officers (P0-04 fix) present | Documents read tiers | `searchDocuments.ts:25-37`, `permission-enforcement.test.ts` | OK | None |
| Credentials RBAC contract-tested (401/403 edges) | Credentials admin | `credentials-rbac.hurl` | OK | Unit layer still thin (G8) |

## 15. Record Safety / Audit History Findings

Module handles compliance-sensitive records (professional credentials, licenses, certificates, org documents).

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Document view/download audit trail not produced at module level (platform `x-audit`/`auditAction` fires, but the spec-mandated `document_access_log` stays empty) | Document access history | G3 evidence | P1 | G3; decide whether platform audit events alone satisfy M11-R5 `[NEEDS PRODUCT DECISION]` — recommended: keep both, table feeds officer-facing log UI |
| Certificate public-verification attempts unlogged | Verification history | G13 evidence | P2 | G13 |
| Credential verify attempts logged append-only (`credential_verification_log`) — good | Verification history | `credentials.schema.ts` | OK | None |
| `person.deleted` → certificates retained with `updatedBy='system'` (records-retention posture) and credentials deleted | Deletion cascade | `domain-event-consumers.ts:1307-1315`; R3 doc §“Consumers” | OK | None |
| Document versions immutable | Document history | `document_version` + tests | OK | None |
| Credential mutations carry `x-audit` (12 ops) | Credential history | spec §3 table; routes generation | OK | None |

## 16. Knowledge Graph Findings

KG (`.understand-anything/knowledge-graph.json`, 2026-06-06) used as secondary evidence only; all findings below re-verified by direct inspection (KG predates R-series certificate cutover commits).

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Module spans 4 handler dirs + person/ id-card files + association:member repos — boundary matches audit-index §8 row | Direct `find` verification | Fixes touch 3+ ownership zones; sequence carefully | Fix-batches must be path-scoped |
| Credentials schema has 7 inbound importers outside the module | `R3_CREDENTIALS_SCOPE.md` consumer list, re-verified by grep | High blast radius if schema moved | Do not move during fixes `[SHARED DEPENDENCY]` |
| `certificate.bulk_generate` job lives in `association:member/jobs/` and dynamically imports the member/certificates handler | `jobs/index.ts:55`; cert spec §2 | G6 contract change must update job payload too | Include job in G6 scope |
| `domain-event-consumers.ts` is the single seam for person.updated/membership.status.changed/training.completed/person.deleted effects on this module | lines 1029-1140, 1307-1315 | G7/G12/G13 changes concentrate here | One consumer-file PR, well-tested |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Verification has three distinct domain artifacts (card token, certificate number, credential number) but the product story (PRD 11.5) promises one `/verify/[token]` surface | PRD 11.5 vs 3 endpoints/3 routes | Root cause of G1/G2 | Decide canonical verify UX once, then implement (see §25 Q1) |
| CPD renewal journey (audit-index journey-cpd) depends on this module's certificate-per-training integrity | `journeys/training-to-credit.spec.ts`; m09/m10 specs | G6 blocks repeat-training certificates → degrades core CPD value | Treat G6 as cross-module with training-credits `[CROSS-MODULE RISK]` |
| Healthcare-association domain expects license-expiry nudges as retention/compliance driver | credentials spec §1; PH dental context (MASTER_PRD personas) | G7 is a real-domain gap, not test debt | V1 REQUIRED |
| Document access logging is a professional-association governance expectation (board minutes, financial docs) | m11 M11-R5; accessLevel tiers in code | G3 is compliance-relevant, not nice-to-have | V1 REQUIRED |

## 18. Webwright / Playwright Findings

Static review sufficient; browser tooling skipped for batch run. No Webwright/Playwright executed; existing E2E specs inspected read-only.

| Finding | Tool | Evidence Location | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| `QR Verification` E2E asserts only that `body` is visible at `/verify/test-token-123` — passes against the broken token page | Playwright (inspected, not run) | `apps/memberry/tests/e2e/member/certificates.spec.ts:55-63` | Masks G1/G2 | Deepen to assert verification result content per surface |
| No E2E exercises a real QR URL produced by the app (card or certificate) | Playwright (inspected) | grep across `tests/e2e` | The only end-to-end proof of the trust loop is absent | Add post-fix journey: download → extract verify URL → assert valid |

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `handlers/documents/*.test.ts` (16 per-handler files + `documents-handlers.test.ts`, `auth-enforcement.test.ts`, `permission-enforcement.test.ts`) | backend/unit | CRUD, tags, versions, auth/permission edges | High |
| `handlers/documents/ac-m11.documents.test.ts` | backend/unit | AC-M11-005/006 — **in-memory simulation only** | Low (fake-green) |
| `handlers/documents/slice-023-documents-credentials.test.ts` | backend/unit | AC-M11-001/002/003/004 at util/repo level | Medium |
| `handlers/documents/repos/documents.repo.test.ts` | backend/unit | repo filters | High |
| `member/certificates/` 12 test files (81 tests per spec §3) | backend/unit | bulk issue, public verify ± HMAC, PDF gen, numbering, template, permissions, flow-09 | High |
| `member/credentials/credentials.test.ts`, `lookupCredentialPublic.test.ts` | backend/unit | template+credential integration; public lookup | Low (2/21 handlers) |
| `storage/` 4 test files incl. `br-31.svg-upload-security.test.ts` | backend/unit | upload, MIME/SVG contract, auth | Medium |
| Hurl: `member/credentials/` 6 files; `member/certificates/` 5 files; `assoc-documents-flow.hurl`, `assoc-document-tags-flow.hurl`; `storage.hurl`, `storage-edge.hurl`, `storage-extended-flow.hurl`; legacy `assoc-credential*`/`credentials-flow.hurl` | contract | CRUD lifecycles, RBAC edges, public verify, bulk issue, document flow incl. access-log read + archive | High (for covered ops) |
| E2E: `member/digital-id-card.spec.ts`, `member/certificates.spec.ts`, `member/documents.spec.ts`, `officer/documents.spec.ts`, `officer/certificate-generation.spec.ts`, `journeys/document-lifecycle.spec.ts` | E2E/Playwright | Page render + basic flows | Medium (assertions shallow per repo-wide E2E_DEPTH_AUDIT pattern) |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Handler-level access-log tests: `getDocument`/`downloadDocument` create `document_access_log` rows | backend/unit + integration | Replace fake-green AC-M11-005; protect G3 fix | Before (red test drives fix) |
| `downloadDocument` unit suite (auth matrix: admin / member-of-org / outsider; redirect) | backend/unit, permission | Hand-wired, currently 0 tests | Before G3 |
| `searchDocuments` status enforcement (member sees published only; officer filter works) | backend/unit + contract (hurl) | Protect G4 | Before |
| `id-card-data` payload round-trip + HMAC verify; `getMyIdCardPdf` QR URL decodable | backend/unit | Protect G1; currently 0 tests on id-card files | Before |
| Card-verify endpoint contract test (valid / tampered / truncated token) | contract (hurl) | New endpoint in G1 | During |
| Single-verify-route dispatch test (cert#, credential#, card token each render correct result) | E2E/Playwright | Protect G2; current E2E asserts body-visible only | During |
| Certificate PDF content test: real training title + org + QR bytes present; client overrides rejected | backend/unit | Protect G5 | Before |
| Bulk-issue with real trainingId: two certs same person/org different trainings | backend/unit + contract | Protect G6 | Before |
| Renewal-alert cron test: license expiring in N days → alert row, idempotent re-run | backend/unit (job) | Protect G7 | Before |
| Per-handler credentials suites (issue, revoke, verify auth/public, license CRUD, ack) | backend/unit | G8 trust-critical surface | Before any credentials fixes |
| `training.completed` notification gated on certificate existence | backend/unit | Protect G12 | During |
| `verification.requested` consumer writes audit record | backend/unit | Protect G13 | During |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| `association:member/repos/credentials.{schema,repo}.ts` + licenses in `credits.repo.ts` | shared/platform | spec §5/§9; 7 inbound importers | Any credentials fix imports across module dirs; moving = cascade rewrite | `[SHARED DEPENDENCY]` Do not move; import in place |
| `core/domain-event-consumers.ts` | shared/platform | G7/G12/G13 + cascade live here | Single file shared by 9 module owners | `[SHARED DEPENDENCY]` Small, separately-tested edits |
| TypeSpec → generate pipeline (`specs/api` build + `bun run generate`) | shared/platform | G4 (status param), G6 (trainingId) need contract changes | Regeneration touches `generated/**` consumed by SDK + both apps | Follow API-first workflow; run `check:sdk-compat` |
| m09 training module (real trainingId source; `training.completed` payload) | cross-module | G6, G12 | Certificate↔training linkage is the m09↔m11 seam | `[CROSS-MODULE RISK]` Coordinate with training-credits audit (already completed per audit order) |
| `handlers/person/` (id-card files live there) | cross-module | `app.ts:514-515` | G1 fix edits person-owned files | Scope-limited; flag in fix plan |
| Storage SVG policy vs m11 logo requirement | product decision | PRD 11.8 vs `MODULE_SPEC.storage.md` BR-31 stance | Org-logo SVG flow currently impossible; raster-only de facto | `[NEEDS PRODUCT DECISION]` (see §25 Q4) |
| `org_certificate_seq` + `certificate_training_person_unique` | database/schema | `certificates.schema.ts` | G6 changes uniqueness semantics → migration | Plan migration + backfill in fix-ready stage |
| Memberry router (`routeTree.gen.ts`) | shared/platform | G2 route collapse regenerates tree | Affects public URLs already printed on artifacts | Keep old URL shapes working via redirects if URLs changed |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Canonical card-verify endpoint + both QRs encode full verify URL + UI consumes `getMyIdCard` payload | G1 | P0 | V1 REQUIRED | unit (payload round-trip), contract, E2E | Decide token format first (§25 Q1) |
| Collapse `/verify/*` to one dispatching route (keep `/verify/<certNumber>` shape working) | G2 | P1 | V1 REQUIRED | E2E per surface | Coordinate with G1 |
| Write access-log rows in `getDocument` + `downloadDocument`; replace fake-green AC test | G3 | P1 | V1 REQUIRED | unit + integration | Best-effort try/catch like meta-log |
| Add `status` (and wire `tag`) to searchDocuments TypeSpec; enforce published-only for non-officers | G4 | P1 | V1 REQUIRED | unit + hurl | TypeSpec regen |
| Server-resolved certificate PDF data + embedded HMAC QR + branding footer; strip client identity overrides | G5, G15 | P1 | V1 REQUIRED | unit (PDF content) | Reuse `certificate-qr.ts` |
| Real `trainingId` in bulk-issue contract; uniqueness on actual training; update `certificate.bulk_generate` job payload | G6 | P1 | V1 REQUIRED | unit + contract + migration test | `[CROSS-MODULE RISK]` m09 |
| Daily license-expiry cron → insert renewal alerts idempotently | G7 | P1 | V1 REQUIRED | job unit test | Mirror `dues.reminderProcessor` |
| Per-handler credentials unit suites | G8 | P1 | V1 RECOMMENDED | backend/unit | Write before credentials fixes |
| id-card + downloadDocument unit tests | G10 | P2 | V1 RECOMMENDED | backend/unit | Fold into G1/G3 batches |
| Emit `credential.issued`/`credential.revoked` + notification consumer (or amend spec) | G11 | P2 | V1 RECOMMENDED | unit | Cheap; consumer pattern exists |
| Gate "certificate available" notification on cert existence | G12 | P2 | V1 RECOMMENDED | unit | One consumer block |
| `verification.requested` audit consumer | G13 | P2 | V1 RECOMMENDED | unit | |
| Verify-page staleness messaging (issuedAt + 30-day hint) | G14 | P2 | V1 RECOMMENDED | component/E2E | |
| Fail-closed QR secrets (`ID card`, cert empty-string fallback) | G16 | P2 | V1 RECOMMENDED | unit (prod-mode) | |
| Doc sync: m11 §20 paths, CLAUDE.md `certificates/` dir | G17 | P3 | V1 RECOMMENDED | n/a | Batch with platform doc-drift item |
| Deepen QR-verification E2E assertions | §18 | P2 | V1 RECOMMENDED | E2E | After G1/G2 land |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Verification API keys + per-key rate limiting + PA-15 admin UI (M11-R3, PRD 11.6) | V2 DEFERRED | PRD explicitly defers key management to platform engineering; no ApiKey schema exists; public verify endpoints cover V1 `[NEEDS PRODUCT DECISION]` on timing |
| Credential template designer UI (WF-075) | V2 DEFERRED | Feature flag `credential_templates` defaults false; API exists; spec marks P2 |
| Persisted `MemberCard` entity + S3-cached card PDFs | DO NOT ADD `[DO NOT OVERBUILD]` | On-the-fly generation deliberately satisfies BR-19 (`domain-event-consumers.ts:1029-1032`); adding a card table reintroduces staleness the design removed |
| Moving credentials schema out of `association:member/repos/` | DO NOT ADD `[DO NOT OVERBUILD]` | 7 inbound importers; specs forbid; zero behavioral gain; mega-module split owns this later |
| Storage virus scanning | V2 DEFERRED | Spec-acknowledged production-hardening item; MIME allowlist is the V1 barrier |
| SVG logo upload + sanitization pipeline | V2 DEFERRED / `[NEEDS PRODUCT DECISION]` | Storage deliberately blocks SVG (BR-31 stance); raster logos suffice for V1; lifting requires sanitizer promotion from test contract to handler |
| `file.completed`/`file.deleted` storage domain events | V2 DEFERRED | Spec-flagged candidate cleanup; no current consumer need |
| Stale-`uploading` row reaper job | V2 DEFERRED | Spec stance: add when observed problem |
| Wiring `listCertificates.ts` helper as a route | DO NOT ADD | Explicit marker-comment prohibition (`0e696707` resolution) |
| Offline-scanner mobile verification app/SDK | DO NOT ADD `[DO NOT OVERBUILD]` | PRD mentions offline HMAC property only; no V1 actor needs a custom scanner |

## 24. Audit Decision

**FAIL**

The documents surface, certificate verify-by-number API, credentials API surface, and storage are individually solid and well contract-tested. But the module's headline trust workflow — *generate a credential, scan its QR, verify it publicly* (WF-071→WF-072, both P0 in the spec) — is broken end-to-end for ID cards (P0 G1: unsigned in-app QR, truncated PDF QR, no token endpoint), structurally compromised for all surfaces by the `/verify` route shadowing (G2), and weakened for certificates by QR-less, placeholder-content PDFs (G5). Three further P1s leave V1 features silently dead or misleading: access logs never written (G3), draft documents visible to members (G4), renewal alerts never generated (G7), plus the one-certificate-per-org data defect (G6). P0 + 7 P1 gaps block reliable V1 use.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: What is the canonical card-verification token/URL format — reuse credential public-verify token semantics, or a new `GET /verify/:token` validating the `id-card-data` payload? | `[NEEDS PRODUCT DECISION]` | Determines the whole G1 fix shape and printed-artifact URL stability | Product + platform |
| Q2: Which `/verify/$param` route currently wins TanStack matching (affects which printed URLs are live today)? | `[NEEDS CONFIRMATION]` | Tells us which already-distributed QR/share links break in the wild; quick browser check at fix time | Eng (fix-phase verification) |
| Q3: Does the platform `x-audit`/`auditAction` trail satisfy M11-R5, or is the module-owned `document_access_log` table the required record (recommended: both, table feeds officer UI)? | `[NEEDS PRODUCT DECISION]` | Scopes G3 — write-through vs UI-rewire | Product |
| Q4: SVG org logos — keep BR-31 hard block (raster-only logos) or implement the m11 §11.8 sanitization pipeline? PRD and storage spec currently contradict each other. | `[NEEDS PRODUCT DECISION]` | Conflicting specs; affects logo upload UX and security surface | Product + security |
| Q5: Should certificates auto-issue on `training.completed` + attendance (BR-20 reading) or remain officer-initiated bulk issuance? | `[NEEDS PRODUCT DECISION]` | Determines whether G12 is a reword or an issuance-pipeline build; affects m09 seam | Product |
| Q6: Zero-credit trainings — generate certificate? (spec's own `[VERIFY]`, m11 §13) | `[NEEDS CONFIRMATION]` | Edge case in G5/G6 test design | Product |
| Q7: Is there intended member/admin UI for professional licenses + renewal alerts in V1, or API-only until admin credentials UI lands (cred spec §7 defers E2E to that work)? | `[NEEDS PRODUCT DECISION]` | Affects whether G7 cron output is visible anywhere; alerts with no surface still useful via notifications? | Product |
| Q8: Existing certificates with `trainingId = organizationId` — backfill strategy when G6 lands (null out, map via credit entries, or freeze)? | `[NEEDS CONFIRMATION]` | Migration safety for issued artifacts | Eng + product |

## 26. Notes for Gap Plan Organizer

- **True V1 P0/P1 set:** G1 (P0), G2–G8 (P1). G1+G2 are one coherent "verification chain" batch — fix together, gated on Q1. G3+G4 are a self-contained documents batch (one TypeSpec regen). G5+G6 are a certificates batch with a schema migration (Q8) and m09 coordination `[CROSS-MODULE RISK]`. G7 is a standalone job addition. G8/G10 are test-first prerequisites, not features.
- **Tests to write first (red):** access-log handler tests, searchDocuments status tests, id-card payload round-trip, certificate-PDF content test, bulk-issue real-trainingId test, renewal-cron test, credentials per-handler suites (see §20).
- **Blocked-by-product:** Q1 (blocks G1/G2 final shape — but backend HMAC validation work can start), Q3 (G3 scope), Q4 (SVG — defer entirely if undecided), Q5 (G12), Q7 (G7 UI surface; cron itself is unblocked).
- **Must NOT implement yet:** everything in §23 — especially API-key verification, MemberCard persistence, credentials-schema relocation, SVG pipeline.
- **Shared-file caution:** `core/domain-event-consumers.ts` (G7/G12/G13), TypeSpec + generated registry (G4/G6), `handlers/person/` id-card files (G1), `routeTree.gen.ts` (G2). Keep batches path-scoped; run `check:sdk-compat` after any TypeSpec change.
- **Fake-green warning:** `ac-m11.documents.test.ts` AC-M11-005/006 and the body-visible verify E2E must be replaced/deepened in the same batches that fix the underlying gaps, or the fixes can't be proven.
- **Printed-artifact stability:** any change to `/verify/*` URL shapes must preserve already-distributed certificate verification URLs (`/verify/<certNumber>` is printed on share links today).

---

Next recommended step:
Module/group: Documents & Credentials
Module slug: documents-credentials
Primary PRD/spec: docs/product/modules/m11-documents-credentials/MODULE_SPEC.md
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/documents-credentials-gap-plan.md
