# MODULE_SPEC: member/credentials

Sub-domain #3 of 9 in the `association:member` mega-module rebuild (Step 6 R3).

## 1. Purpose

Owns the verifiable-credential surface of an association: the templates that
define credential types, the digital credentials issued to members, the
professional licenses they hold, and the renewal alert system that nudges
licensees before expiration. Five concerns split across one TypeSpec file:

- **Credential Templates** — types (memberCard, certificate, badge,
  license) with validity period + design payload.
- **Digital Credentials** — issued instances of a template bound to a
  person, with credentialNumber, expiry, and revocation state.
- **Public Verification** — unauthenticated lookup + verify endpoints
  used by third parties (employers, regulators) checking credential
  authenticity.
- **Professional Licenses** — government / PRC-issued license records
  attached to a person, with status (active / expired / suspended /
  revoked / pending).
- **License Renewal Alerts** — system-generated reminders for upcoming
  license expiration; members acknowledge them.

## 2. Bounded Context

In scope:
- The six TypeSpec interfaces wired in `main.tsp` under
  `@tag("Member/Credentials")`:
  `CredentialTemplateManagement`, `DigitalCredentialManagement`,
  `CredentialVerificationService`, `CredentialLookupService`,
  `ProfessionalLicenseManagement`, `LicenseRenewalAlertService`.
- All routes under `/association/member/{credential-templates,
  credentials, credentials/issue, credentials/{id}/revoke,
  credentials/{id}/verify, credentials/public-verify,
  credentials/lookup/:credentialNumber, licenses, license-renewal-alerts}`
  — 21 operationIds total.
- The shared `credentials.repo` + `credentials.schema` (tables
  `credential_templates`, `digital_credentials`, `professional_licenses`,
  `license_renewal_alerts`, `credential_verification_log`).

Out of scope:
- `certificates/` module — separate surface (completion certificates,
  certificate PDF generation) with its own repos. Some certificate
  handlers are re-exported from `association:member/` legacy paths
  (`listMyCertificates`, `getCertificate`) — they read credentials data
  but are not part of this sub-domain.
- `documents/` module (m11) — generic file storage, no credential
  semantics.
- `trust-signals.ts` — utility at `association:member/utils/`, reads
  credential state to compute trust scores. Stays as a utility, not a
  handler.

Adjacent modules and the seams between them:

| Adjacent module | Seam |
|---|---|
| `person` | Subscribes to `person.deleted` and cascades-delete `digitalCredentials` for the person via `core/domain-event-consumers.ts`. |
| `certificates` | Re-exports several handlers via `association:member/{listMyCertificates,getCertificate}`. Reads credential templates + digital credentials. |
| `member/chapters`, `member/governance` | Officer status (governance) + chapter affiliation (chapters) feed into the trust signals derived from a member's credentials. |
| `core/auth` | Role-based auth on admin endpoints; public-verify + lookup endpoints intentionally bypass `requireAuth`. |

## 3. Handler Inventory

All handlers live at `services/api-ts/src/handlers/member/credentials/`.

| Handler file | Verb | Auth | Audit action | Notes |
|---|---|---|---|---|
| createCredentialTemplate.ts | POST /association/member/credential-templates | `association:admin` | `create credential-template` | Default `status=active`. |
| getCredentialTemplate.ts | GET .../{templateId} | `association:admin`, `association:member` | — | Read. |
| listCredentialTemplates.ts | GET /association/member/credential-templates | `association:admin`, `association:member` | — | Filter `organizationId`. Envelope: `{data: [...]}`. |
| updateCredentialTemplate.ts | PATCH .../{templateId} | `association:admin` | `update credential-template` | PATCH partial. |
| deleteCredentialTemplate.ts | DELETE .../{templateId} | `association:admin` | `delete credential-template` | 204. 409 if any credentials reference it. |
| issueDigitalCredential.ts | POST /association/member/credentials/issue | `association:admin` | `create digital-credential` | Note non-RESTful path (POST is at `/issue`, not the collection root). |
| getDigitalCredential.ts | GET /association/member/credentials/{credentialId} | `association:admin`, `association:member` | — | Read. |
| listDigitalCredentials.ts | GET /association/member/credentials | `association:admin` | — | Filter `personId`. Envelope: `{data: [...]}`. |
| updateDigitalCredential.ts | PATCH .../{credentialId} | `association:admin` | `update digital-credential` | PATCH partial. |
| deleteDigitalCredential.ts | DELETE .../{credentialId} | `association:admin` | `delete digital-credential` | 204. |
| revokeDigitalCredential.ts | POST .../{credentialId}/revoke | `association:admin` | `update digital-credential` | Body: `{reason?}`. 200 with revoked credential. |
| verifyDigitalCredentialAuthenticated.ts | POST .../{credentialId}/verify | `association:admin`, `association:member` | — | Authenticated full-trust verify. |
| verifyCredentialPublic.ts | POST /association/member/credentials/public-verify | (none) | — | Public endpoint. Body: `{token}`. Returns `{result, credential?, message}`. |
| lookupCredentialPublic.ts | GET /association/member/credentials/lookup/{credentialNumber} | (none) | — | Public endpoint. **Hand-wired in `app.ts:139`** because it predates the generated registry; same import path as other generated handlers. |
| createProfessionalLicense.ts | POST /association/member/licenses | `association:admin` | `create professional-license` | Default `status=pending` if omitted. |
| getProfessionalLicense.ts | GET .../{licenseId} | `association:admin`, `association:member` | — | Read. |
| listProfessionalLicenses.ts | GET /association/member/licenses | `association:admin`, `association:member` | — | Filter `personId`. Envelope: `{data: [...]}`. |
| updateProfessionalLicense.ts | PATCH .../{licenseId} | `association:admin` | `update professional-license` | PATCH partial. |
| deleteProfessionalLicense.ts | DELETE .../{licenseId} | `association:admin` | `delete professional-license` | 204. |
| listLicenseRenewalAlerts.ts | GET /association/member/license-renewal-alerts | `association:admin`, `association:member` | — | Filter `personId`. Envelope: `{data: [], pagination: {...}}`. |
| acknowledgeLicenseRenewalAlert.ts | POST .../{alertId}/acknowledge | `association:member` | `update license-renewal-alert` | Idempotent on already-acknowledged. |

21 handlers · 12 mutating ops carry `x-audit` · 0 inline
`requireOfficerTerm` / `requirePosition` calls (all role auth expressed
via `x-security-required-roles` extension on the operation).

## 4. TypeSpec source

`specs/api/src/association/member/credentials.tsp` — 21 operationIds
across 6 interfaces. Routed via `specs/api/src/main.tsp` under
`@tag("Member/Credentials")` on all 6 interfaces (R3 retag — was
`@tag("Association:Member")`).

## 5. Database schema

- `services/api-ts/src/handlers/association:member/repos/credentials.repo.ts`
- `services/api-ts/src/handlers/association:member/repos/credentials.schema.ts`

Schema stays under `association:member/repos/` on purpose. Inbound
importers depend on this path:

- `core/domain-event-consumers.ts` (+ test) — `digitalCredentials` table
  for `person.deleted` cascade
- `test-utils/preload-pristine.ts` — DB pristine snapshot
- `seed/layer-5-gap-fill.ts` — credential fixtures
- `handlers/__tests__/br-edge-cases.test.ts`
- `handlers/association:member/utils/trust-signals.ts`
- `handlers/association:member/listMyCertificates.ts`
- `handlers/association:member/getCertificate.test.ts`

Moving the schema would force a cascade rewrite for zero behavioral
gain.

Tables (per credentials.schema.ts):
- `credential_templates` — (id, organizationId, name, type, design?, validityPeriod?, status)
- `digital_credentials` — (id, organizationId, personId, templateId, membershipId?, credentialNumber, issuedAt, expiresAt?, status)
- `credential_verification_log` — (id, credentialId, verifiedAt, result, source)
- `professional_licenses` — (id, organizationId, personId, licenseType, licenseNumber, issuingAuthority, jurisdiction, issuedDate, expirationDate, status, documentRef?)
- `license_renewal_alerts` — (id, organizationId, licenseId, personId, daysUntilExpiry, acknowledgedAt?, createdAt)

## 6. Cross-module dependencies

Emits domain events:
- `credential.issued` (issueDigitalCredential) — notification consumer.
- `credential.revoked` (revokeDigitalCredential) — notification consumer.

Consumes events:
- `person.deleted` → consumer deletes digital credentials owned by the
  person. Cascade lives in `core/domain-event-consumers.ts`; this module
  owns no consumer code.

Calls into other modules:
- `issueDigitalCredential` reads `membership` table (via
  `MembershipRepository`) to optionally bind the credential to a current
  membership.
- `listProfessionalLicenses` / get / revoke draw on
  `credits.repo` (`ProfessionalLicenseRepository`,
  `LicenseRenewalAlertRepository` live in `credits.repo.ts` for
  historical reasons — same `association:member/repos/` path).

## 7. Test coverage status

- **Unit tests**: 2 files moved colocated to
  `services/api-ts/src/handlers/member/credentials/`:
  - `credentials.test.ts` (cross-cutting template + digital credential
    integration tests)
  - `lookupCredentialPublic.test.ts` (public lookup happy path + missing)

  Coverage is thin (2 files for 21 handlers). Per-handler unit suites
  are a follow-up.

- **Contract scenarios**: 6 Hurl files in
  `specs/api/tests/contract/member/credentials/`:
  - `credential-template-crud.hurl` (create → get → list → update → delete → 404)
  - `digital-credential-lifecycle.hurl` (template + issue → get → list → revoke → delete)
  - `professional-license-crud.hurl` (create → get → list → update → delete)
  - `credential-verify-public.hurl` (public lookup happy + public-verify
    notFound sentinel)
  - `license-renewal-alerts.hurl` (list shape + acknowledge bogus → 404)
  - `credentials-rbac.hurl` (401 unauth + 403 non-admin edges)

- **E2E**: deferred to broader credentials UI work
  (admin-tier endpoints surfaced through `apps/admin`).

## 8. Hand-wired routes

- `lookupCredentialPublic` — hand-wired in `app.ts` at
  `GET /association/member/credentials/lookup/:credentialNumber`. Per
  R3.5 cutover, the import path was rewritten from
  `@/handlers/association:member/lookupCredentialPublic` to
  `@/handlers/member/credentials/lookupCredentialPublic`. The route
  itself remains hand-wired (public, unauthenticated; predates the
  generated registry).

All other 20 ops go through the generated route registry.

## 9. Known gotchas

- **`issueDigitalCredential` POST is at `/credentials/issue`**, not at
  the collection root. Calling `POST /association/member/credentials`
  returns 405. The verb is "issue", not "create", per the domain.
- **`lookupCredentialPublic` is hand-wired** in `app.ts`. Touching that
  import path during cutover requires updating both the registry import
  (auto-generated) and the app.ts import (manual). The generator does
  not own the app.ts import; missing this step yields a typecheck error.
- **Public endpoints bypass auth** (`/credentials/public-verify` and
  `/credentials/lookup/:credentialNumber`). They must not leak PII —
  enforced in handler by projecting only public fields onto the response.
- **DELETE returns 204** for templates, digital credentials, and licenses
  (asymmetric with `member/governance` where positions/officer-terms
  return 200). Contract tests must assert 204 here.
- **`revokeDigitalCredential` does NOT delete** — it sets status. A
  separate DELETE is required to fully remove the row.
- **`credential_verification_log` is an append-only audit table** for
  verify-attempts; it is not exposed via API.
- **Schema path asymmetry**: handlers live at
  `handlers/member/credentials/` but the schema lives at
  `handlers/association:member/repos/`. Do not move the schema during
  R4-R9 without first refactoring all inbound importers (see §5).
- **`ProfessionalLicenseRepository` + `LicenseRenewalAlertRepository`
  live in `credits.repo.ts`** at `association:member/repos/`, not in
  `credentials.repo.ts`. Historical: license tracking shares state with
  CPD credit tracking. R6 credits cutover will need to coordinate.

## 10. AI extension checklist

To add a new endpoint to this module:

1. Add the operation to `specs/api/src/association/member/credentials.tsp`
   with `@operationId(...)`, the verb, `@useAuth(bearerAuth)`, and
   `@extension("x-security-required-roles", ...)`. Add
   `@extension("x-audit", #{ action, resourceType })` for any mutation.
2. Wire the interface in `specs/api/src/main.tsp` under
   `@tag("Member/Credentials")`.
3. `cd specs/api && bun run build` — regenerates OpenAPI.
4. `cd services/api-ts && bun run generate` — emits handler stub at
   `services/api-ts/src/handlers/member/credentials/`.
5. Implement the handler using `CredentialTemplateRepository` /
   `DigitalCredentialRepository` from
   `@/handlers/association:member/repos/credentials.repo`. For licenses
   use `ProfessionalLicenseRepository` /
   `LicenseRenewalAlertRepository` from
   `@/handlers/association:member/repos/credits.repo`.
6. Add unit tests in `member/credentials/*.test.ts`.
7. Add at least one contract scenario in
   `specs/api/tests/contract/member/credentials/`.
8. Run: `bun run check:sdk-compat` — must show 0 op drift after baseline
   is unfrozen (post-Step-6 close).

Forbidden:
- Editing `services/api-ts/src/generated/**`.
- Adding new hand-wired routes in `services/api-ts/src/app.ts` for
  credentials operations (the existing `lookupCredentialPublic` import
  is grandfathered — no new entries).
- Moving `repos/credentials.schema.ts` without first updating the
  consumer list in §5.
- Changing event names or payload shapes for `credential.*` events
  without touching `core/domain-event-consumers.ts` in the same commit.
- Returning PII from `public-verify` or `lookup` endpoints beyond the
  current projected fields.
