# Cross-Cutting Concerns

This document defines platform-wide standards that apply across all modules and phases.

---

## 1. Localization Framework

### Language Support

| Phase | Languages | Scope |
|-------|-----------|-------|
| Phase 1 | English (en-PH) -- primary | Full platform UI, content, and communications |
| Phase 1 | Filipino/Tagalog (fil-PH) | UI strings only. User-generated content remains in its original language. |
| Phase 2 | Cebuano (ceb-PH) | UI strings. Added as regional chapters grow. |
| Phase 2 | SEA languages | Expanded as chapters grow in Singapore, Thailand, etc. |

- **Language selector:** Available in user settings and in the footer of all public pages.
- **Fallback:** If a string is not translated for the user's selected language, the English (en-PH) version is displayed.
- **Translation management:** Strings are externalized into locale files. No hardcoded user-facing text in code.

### Multi-Currency

- Each association configures its own currency during setup.
- All monetary amounts are displayed in the association's configured currency with locale-appropriate formatting.
- Currency codes are stored in ISO 4217 format.

| Country | Currency | Format Example |
|---------|----------|---------------|
| Philippines | PHP | ₱1,234.56 |
| Singapore | SGD | S$1,234.56 |
| Thailand | THB | ฿1,234.56 |

- Cross-currency operations are not supported in Phase 1. Each association operates in a single currency.

### Date & Time

- All dates and times are stored in UTC.
- Displayed in the user's timezone. Default timezone: the association's country timezone (e.g., Asia/Manila for PH associations).
- Users can override their display timezone in user settings.
- Date format is locale-aware. PH default: "April 21, 2026". US: "April 21, 2026".
- Relative dates for recent items: "3 days ago", "in 2 weeks". Relative dates switch to absolute format after 30 days.

### Regulatory Configurations

- Each association belongs to a country. Each country has a regulatory framework configuration.
- The framework config includes:
  - Credit cycle requirements (e.g., PRC Philippines requires 45 CPD units per 3-year cycle).
  - Accepted training types and their credit weights.
  - Documentation requirements for credit claims.
  - Renewal deadlines and grace periods.
- **Pluggable architecture:** Adding a new country means adding a regulatory config record, not code changes. The platform reads regulatory rules from configuration, not from hardcoded logic.

---

## 2. Data Privacy & Compliance

### Philippines: Data Privacy Act of 2012 (DPA 2012)

| Requirement | Implementation |
|-------------|---------------|
| Consent | Privacy notice displayed at registration. Explicit consent checkbox required before account creation. Consent is withdrawable at any time via user settings. |
| Data portability | Members can export their data (profile, payments, credits, membership history) as JSON or CSV from their account settings. Export is generated on demand. |
| Right to correction | Members can request corrections to their profile data. Officers can correct data on a member's behalf with an audit trail entry. |
| Right to deletion | Account deletion with a 30-day grace period. During the grace period the account is deactivated and can be restored. After 30 days, the account is anonymized. Financial records are retained for 7 years per BIR requirements. |
| Breach notification | NPC (National Privacy Commission) notified within 72 hours of a confirmed breach. Affected members notified with a plain-language explanation of what happened, what data was affected, and what steps they should take. |
| Data processing agreement | Each organization has a Data Processing Agreement (DPA) with the platform acting as data processor. A standard DPA template is provided during org onboarding. |
| PII handling | License numbers and payment data are encrypted at rest. PII is never logged in plaintext. Access to PII fields is restricted by role and logged in the audit trail. |

### Global Expansion Framework

| Jurisdiction | Key Requirements |
|-------------|-----------------|
| EU (GDPR) | Data residency in EU region. Cookie consent banner. Designated DPO contact. Right to erasure with 30-day SLA. Data processing records maintained. |
| Thailand (PDPA) | Similar consent and portability requirements to DPA 2012. Local data protection officer designation. |
| Singapore (PDPA) | Consent and purpose limitation. Do-not-call registry compliance for communications. Breach notification to PDPC. |
| United States | Not HIPAA -- AMS data is not clinical data. State privacy laws (CCPA, etc.) to be assessed at expansion time on a state-by-state basis. |

---

## 3. Soft Delete & Audit Reconciliation

- Members who request account deletion have their account soft-deleted (deactivated) immediately.
- During the 30-day grace period, the member can contact support to restore their account.
- After 30 days, the account is anonymized:
  - Name replaced with "Deleted Member".
  - Email replaced with a one-way hash.
  - License number replaced with a one-way hash.
  - Profile photo removed.
  - Personal details (address, phone, etc.) cleared.
- **Audit trail integrity:** Audit trail entries referencing the deleted member show the actor as "Deleted Member [ID hash]". Audit entries are immutable and cannot be purged or modified.
- **Financial record retention:** Financial records (payments, receipts, invoices) are retained for 7 years per BIR requirements. These records are associated with the anonymized member ID. The association can still reconcile financial reports without identifying the individual.

---

## 4. Security Requirements

### Authentication

| Control | Specification |
|---------|--------------|
| Password policy | Minimum 8 characters. At least 1 uppercase letter and 1 number required. |
| Session management | Maximum 3 concurrent sessions per user. Session timeout after 8 hours of inactivity. All sessions force-terminated on password change. |
| Brute force protection | Account locked after 5 failed login attempts. Lockout duration: 15 minutes. |
| OTP for registration | 6-digit numeric code. Valid for 10 minutes. Maximum 3 entry attempts before a new code must be requested. |

### Authorization

- Role-based access control (RBAC) scoped per organization.
- All org-scoped API calls verify that the requesting user has an active membership and the required role in that organization.
- **Org isolation:** Officers of Org A cannot access any data belonging to Org B, even if they are a member of both organizations. Every query is filtered by the org context of the request.
- **Platform admin impersonation:**
  - An orange "Viewing as [member name]" banner is always visible at the top of the screen during impersonation.
  - All actions taken during impersonation are logged with both the impersonator's ID and the impersonated member's ID.
  - Impersonation sessions auto-expire after 30 minutes. The admin must re-initiate impersonation to continue.

### File Uploads

| Control | Specification |
|---------|--------------|
| Allowed image types | JPEG, PNG |
| Allowed vector types | SVG (for logos only) |
| Allowed document types | PDF (for manual credit documents, reports) |
| SVG sanitization | SVGs are sanitized to remove embedded scripts, event handlers (`onload`, `onclick`, etc.), external references (`xlink:href` to external URLs), and data URIs containing scripts. Header-only validation is not sufficient. |
| Max file size (images) | 5 MB |
| Max file size (documents) | 10 MB |

### Payment Data

- The platform never stores raw credit card data. All payment card data is handled by the payment gateway (PCI-DSS compliant).
- Organization gateway credentials (API keys, secrets) are encrypted at rest.
- Gateway credentials are never logged in any log level (debug, info, error, etc.).

---

## 5. Concurrency Control

### Payment Recording

- If two treasurers submit a payment for the same member within the same minute, the second submission triggers a conflict warning: "A payment was just recorded for this member. Review before submitting."
- The conflict check compares member ID and timestamp. The second treasurer sees the details of the first payment and can choose to proceed or cancel.

### Officer Actions

- **Non-destructive actions:** Optimistic concurrency. Multiple officers can perform routine operations concurrently without locking.
- **Destructive actions (suspend, remove, etc.):** Last-write-wins with a mandatory audit log entry. The audit trail records who performed the action and when, enabling dispute resolution.

### Idempotency

- Payment gateway webhooks use idempotency keys.
- Duplicate webhook deliveries are detected and safely ignored -- no duplicate payments are recorded.
- Idempotency keys are retained for 48 hours to handle delayed retries.

---

## 6. Accessibility

Target standard: **WCAG 2.1 Level AA**.

| Requirement | Specification |
|-------------|--------------|
| Touch targets | Minimum 44x44px for all interactive elements on touch devices. |
| Color contrast | 4.5:1 minimum for normal text. 3:1 minimum for large text (18px+ or 14px+ bold). |
| Keyboard navigation | All interactive elements reachable by Tab key. Logical tab order follows visual layout. Focus indicators are clearly visible (not removed or hidden). |
| Screen reader support | Semantic HTML structure in all screens: proper heading hierarchy (h1-h6), labeled form inputs, descriptive button text, table captions and headers. ARIA attributes used only where native semantics are insufficient. |
| Form accessibility | All form inputs have visible labels (not placeholder-only). Error messages are programmatically associated with their input field using `aria-describedby` or equivalent, not just visually placed nearby. Required fields are indicated both visually and programmatically. |
| Motion and animation | Respect `prefers-reduced-motion` media query. No essential information conveyed solely through animation. |

---

## 7. Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| API response p95 | < 500ms | Measured at the application layer, excluding network transit. |
| Page load (mobile, 3G) | < 3 seconds | Time to interactive on a simulated 3G connection with a mid-range mobile device. |
| Platform uptime | 99.5% monthly | Approximately 3.6 hours of allowed downtime per month. Excludes planned maintenance windows announced 48 hours in advance. |
| Search results | < 200ms | Time from query submission to first result rendered. Applies to member search, marketplace search, and directory search. |
| Report generation | < 5 seconds | For standard reports (membership roster, payment summaries, attendance). Complex custom reports may take longer with a progress indicator. |
| PDF generation | < 3 seconds per document | For receipts, certificates, and single-page reports. Multi-page batch exports use a background job with download notification. |
