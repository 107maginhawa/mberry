---
name: navigation-map
module: m11-documents-credentials
route-count: 10
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.717Z
status: INFERRED — needs human review
---

# Navigation Map — m11-documents-credentials

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (10)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/verify/$certificateNumber` | `/verify/$certificateNumber` | VerifyCertificatePage | memberry | — | certificateNumber | — |
| `/verify/$credentialNumber` | `/verify/$credentialNumber` | VerifyCredentialPage | memberry | — | credentialNumber | — |
| `/verify/$token` | `/verify/$token` | PublicVerification | memberry | — | token | — |
| `/_authenticated/my/certificates/$certificateId` | `/my/certificates/$certificateId` | CertificateDetail | memberry | yes | certificateId | — |
| `/_authenticated/my/certificates/` | `/my/certificates/` | MyCertificates | memberry | yes | — | — |
| `/_authenticated/org/$orgSlug/documents/$documentId` | `/org/$orgSlug/documents/$documentId` | MemberDocumentDetailPage | memberry | yes | orgSlug, documentId | — |
| `/_authenticated/org/$orgSlug/documents/` | `/org/$orgSlug/documents/` | MemberDocumentsPage | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/certificates` | `/org/$orgSlug/officer/certificates` | OfficerCertificates | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/documents/$documentId` | `/org/$orgSlug/officer/documents/$documentId` | DocumentDetail | memberry | yes | orgSlug, documentId | — |
| `/_authenticated/org/$orgSlug/officer/documents/` | `/org/$orgSlug/officer/documents/` | OfficerDocuments | memberry | yes | orgSlug | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
