<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: PRD_AUDIT_REPORT.md, ARCHITECTURE.md, DOMAIN_MODEL.md -->
# Audit Contracts

Audit trail requirements for the Memberry platform. Activated because project is regulated (Philippines Data Privacy Act 2012, BIR 7-year financial retention).

---

## 1. Auditable Event Catalog

### 1.1 Authentication Events

| Event Type | Data Captured | Retention |
|------------|--------------|-----------|
| `auth.sign-in` | personId, email, IP, userAgent, timestamp, success/fail | 7 years |
| `auth.sign-out` | personId, sessionId, timestamp | 1 year |
| `auth.password-changed` | personId, IP, timestamp | 7 years |
| `auth.2fa-enabled` | personId, method, timestamp | 7 years |
| `auth.2fa-disabled` | personId, IP, timestamp | 7 years |
| `auth.session-revoked` | personId, revokedBy, reason, timestamp | 7 years |
| `auth.account-locked` | personId, reason, failedAttempts, timestamp | 7 years |
| `auth.impersonation-started` | adminId, targetPersonId, IP, timestamp | 7 years |
| `auth.impersonation-ended` | adminId, targetPersonId, duration, timestamp | 7 years |

### 1.2 Data Access Events

| Event Type | Data Captured | Retention |
|------------|--------------|-----------|
| `data.pii-accessed` | personId, accessedBy, fields[], IP, timestamp | 7 years |
| `data.pii-exported` | personId, exportedBy, format, fields[], timestamp | 7 years |
| `data.pii-modified` | personId, modifiedBy, before (redacted), after (redacted), timestamp | 7 years |
| `data.pii-deleted` | personId, deletedBy, reason, timestamp | 7 years |
| `data.bulk-export` | exportedBy, recordCount, format, filters, timestamp | 7 years |
| `data.document-accessed` | documentId, accessedBy, IP, timestamp | 3 years |

### 1.3 Financial Events

| Event Type | Data Captured | Retention |
|------------|--------------|-----------|
| `financial.payment-recorded` | paymentId, personId, amount, method, recordedBy, timestamp | 7 years (BIR) |
| `financial.payment-refunded` | paymentId, refundAmount, reason, processedBy, timestamp | 7 years (BIR) |
| `financial.invoice-generated` | invoiceId, personId, amount, dueDate, timestamp | 7 years (BIR) |
| `financial.invoice-voided` | invoiceId, voidedBy, reason, timestamp | 7 years (BIR) |
| `financial.fund-allocation-changed` | orgId, changedBy, before, after, timestamp | 7 years (BIR) |
| `financial.billing-config-changed` | orgId, changedBy, before, after, timestamp | 7 years (BIR) |

### 1.4 Membership Events

| Event Type | Data Captured | Retention |
|------------|--------------|-----------|
| `membership.status-changed` | membershipId, personId, oldStatus, newStatus, changedBy, reason, timestamp | 7 years |
| `membership.application-submitted` | personId, orgId, timestamp | 3 years |
| `membership.application-approved` | personId, orgId, approvedBy, timestamp | 7 years |
| `membership.application-rejected` | personId, orgId, rejectedBy, reason, timestamp | 3 years |
| `membership.transferred` | personId, fromOrgId, toOrgId, approvedBy, timestamp | 7 years |
| `membership.bulk-imported` | orgId, importedBy, recordCount, successCount, failCount, timestamp | 3 years |

### 1.5 Governance Events

| Event Type | Data Captured | Retention |
|------------|--------------|-----------|
| `governance.election-created` | electionId, orgId, createdBy, positions[], timestamp | 7 years |
| `governance.vote-cast` | electionId, voterId (hashed), timestamp | 7 years (anonymous) |
| `governance.results-published` | electionId, publishedBy, winners[], timestamp | 7 years |
| `governance.officer-assigned` | personId, position, orgId, assignedBy, timestamp | 7 years |
| `governance.officer-removed` | personId, position, orgId, removedBy, reason, timestamp | 7 years |

### 1.6 Administrative Events

| Event Type | Data Captured | Retention |
|------------|--------------|-----------|
| `admin.role-changed` | personId, oldRole, newRole, changedBy, timestamp | 7 years |
| `admin.org-created` | orgId, orgName, createdBy, timestamp | 7 years |
| `admin.org-settings-changed` | orgId, changedBy, setting, before, after, timestamp | 3 years |
| `admin.feature-flag-toggled` | flagName, enabled, changedBy, scope, timestamp | 3 years |
| `admin.platform-config-changed` | setting, changedBy, before, after, timestamp | 7 years |

### 1.7 Content Events

| Event Type | Data Captured | Retention |
|------------|--------------|-----------|
| `content.document-uploaded` | documentId, orgId, uploadedBy, filename, size, timestamp | 3 years |
| `content.document-deleted` | documentId, deletedBy, reason, timestamp | 7 years |
| `content.certificate-generated` | certificateId, personId, trainingId, generatedBy, timestamp | 7 years |
| `content.credential-verified` | token, valid, verifierIP, timestamp | 1 year |

---

## 2. Audit Log Retention Policy

| Category | Retention Period | Rationale |
|----------|-----------------|-----------|
| Authentication & Security | 7 years | DPA 2012 compliance |
| Financial transactions | 7 years | BIR requirement |
| PII access & modification | 7 years | DPA 2012 compliance |
| Governance & Elections | 7 years | Organizational transparency |
| Membership changes | 7 years | Legal record of membership |
| Administrative actions | 3-7 years | Depends on sensitivity |
| Content & Document access | 1-3 years | Operational monitoring |

### Retention Implementation

- `audit.retention` pg-boss job runs daily at 3 AM
- Archives logs older than retention period
- Purges archived logs after 7 years (hard limit)
- Retention periods are configurable per `auditEventType` in platform admin

---

## 3. Access Controls

### Who Can Read Audit Logs

| Role | Access Level | Scope |
|------|-------------|-------|
| Platform Super Admin | Full read | All associations, all events |
| Platform Admin | Full read | Assigned association scope |
| Organization President | Limited read | Own org, non-financial events |
| Organization Treasurer | Limited read | Own org, financial events only |
| Member | Self-only | Own PII access log |

### Who Can Export Audit Logs

| Role | Export Formats | Approval Required |
|------|---------------|-------------------|
| Platform Super Admin | CSV, JSON | No |
| Platform Admin | CSV, JSON | No |
| Organization President | CSV (filtered) | Yes — platform admin approval |

### Who Can Purge Audit Logs

| Action | Who | Approval |
|--------|-----|----------|
| Scheduled retention purge | System (automated) | N/A — runs per retention policy |
| Manual purge | Platform Super Admin ONLY | Requires 2FA confirmation + reason |
| Emergency purge | Not supported | Contact platform administrator |

---

## 4. Tamper-Evidence Requirements

### Implementation

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| Append-only storage | `audit_log_entry` table with no UPDATE/DELETE permissions for app role | Required |
| Hash chaining | Each entry includes `previousHash` (SHA-256 of prior entry) | Planned |
| Timestamp integrity | PostgreSQL `timestamptz` with `now()` default, not client-supplied | Required |
| External verification | Periodic hash chain verification job | Planned |

### Audit Log Entry Schema

```typescript
{
  id: uuid,                    // Primary key
  eventType: string,           // e.g., "auth.sign-in"
  category: AuditCategory,     // "authentication" | "data_access" | "financial" | ...
  action: AuditAction,         // "create" | "read" | "update" | "delete" | "export"
  actorId: uuid,               // Person who performed the action
  actorRole: string,           // Role at time of action
  targetEntityType: string,    // e.g., "person", "payment", "membership"
  targetEntityId: uuid,        // ID of affected entity
  organizationId: uuid,        // Tenant scope
  associationId: uuid,         // Top-level tenant
  ipAddress: string,           // Client IP (masked in logs)
  userAgent: string,           // Client user-agent
  beforeState: jsonb | null,   // Previous state (redacted PII)
  afterState: jsonb | null,    // New state (redacted PII)
  metadata: jsonb,             // Additional context
  correlationId: string,       // Request correlation ID
  previousHash: string | null, // SHA-256 of previous entry (hash chain)
  createdAt: timestamptz       // Server-generated timestamp
}
```

---

## 5. Compliance Mapping

### DPA 2012 (Philippines Data Privacy Act)

| DPA Requirement | Audit Events | Implementation |
|----------------|--------------|----------------|
| Lawful processing | `data.pii-accessed`, `data.pii-modified` | Log all PII access with purpose |
| Consent records | `membership.application-submitted` | Consent timestamp in membership record |
| Data subject rights (access) | `data.pii-accessed` | Member can view own access log |
| Data subject rights (erasure) | `data.pii-deleted`, `PersonAnonymized` | 30-day grace period, then anonymization |
| Breach notification | `security` notification type | Platform admin alert within 72 hours |
| Retention limits | All audit events | Automated purge per retention policy |
| Cross-border transfer | N/A | Data stays in PH region (infrastructure decision) |

### BIR (Bureau of Internal Revenue)

| BIR Requirement | Audit Events | Implementation |
|----------------|--------------|----------------|
| 7-year financial record retention | `financial.*` events | 7-year retention on all financial audit logs |
| Receipt/invoice records | `financial.payment-recorded`, `financial.invoice-generated` | Immutable payment and invoice records |
| Audit trail for tax-relevant transactions | `financial.fund-allocation-changed` | Before/after state capture |

---

## 6. Audit API Endpoints

Audit log access is exposed through the M03 Platform Admin module and the Audit module.

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/audit/logs` | GET | Platform Admin | List audit logs with filtering |
| `/audit/logs/:id` | GET | Platform Admin | Get single audit log entry |
| `/audit/logs/export` | POST | Platform Admin | Export filtered audit logs (CSV/JSON) |
| `/audit/logs/my-access` | GET | Authenticated | Member views own PII access log |
| `/audit/integrity/verify` | POST | Platform Super Admin | Verify hash chain integrity |

See M03 Platform Admin API_CONTRACTS.md for full endpoint definitions.

---

## 7. Anonymization & Audit Retention

After 30-day account deletion grace period, PII is anonymized in the person table (`firstName`, `lastName`, `email` replaced with hashed pseudonyms).

Audit logs retain the original `personId` reference but the referenced person record is anonymized.

For compliance investigations requiring de-anonymization, a separate pseudonym mapping table is maintained:

| Aspect | Detail |
|--------|--------|
| Access | Accessible only to designated compliance officers (platform super-admin + explicit grant) |
| Encryption | Encrypted at rest with a separate key from the main database |
| Audit logging | All access to this table is itself audit-logged |
| Retention | Same as audit logs (7 years per regulatory requirement) |

This design satisfies DPA 2012 erasure requirements while preserving the ability to fulfill regulatory or legal investigation requests within the retention window.
