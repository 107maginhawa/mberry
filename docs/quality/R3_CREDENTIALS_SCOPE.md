# R3 Credentials — Scope Pass (R3.1)

Branch: `feature/member-rebuild` @ `280078da`
Generated: 2026-06-07

## Contract surface — `specs/api/src/association/member/credentials.tsp`

21 operationIds across 6 interfaces (all preserved verbatim per `SDK_BASELINE_OPS.json` freeze):

| Interface | OperationId | HTTP |
|---|---|---|
| CredentialTemplateManagement | createCredentialTemplate | POST /association/member/credential-templates |
| CredentialTemplateManagement | getCredentialTemplate | GET .../{templateId} |
| CredentialTemplateManagement | listCredentialTemplates | GET /association/member/credential-templates |
| CredentialTemplateManagement | updateCredentialTemplate | PATCH .../{templateId} |
| CredentialTemplateManagement | deleteCredentialTemplate | DELETE .../{templateId} |
| DigitalCredentialManagement | issueDigitalCredential | POST /association/member/credentials |
| DigitalCredentialManagement | getDigitalCredential | GET /association/member/credentials/{credentialId} |
| DigitalCredentialManagement | listDigitalCredentials | GET /association/member/credentials |
| DigitalCredentialManagement | updateDigitalCredential | PATCH .../{credentialId} |
| DigitalCredentialManagement | deleteDigitalCredential | DELETE .../{credentialId} |
| DigitalCredentialManagement | revokeDigitalCredential | POST .../{credentialId}/revoke |
| DigitalCredentialManagement | verifyDigitalCredentialAuthenticated | POST .../{credentialId}/verify |
| CredentialVerificationService | verifyCredentialPublic | POST /association/member/credentials/public-verify |
| CredentialLookupService | lookupCredentialPublic | POST /association/member/credentials/lookup |
| ProfessionalLicenseManagement | createProfessionalLicense | POST /association/member/licenses |
| ProfessionalLicenseManagement | getProfessionalLicense | GET .../{licenseId} |
| ProfessionalLicenseManagement | listProfessionalLicenses | GET /association/member/licenses |
| ProfessionalLicenseManagement | updateProfessionalLicense | PATCH .../{licenseId} |
| ProfessionalLicenseManagement | deleteProfessionalLicense | DELETE .../{licenseId} |
| LicenseRenewalAlertService | listLicenseRenewalAlerts | GET /association/member/license-renewal-alerts |
| LicenseRenewalAlertService | acknowledgeLicenseRenewalAlert | POST .../{alertId}/acknowledge |

## Wipe-set (handler .ts to delete in R3.3)

21 handler files under `services/api-ts/src/handlers/association:member/`:

```
createCredentialTemplate.ts, getCredentialTemplate.ts, listCredentialTemplates.ts, updateCredentialTemplate.ts, deleteCredentialTemplate.ts
issueDigitalCredential.ts, getDigitalCredential.ts, listDigitalCredentials.ts, updateDigitalCredential.ts, deleteDigitalCredential.ts, revokeDigitalCredential.ts
verifyDigitalCredentialAuthenticated.ts
verifyCredentialPublic.ts
lookupCredentialPublic.ts
createProfessionalLicense.ts, getProfessionalLicense.ts, listProfessionalLicenses.ts, updateProfessionalLicense.ts, deleteProfessionalLicense.ts
listLicenseRenewalAlerts.ts, acknowledgeLicenseRenewalAlert.ts
```

## Test files to move colocated in R3.5

2 `.test.ts` files to move to `handlers/member/credentials/`:

```
credentials.test.ts
lookupCredentialPublic.test.ts
```

## Keep-set (do NOT delete; do NOT move)

- `repos/credentials.repo.ts` + `repos/credentials.schema.ts` — stable path. Multiple inbound importers (consumers, seed, test fixtures, certificates handlers re-exported via `association:member/`, `utils/trust-signals.ts`).
- `handlers/association:member/utils/trust-signals.ts` — utility, not a handler; stays.
- All other `association:member/` handlers (chapters/governance moved; directory/officers/credits/dues/membership/certificates re-exports still here).
- `handlers/certificates/` — separate module, different repos. Out of scope.
- `handlers/documents/` — m11 documents module. Out of scope.

## Out-of-scope handlers in association:member/ that touch credentials

```
services/api-ts/src/handlers/association:member/listMyCertificates.ts
services/api-ts/src/handlers/association:member/getCertificate.test.ts
```

These belong to the certificates surface (re-exported per CLAUDE.md certificates note) and read from `repos/credentials.schema`. Path stability of credentials repo lets them continue to resolve. Leave alone.

## Consumers of credentials code (post-move audit checklist)

Files importing `@/handlers/association:member/repos/credentials.*`:

- `core/domain-event-consumers.ts` (+ test) — `person.deleted` cascade deletes `digitalCredentials` for the person. **MUST NOT change event names or schema imports.**
- `test-utils/preload-pristine.ts` — DB pristine snapshot.
- `seed/layer-5-gap-fill.ts` — credential fixtures.
- `handlers/__tests__/br-edge-cases.test.ts` — cross-cutting BR tests.
- `handlers/association:member/utils/trust-signals.ts` — trust score derived from credential state.
- `handlers/association:member/listMyCertificates.ts` — certificates re-export reads credential templates.
- `handlers/association:member/getCertificate.test.ts` — same.

Repos stay at `association:member/repos/`. New handlers at `handlers/member/credentials/<x>.ts` must use absolute import `@/handlers/association:member/repos/credentials.repo` (and `.schema`).

## Retag targets in main.tsp

6 lines change `@tag("Association:Member")` → `@tag("Member/Credentials")`:

| Line | Interface alias | Source interface |
|---|---|---|
| 423 | `AssocCredentialTemplateManagement` | `Credentials.CredentialTemplateManagement` |
| 427 | `AssocDigitalCredentialManagement` | `Credentials.DigitalCredentialManagement` |
| 431 | `AssocCredentialVerificationService` | `Credentials.CredentialVerificationService` |
| 435 | `AssocCredentialLookupService` | `Credentials.CredentialLookupService` |
| 439 | `AssocProfessionalLicenseManagement` | `Credentials.ProfessionalLicenseManagement` |
| 443 | `AssocLicenseRenewalAlertService` | `Credentials.LicenseRenewalAlertService` |

(Exact line numbers may shift ±1 — verify before editing.)

## New module target

```
services/api-ts/src/handlers/member/credentials/
  createCredentialTemplate.ts (+20 more)
  credentials.test.ts, lookupCredentialPublic.test.ts
```

## Risks / unknowns

- `verifyCredentialPublic` and `lookupCredentialPublic` are PUBLIC (no auth) endpoints — verify CORS / route registration order in `app.ts` not affected by tag change.
- `trust-signals.ts` is utils-tier and stays at `association:member/utils/`. Verify new handlers can still import it (path unchanged from new location).
- `listMyCertificates.ts` cross-reads credentials — verify import path of `getCertificate.test.ts` to handlers in member/credentials/ if it imports any.
- 2 test files cover 21 handlers — coverage is thin. Per-handler unit suites already noted as follow-up.

## Estimated handler count vs plan

Plan §R7 estimated "credentials (28 files, ~7 days)". Actual scope is **21 handlers + 2 tests**. User reordered R3 = credentials. ~5–6 days realistic.
