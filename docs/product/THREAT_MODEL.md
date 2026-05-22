<!-- oli:artifact threat-model v1.0 generated:2026-05-21 source:MASTER_PRD.md,cross-cutting.md -->
# Threat Model: Memberry

> Security threat analysis derived from PRD audit. Triggered by: Security=YES, Regulated=YES.

## Threat Landscape

| Factor | Value | Impact |
|--------|-------|--------|
| Platform type | Multi-tenant SaaS | Tenant isolation is critical |
| Data sensitivity | PII, financial records, license numbers | DPA 2012 compliance required |
| User base | Healthcare professionals (PH) | High-value identity targets |
| Payment processing | Stripe Connect per org | PCI-DSS delegation, credential isolation |
| Admin capabilities | Read-only impersonation, feature flags | Privilege escalation vector |

## STRIDE Analysis

### Spoofing

| Threat | Likelihood | Impact | Mitigation (PRD/Code) | Status |
|--------|-----------|--------|----------------------|--------|
| Credential stuffing | High | High | Better-Auth with account lockout (BR-26), 2FA for platform admins | Mitigated |
| Session hijacking | Medium | High | Session management via Better-Auth, session limit enforcement | Mitigated |
| Impersonation abuse | Medium | Critical | Read-only impersonation only (BR-10), audit-logged | Mitigated |
| Officer role assumption | Medium | High | Position-based RBAC at route level (v1.1.0) | Mitigated |

### Tampering

| Threat | Likelihood | Impact | Mitigation (PRD/Code) | Status |
|--------|-----------|--------|----------------------|--------|
| Payment record manipulation | Medium | Critical | Optimistic locking, idempotency keys, audit trail | Mitigated |
| SVG/file upload XSS | Medium | High | SVG sanitization (BR-31) | Mitigated |
| Fund allocation tampering | Low | High | Percentage validation, last-fund remainder absorption (BR-05) | Mitigated |
| Membership status falsification | Low | Medium | Status computed from dues_expiry_date (BR-01), not mutable | Mitigated |

### Repudiation

| Threat | Likelihood | Impact | Mitigation (PRD/Code) | Status |
|--------|-----------|--------|----------------------|--------|
| Officer denies action | Medium | Medium | Audit module logs all officer actions with correlation IDs | Mitigated |
| Payment dispute | Medium | High | Payment records with fund allocation audit trail (BR-32, 7-year retention) | Mitigated |
| Data correction denial | Low | Medium | Officer corrections logged in audit trail per DPA 2012 | Mitigated |

### Information Disclosure

| Threat | Likelihood | Impact | Mitigation (PRD/Code) | Status |
|--------|-----------|--------|----------------------|--------|
| Cross-tenant data leakage | Medium | Critical | Organization-scoped queries, association_id isolation | **Verify** |
| PII exposure in logs | Medium | High | PII never logged in plaintext (PRD S7) | Mitigated |
| Payment credential exposure | Medium | Critical | Encrypted at rest, never logged (BR-30) | Mitigated |
| Member directory over-exposure | Medium | Medium | Privacy controls in member profile (M02) | Mitigated |

### Denial of Service

| Threat | Likelihood | Impact | Mitigation (PRD/Code) | Status |
|--------|-----------|--------|----------------------|--------|
| Convention spike (500 concurrent) | High | Medium | 500 simultaneous user NFR target | **Gap: no rate limiting spec** |
| PDF generation abuse | Medium | Medium | 3-second PDF generation NFR | **Gap: no rate limiting per user** |
| Notification spam | Low | Medium | Notification service with scheduled processing | Partial |

### Elevation of Privilege

| Threat | Likelihood | Impact | Mitigation (PRD/Code) | Status |
|--------|-----------|--------|----------------------|--------|
| Member → Officer escalation | Medium | High | Position assignment by president only, RBAC enforcement | Mitigated |
| Officer → Platform Admin escalation | Low | Critical | Separate role hierarchy, platform_admin table with admin_role enum | Mitigated |
| Cross-org privilege bleed | Medium | High | Organization-scoped roles, independent membership per org | **Verify** |

## Top Security Gaps

| # | Gap | Severity | Recommendation |
|---|-----|----------|---------------|
| 1 | No rate limiting specification | P2 | Define rate limits per endpoint category (auth, API, file upload, PDF generation) |
| 2 | Cross-tenant isolation not verified | P1 | Add tenant isolation tests: every query must include org/association scope |
| 3 | No error contract for security errors | P0 | Define error response shape that doesn't leak internal state or stack traces |
| 4 | Session expiry UX undefined | P2 | Define behavior: silent re-auth, redirect, draft preservation |
| 5 | No CSP/security headers spec | P2 | Define Content-Security-Policy, X-Frame-Options, HSTS for all apps |

## Attack Surface Summary

| Surface | Exposure | Key Controls |
|---------|----------|-------------|
| Auth endpoints | Public | Better-Auth, account lockout, 2FA |
| API (authenticated) | Authenticated users | RBAC, position-based access, org scoping |
| File upload | Authenticated users | SVG sanitization, S3/MinIO isolation |
| Payment endpoints | Officers only | Idempotency, optimistic locking, credential encryption |
| WebSocket (comms) | Authenticated users | Session validation per connection |
| Platform admin | Platform admins only | 2FA required, read-only impersonation, audit logging |
| Public pages | Anonymous | Org public profile only, no PII exposed |

---

> **Rules:**
> - Update this threat model when new modules are added or attack surface changes.
> - Cross-tenant isolation must be verified with integration tests for every new handler.
> - Security gaps with P0/P1 severity should be resolved before production deployment.
