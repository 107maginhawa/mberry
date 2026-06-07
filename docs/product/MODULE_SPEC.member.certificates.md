# MODULE_SPEC: member/certificates

First sub-domain of the mega-module decomposition's post-R4 phase
(formerly R5 in the pre-rebaseline sequence; numbering dropped — see
`docs/quality/REMAINING_SCOPE.md`).

## 1. Purpose

Owns the certificate surface of an association: issuance, retrieval,
listing, public verification, PDF rendering, and the underlying
templating + numbering + QR-signing utilities. One TypeSpec file
(`association/member/certificates.tsp`), three interfaces, four
generated operations, plus one hand-wired PDF byte-download:

- **Certificate Management** — member-scoped CRUD (read only) via
  `listMyCertificates` / `getCertificate`, returning the certificate
  record (number, issuedAt, status, credit hours, CPD activity type)
  for the authenticated person.
- **Certificate Verification Service** — `verifyCertificatePublic`:
  unauthenticated lookup by certificate number with optional HMAC
  signature verification (`?signature=...`) for tamper-resistant QR
  scans. Emits `verification.requested` domain event.
- **Certificate Bulk Issuance** — `bulkIssueCertificates`: officer-only
  batch issue with sequence-range reservation (N+1-safe transactional
  `reserveCertificateRange`), template validation, and async fall-through
  to `certificate.bulk_generate` job for batches > 10.

Plus, by design hand-wired (kept):
- **PDF Generation** (`/certificates/:id/pdf`) — `generateCertificatePdf`,
  Wave-2b. Browser-driven byte download, owner-scoped (IDOR-guarded),
  emits `credential.generated` domain event.

## 2. Bounded Context

In scope:
- The three TypeSpec interfaces wired in `main.tsp` under
  `@tag("Member/Certificates")`:
  `AssocCertificateManagement`, `CertificateVerificationService`,
  `CertificateBulkIssuance`.
- All four generated routes:
  - `GET /association/member/certificates` (`listMyCertificates`)
  - `GET /association/member/certificates/{certificateId}` (`getCertificate`)
  - `POST /certificates/bulk-issue` (`bulkIssueCertificates`)
  - `GET /certificates/verify/{certificateNumber}` (`verifyCertificatePublic`)
- The hand-wired PDF route `GET /certificates/{id}/pdf`.
- The owned schema (`certificates` table + `org_certificate_seq`
  sequence table) and repo (`CertificatesRepository`).
- The owned utilities: `certificate-numbering` (transactional
  range reservation), `certificate-qr` (HMAC signing/verification),
  `certificate-template` (HTML/PDF rendering with org branding).

Out of scope:
- `association:member/jobs/index.ts` registers
  `certificate.bulk_generate` job — stays in the mega-module's
  `jobs/` dir (same pattern as R3 credentials — jobs do not move
  with handlers). Job body imports the canonical handler via
  `await import('@/handlers/member/certificates/bulkIssueCertificates')`.
- `DigitalCredentialRepository` used by `getCertificate` /
  `listMyCertificates` lives at
  `handlers/association:member/repos/credentials.repo.ts` — same
  cross-module read pattern as R3 (the certificate handlers read
  from the credentials repo because the "certificate" entity is a
  specialization of the broader credential model). Lives where it
  lives until the mega-module-split phase relocates it.
- `getMyIdCard` / `getMyIdCardPdf` (Wave-2b) — by-design hand-wired
  in `handlers/person/`, not part of certificates surface.

Adjacent modules and the seams between them:

| Adjacent module | Seam |
| --- | --- |
| `member/credentials` | `DigitalCredentialRepository` reused by `getCertificate` and `listMyCertificates` (cross-module read). |
| `core/domain-events` | Emits `verification.requested` (verifyCertificatePublic) and `credential.generated` (generateCertificatePdf). Listened to by notification + audit consumers. |
| `core/audit/audit-action` | `generateCertificatePdf` calls `auditAction()` inline for PDF download events. Other ops covered by the per-route audit middleware via `@extension("x-audit", ...)`. |
| `core/jobs` | Background job `certificate.bulk_generate` handles batches > 10 — dispatches back to `generateCertificates()` (the non-handler helper exported from `bulkIssueCertificates.ts`). |
| `association:member/repos/credentials.repo` | Cross-module dep for member-facing reads. Stays at mega-module for now. |
| `person/getMyIdCard` | Reuses the same `certificate-template` utility for ID-card rendering (no direct dep, similar shape). |

## 3. Files (post-cutover, baseline `922e1c62`)

`services/api-ts/src/handlers/member/certificates/`:

| File | LOC | Role |
| --- | --- | --- |
| `bulkIssueCertificates.ts` | 75 | TypeSpec-generated handler; also exports `generateCertificates()` for the job worker. |
| `verifyCertificatePublic.ts` | 34 | TypeSpec-generated; public, no auth. HMAC verify optional. |
| `getCertificate.ts` | 34 | TypeSpec-generated; member-scoped (owner-only). |
| `listMyCertificates.ts` | 33 | TypeSpec-generated; session-user query. |
| `generateCertificatePdf.ts` | 98 | Hand-wired Wave-2b; member-scoped byte download. |
| `listCertificates.ts` | 15 | Service-style helper (not registered); imported dynamically by `slice-023-documents-credentials.test.ts`. |
| `repos/certificates.repo.ts` | – | Owns `CertificatesRepository`. |
| `repos/certificates.schema.ts` | 48 | `certificates` + `org_certificate_seq` Drizzle schema. |
| `utils/certificate-numbering.ts` | – | `reserveCertificateRange()` + `getNextCertificateNumber()`. |
| `utils/certificate-qr.ts` | – | HMAC sign/verify (16-char hex). |
| `utils/certificate-template.ts` | – | HTML + PDF render. |

Tests (colocated):
- `bulkIssueCertificates.test.ts` (141 LOC)
- `verifyCertificatePublic.test.ts` (151 LOC)
- `verifyCertificatePublic-hmac.test.ts` (83 LOC)
- `getCertificate.test.ts` (79 LOC) — moved from `association:member/` at cutover
- `listCertificates.test.ts` (44 LOC)
- `generateCertificatePdf.test.ts` (136 LOC)
- `permission-enforcement.test.ts` (97 LOC)
- `flow-09.certificate-retrieval.test.ts` (80 LOC)
- `repos/certificates.repo.test.ts` (62 LOC)
- `utils/certificate-numbering.test.ts` (14 LOC)
- `utils/certificate-qr.test.ts` (50 LOC)
- `utils/certificate-template.test.ts` (297 LOC)

Total: 81 tests across 12 files, all passing post-cutover.

## 4. Contract test layout

`specs/api/tests/contract/member/certificates/`:
- `certificates-public-verify.hurl` (52 LOC, moved from `certificates-flow.hurl`)
- `certificates-list-get.hurl` (25 LOC, moved from `assoc-certificates-flow.hurl`)

**Deferred (not blocking cutover):** the cert-scope plan envisioned 5 Hurl
scenarios for end-to-end coverage (bulk-issue happy path, verify-revoked,
verify-with-hmac, get-not-found, list-empty). The current 2 files only
cover skeletal sign-in + sign-out + first request. Because the cutover did
not change wire behavior (only relocated impls), the existing Hurl
suite remains valid. New scenarios should be authored as a follow-up
commit set with a live API session.

## 5. Decisions resolved during the cutover

| Decision | Resolution | Rationale |
| --- | --- | --- |
| `handlers/certificates/` vs new `handlers/member/certificates/` | Rename to `member/certificates/` | Preserves R-series naming convention; canonical impl already lived in `handlers/certificates/`. Single source of truth post-cutover. |
| Two 1-LOC shims at `association:member/` (bulkIssue, verifyPublic) | Deleted | Pointed at the (now-moved) canonical impl; no consumers other than the generated registry. Strangler-fig completion. |
| Hand-wired route duplicate `/certificates/verify/:certificateNumber` (app.ts + routes.ts) | Killed hand-wired, kept generated | Both called the same handler. Generated route is auth-free by spec; `/certificates/*` is outside `/association/*` middleware so no PUBLIC_PATHS change needed. |
| Orphan `listCertificates.ts` (not in registry) | Kept (not orphan) | `handlers/documents/slice-023-documents-credentials.test.ts` imports it dynamically. |
| Repo location (`credentials.repo` vs new `certificates.repo`) | Both stay where they are | `getCertificate`/`listMyCertificates` read from `credentials.repo` (cross-module). `certificates.repo` (owned schema) co-located with handlers. |

## 6. Gates posture at cutover commit `922e1c62`

| Gate | Result vs baseline `339b9051` |
| --- | --- |
| typecheck | 5/5 (api-ts, sdk-ts, ui, memberry, admin) |
| unit | 5918 pass + 1 env-flake (`registerEmailJobs` fails when `.env` overrides `EMAIL_PROCESSOR_INTERVAL_MS=1000`; passes with default). Baseline run in clean worktree: 5919 pass + 0 fail. Net code regressions: zero. |
| cert-isolated tests | 81 pass / 0 fail / 12 files |
| Contract (Hurl) | Moved 2 files; defer new scenarios — wire behavior unchanged. |
| SDK drift | Deferred (run before tag); registry imports correctly resolve to new paths. |
| Observability | Deferred. |

## 7. Open follow-ups

- [ ] Write 3 supplemental Hurl scenarios (bulk-issue, verify-revoked, verify-with-hmac) against live API.
- [ ] Run live contract gate (`scripts/run-contract-tests.ts`) to confirm ≥130 pass + new.
- [ ] Run SDK drift check + observability audit.
- [ ] Tag `member-certificates-cutover` once final gates pass.
- [ ] Decide future: should `handlers/member/certificates/listCertificates.ts` (the now-recognized non-orphan) be removed when the documents test that imports it is itself refactored?
