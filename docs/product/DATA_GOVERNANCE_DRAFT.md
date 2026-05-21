<!-- oli:artifact data-governance v1.0 generated:2026-05-21 updated:2026-05-21 source:MASTER_PRD.md,cross-cutting.md -->
# Data Governance: Memberry

> Data classification, retention, and deletion policies derived from PRD audit. Finalized 2026-05-21 — all open items resolved or deferred.

## Regulatory Context

| Jurisdiction | Regulation | Applicability |
|-------------|-----------|---------------|
| Philippines | Data Privacy Act of 2012 (DPA 2012) | Primary — all PII handling |
| Philippines | BIR Revenue Regulations | Financial record retention (7 years) |
| EU | GDPR | Deferred to Phase 2 (global expansion) |
| Thailand | PDPA | Deferred to Phase 2 |
| Singapore | PDPA | Deferred to Phase 2 |

## Data Classification

| Entity | Field Category | Classification | PII? | Retention | Source |
|--------|---------------|---------------|------|-----------|--------|
| Person | name, email, phone | Confidential | Yes | Account lifetime + 30-day deletion grace | PRD S7, DPA 2012 |
| Person | licenseNumber | Restricted | Yes | Account lifetime | PRD S5 BR-22 |
| Person | profilePhoto | Confidential | Yes | Account lifetime | M02 |
| Member | membershipStatus | Internal | No | Account lifetime | BR-01 |
| Member | duesExpiryDate | Internal | No | 7 years (financial) | BR-32 |
| Dues/Payment | amount, fundAllocations | Confidential | No | 7 years (BIR) | BR-32 |
| Dues/Payment | paymentGatewayCredentials | Restricted | No | Encrypted at rest, never logged | BR-30 |
| Organization | orgName, orgType | Internal | No | Association lifetime | M04 |
| Association | name, locale, currency | Internal | No | Platform lifetime | M03 |
| Event | title, date, location | Internal | No | 2 years post-event | M08 |
| Training | courseName, creditValue | Internal | No | 7 years (CPD compliance) | M09, M10 |
| Certificate | certificateData | Confidential | Yes | 7 years (CPD compliance) | M11 |
| AuditLog | action, actor, resource | Internal | No | 1 year active, 6 years archive | Cross-cutting |
| Session | sessionToken | Restricted | No | 24 hours post-expiry | Better-Auth |
| Notification | content, recipient | Confidential | Yes (recipient) | 90 days | M07 |

### Classification Legend

- **Public** — No access restriction (org public page info only)
- **Internal** — Authenticated users only
- **Confidential** — Role-restricted access, audit-logged
- **Restricted** — Encrypted at rest, audit-logged access, minimal retention

## Retention Policies

| Data Category | Default Retention | Legal Basis | Deletion Strategy |
|--------------|-------------------|-------------|-------------------|
| User PII (name, email, phone, license) | Account lifetime + 30-day grace | DPA 2012 Art. 11-12 | Soft delete → 30-day grace → anonymize |
| Financial records (payments, invoices, receipts) | 7 years | BIR Revenue Regulations (BR-32) | Archive after 2 years → retain 7 years → purge |
| Audit logs | 1 year active + 6 years archive | DPA 2012, compliance | Rotate monthly → archive → purge at 7 years |
| Session data | 24 hours post-expiry | Operational | Auto-purge |
| Notification content | 90 days | Operational | Auto-purge |
| Event/training records | 7 years (CPD compliance) | Professional regulation | Archive after event completion |
| File uploads (S3/MinIO) | Account lifetime | Operational | Cascade with account deletion |
| Certificate records | 7 years | CPD compliance | Archive |

## Deletion Strategy

| Entity | Soft Delete? | Hard Delete Trigger | Cascade Behavior | Anonymization |
|--------|-------------|--------------------|-----------------|-|
| Person | Yes | 30 days post-account-deletion | Anonymize PII, retain financial records with anonymized IDs | name → "Deleted User", email → hash, phone → null, license → null |
| Member (per-org) | Yes | Account deletion or org removal | Status set to REMOVED, historical records retained | Linked to anonymized Person |
| Payment | No (immutable) | Never (7-year retention) | N/A | Payer identity anonymized when Person is deleted |
| Event Registration | Yes | Account deletion | Attendance records retained (anonymized) | Participant identity anonymized |
| Training Record | Yes | Account deletion | Credit records retained (anonymized) | Learner identity anonymized |
| Certificate | Yes | Account deletion | PDF retained with anonymized identity | Name on certificate anonymized |
| Organization | Yes | Association admin action | Members notified, data exported | Org name retained, member data anonymized |
| Notification | Yes | Auto-purge at 90 days | N/A | Recipient anonymized |

## Right to Erasure (DPA 2012)

- **Erasure request flow:** Member submits deletion request via account settings → 30-day deactivation grace period → automated anonymization after grace period
- **Data export format:** JSON and CSV (profile, payments, credits, membership history)
- **Timeline:** 30-day grace period, then anonymization within 24 hours
- **Exceptions:** Financial records (7-year BIR retention with anonymized identifiers), audit logs (compliance retention)
- **Breach notification:** NPC notified within 72 hours. Affected members notified with plain-language explanation.

## Data Processing Agreement

Each organization has a DPA with the platform acting as data processor. Standard DPA template provided during org onboarding (per PRD S7 / cross-cutting docs).

## Open Items — Resolved

| # | Item | Status | Resolution |
|---|------|--------|-----------|
| 1 | Per-field encryption inventory | **RESOLVED** | See API_CONVENTIONS.md section 23 (Data Protection & PII Handling) — deterministic encryption for searchable PII, randomized for non-searchable |
| 2 | Cross-org data visibility rules | **RESOLVED** | See API_CONVENTIONS.md section 19 (Multi-Tenancy) — org-scoped isolation with associationId for national-level cross-org reads |
| 3 | Data export schema | **RESOLVED** | See M02 MODULE_SPEC WF-014 + API_CONTRACTS (POST/GET /my/data-export) — JSON/CSV export per DPA 2012 |
| 4 | Consent management schema | **DEFERRED** | Planned but not yet implemented in DB schema. See CLAUDE.md: "Consent management planned but not yet implemented." Deferred to future phase. |
| 5 | Anonymization implementation | **RESOLVED** | See AUDIT_CONTRACTS.md section 7 (Anonymization & Audit Retention) — pseudonym mapping table for compliance, 30-day grace, PII → hash/null |

---

> **Rules:**
> - Every PII field in DOMAIN_GLOSSARY must appear in the classification table.
> - Retention policies must align with BIR and DPA 2012 requirements.
