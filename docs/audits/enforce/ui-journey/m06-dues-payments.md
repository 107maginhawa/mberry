<!-- oli:ui-journey v1.0 | module: m06-dues-payments | generated: 2026-05-27 -->
<!-- sources: 20 route files, 15 feature components, MODULE_SPEC.md, API_CONTRACTS.md, WORKFLOW_MAP.md -->

# UI Journey Audit: Dues & Payments (M06)

## Module Scope

Dues collection, invoicing, payments (online + manual + proof-based), fund allocation, refunds, financial reporting, dunning/reminders, and one-tap payment links. Two personas: **Member** (pay dues, view history) and **Officer/Treasurer** (manage invoices, record payments, process refunds, run reports).

---

## R1: Action Registry

Every interactive element that triggers a mutation, navigation, or side-effect.

| ID | Screen | Element | Type | Handler/Hook | API Endpoint | Spec Ref |
|----|--------|---------|------|-------------|-------------|----------|
| J-M06-001 | `/pay/$token` | "Pay Now" button | mutation | `handlePay` -> `api.post(/api/pay/:token/checkout)` | POST `/pay/:token/checkout` | WF-038, AC-M06-003 |
| J-M06-002 | `/org/$orgSlug/dues` | "Pay Now" button (DuesStatusCard) | navigation | `onPayNow` callback (scrolls to proof form or navigates to checkout) | -- | WF-038 |
| J-M06-003 | `/org/$orgSlug/dues` | "Export CSV" button (payment history) | side-effect | `exportPaymentsCsv` -> `buildPaymentCsv` + `downloadCsv` | -- (client-side) | WF-043 |
| J-M06-004 | `/org/$orgSlug/dues` | ProofUploadForm "Submit Payment Proof" | mutation | `submitMutation` -> `submitPaymentProofMutation()` | POST `/org/:orgId/payments/proof` | WF-044 |
| J-M06-005 | `/org/$orgSlug/dues` | ProofUploadForm file picker | side-effect | `handleFileChange` -> file validation (type, size) | POST `/api/storage/files` (upload) | -- |
| J-M06-006 | `/my/payments` | PaymentHistoryTable (render only) | display | `useQuery` -> `listDuesPaymentsOptions` | GET `/my/payments` | WF-043 |
| J-M06-007 | `/org/$orgSlug/officer/payments/` | "Send Reminders" button | mutation | `genInvoicesMutation` -> `generateDuesInvoicesForOrgMutation()` | POST `/org/:orgId/dues/invoices/generate` | WF-042 |
| J-M06-008 | `/org/$orgSlug/officer/payments/` | "Record Payment" link | navigation | `<Link to="/org/$orgSlug/officer/payments/new">` | -- | WF-044 |
| J-M06-009 | `/org/$orgSlug/officer/payments/new` | RecordPaymentForm submit | mutation | `recordMutation` -> `recordDuesPaymentMutation()` | POST `/org/:orgId/payments/manual` | WF-044, BR-06 |
| J-M06-010 | `/org/$orgSlug/officer/payments/new` | RecordPaymentForm member Combobox | query | `listRosterMembersOptions` (debounced search) | GET `/org/:orgId/roster/members?q=` | -- |
| J-M06-011 | `/org/$orgSlug/officer/payments/new` | RecordPaymentForm confirm dialog "Confirm" | mutation | `recordMutation.mutate(...)` with BigInt amount | POST `/org/:orgId/payments/manual` | WF-044 |
| J-M06-012 | `/org/$orgSlug/officer/payments/new` | FundAllocationPreview | display | `allocateFunds()` pure fn (client-side preview) | -- | BR-05, M6-R1 |
| J-M06-013 | `/org/$orgSlug/officer/payments/$paymentId` | RefundForm "Initiate Refund" expand | UI toggle | `setExpanded(true)` | -- | WF-041 |
| J-M06-014 | `/org/$orgSlug/officer/payments/$paymentId` | RefundForm "Confirm Refund" dialog | mutation | `refundMutation` -> `refundDuesPaymentMutation()` | POST `/org/:orgId/payments/:paymentId/refund` | WF-041, BR-08, AC-M06-006 |
| J-M06-015 | `/org/$orgSlug/officer/finances/` | MetricCard "Collection Rate" | display | `getDuesFinancialDashboardOptions` | GET `/org/:orgId/dues/financial-dashboard` | WF-043 |
| J-M06-016 | `/org/$orgSlug/officer/finances/` | MetricCard "Collected This Period" | display | same query as J-M06-015 | GET `/org/:orgId/dues/financial-dashboard` | WF-043 |
| J-M06-017 | `/org/$orgSlug/officer/finances/` | MetricCard "Outstanding Balance" | display | same query as J-M06-015 | GET `/org/:orgId/dues/financial-dashboard` | WF-043 |
| J-M06-018 | `/org/$orgSlug/officer/finances/` | AlertBanner (expiring members) action | navigation | `action.onClick` -> navigate to members list | -- | WF-042 |
| J-M06-019 | `/org/$orgSlug/officer/finances/` | CollectionsAreaChart | display | derived from dashboard data (monthly breakdown) | GET `/org/:orgId/dues/financial-dashboard` | WF-043 |
| J-M06-020 | `/org/$orgSlug/officer/finances/` | RecentActivityFeed | display | derived from dashboard data | GET `/org/:orgId/dues/financial-dashboard` | WF-043 |
| J-M06-021 | `/org/$orgSlug/officer/finances/invoices/` | "Generate Invoices" button | mutation | `genInvoicesMut` -> `generateDuesInvoicesForOrgMutation()` | POST `/org/:orgId/dues/invoices/generate` | WF-042 |
| J-M06-022 | `/org/$orgSlug/officer/finances/invoices/` | Tab filters (All/Draft/Open/Past Due/Paid) | client filter | `setActiveTab(tab)` -> URL search param update | -- (client filter) | -- |
| J-M06-023 | `/org/$orgSlug/officer/finances/invoices/` | Search input | client filter | `setSearchQuery(q)` -> URL search param update | -- (client filter) | -- |
| J-M06-024 | `/org/$orgSlug/officer/finances/invoices/` | Checkbox select (per-row) | UI toggle | `toggleSelect(id)` -> `selectedIds` state | -- | -- |
| J-M06-025 | `/org/$orgSlug/officer/finances/invoices/` | Checkbox select-all | UI toggle | `toggleSelectAll()` | -- | -- |
| J-M06-026 | `/org/$orgSlug/officer/finances/invoices/` | Bulk "Send Reminders" button | stub | `toast.info('Send reminders coming soon')` | -- | WF-042 |
| J-M06-027 | `/org/$orgSlug/officer/finances/invoices/` | Bulk "Mark Paid" button | mutation | `handleBulkMarkPaid` -> `markDuesInvoicePaidMutation()` per selected | POST `/org/:orgId/invoices/:id/mark-paid` | WF-044 |
| J-M06-028 | `/org/$orgSlug/officer/finances/invoices/` | "Export CSV" button | side-effect | `handleExportCsv` (client-side CSV generation) | -- | WF-043 |
| J-M06-029 | `/org/$orgSlug/officer/finances/invoices/` | Pagination Previous/Next | client nav | `setPage(p +/- 1)` -> URL search param | -- | -- |
| J-M06-030 | `/org/$orgSlug/officer/finances/invoices/` | Row click -> invoice detail | navigation | `<Link to="/invoices/$invoiceId">` | -- | -- |
| J-M06-031 | `/org/$orgSlug/officer/finances/invoices/` | Per-row dropdown: Mark Paid | mutation | `handleMarkPaidSingle(id)` | POST `/org/:orgId/invoices/:id/mark-paid` | WF-044 |
| J-M06-032 | `/org/$orgSlug/officer/finances/invoices/` | Per-row dropdown: Send Invoice | stub | `toast.info('Send invoice coming soon')` | -- | WF-042 |
| J-M06-033 | `/org/$orgSlug/officer/finances/invoices/` | Per-row dropdown: Void | stub | `toast.info('Void coming soon')` | -- | -- |
| J-M06-034 | `/org/$orgSlug/officer/finances/invoices/` | Per-row dropdown: Write Off | stub | `toast.info('Write off coming soon')` | -- | -- |
| J-M06-035 | `/org/$orgSlug/officer/finances/invoices/$invoiceId` | Actions dropdown: Mark Paid | mutation | `handleMarkPaid` -> `markDuesInvoicePaidMutation()` | POST `/org/:orgId/invoices/:id/mark-paid` | WF-044 |
| J-M06-036 | `/org/$orgSlug/officer/finances/invoices/$invoiceId` | Actions dropdown: Send to Member | stub | `toast.info('Send invoice coming soon')` | -- | WF-042 |
| J-M06-037 | `/org/$orgSlug/officer/finances/invoices/$invoiceId` | Actions dropdown: Void Invoice | stub | `toast.info('Void invoice coming soon')` | -- | -- |
| J-M06-038 | `/org/$orgSlug/officer/finances/invoices/$invoiceId` | Actions dropdown: Download PDF | stub | `toast.info('PDF download coming soon')` | -- | WF-045 |
| J-M06-039 | `/org/$orgSlug/officer/finances/funds` | "Edit Rules" toggle button | UI toggle | `setShowEditor(!showEditor)` | -- | WF-040 |
| J-M06-040 | `/org/$orgSlug/officer/finances/members` | Members table with dues status | display + navigation | `listRosterMembersOptions` + row links | GET `/org/:orgId/roster/members` | WF-043 |
| J-M06-041 | `/org/$orgSlug/officer/finances/members/$memberId` | Actions dropdown: Record Payment | navigation | links to `/officer/payments/new` (implied) | -- | WF-044 |
| J-M06-042 | `/org/$orgSlug/officer/finances/members/$memberId` | Actions dropdown: Send Reminder | stub | `toast.info('coming soon')` | -- | WF-042 |
| J-M06-043 | `/org/$orgSlug/officer/finances/members/$memberId` | Actions dropdown: Generate Invoice | stub | `toast.info('coming soon')` | -- | WF-042 |
| J-M06-044 | `/org/$orgSlug/officer/finances/members/$memberId` | Invoice list with status badges | display | `summary.invoices` from custom API | GET `/association/member/dues-member-summary/:orgId/:memberId` | WF-043 |
| J-M06-045 | `/org/$orgSlug/officer/finances/members/$memberId` | Payment history list | display | `summary.payments` from custom API | same as above | WF-043 |
| J-M06-046 | `/org/$orgSlug/officer/finances/members/$memberId` | Status timeline | display | `summary.statusTimeline` | same as above | -- |
| J-M06-047 | `/org/$orgSlug/officer/payments/` | PendingProofsList "Confirm" button | mutation | `confirmMutation` -> approve proof mutation | POST `/org/:orgId/payments/proofs/:id/confirm` | WF-044 |
| J-M06-048 | `/org/$orgSlug/officer/payments/` | PendingProofsList "Reject" button + reason input | mutation | `rejectMutation` -> reject proof mutation | POST `/org/:orgId/payments/proofs/:id/reject` | WF-044 |
| J-M06-049 | `/my/billing` | Billing page (payment method management) | display | session-based billing data | -- | -- |
| J-M06-050 | `/org/$orgSlug/officer/finances/assessments` | Assessments page | display | assessment config data | -- | WF-040 |
| J-M06-051 | `/org/$orgSlug/officer/finances/dues` | Dues configuration page | display | dues config data | GET `/org/:orgId/config/dues` | WF-040 |
| J-M06-052 | `/org/$orgSlug/officer/dues/member/$memberId` | Redirect to finances/members/$memberId | navigation | `throw redirect(...)` | -- | -- |
| J-M06-053 | `/org/$orgSlug/officer/dues/assessments` | Redirect/alias route | navigation | route file | -- | -- |
| J-M06-054 | `/org/$orgSlug/officer/dues/treasurer` | Treasurer view route | display | route file | -- | -- |

---

## R2: Journey Completion Registry

End-to-end user journeys mapped to workflows.

| ID | Journey | Workflow | Steps (Finding IDs) | Terminal State | Complete? |
|----|---------|---------|---------------------|---------------|-----------|
| J-M06-J01 | Member pays dues online (one-tap link) | WF-038 | J-M06-001 (validate token) -> Pay Now -> Stripe redirect -> success page | Payment completed, expiry extended | PARTIAL -- success/failure callback pages not found in routes; relies on Stripe hosted page redirect |
| J-M06-J02 | Member views dues status + pays via proof | WF-038/044 | J-M06-002 (DuesStatusCard) -> J-M06-004 (ProofUploadForm) -> officer reviews -> J-M06-047/048 (confirm/reject) | Proof confirmed -> payment completed | YES |
| J-M06-J03 | Member views payment history | WF-043 | J-M06-006 (PaymentHistoryTable on /my/payments) | History displayed | YES |
| J-M06-J04 | Member exports payment CSV | WF-043 | J-M06-003 (Export CSV on /org/dues page) | CSV downloaded | YES |
| J-M06-J05 | Officer records manual payment | WF-044 | J-M06-008 (nav) -> J-M06-010 (member search) -> J-M06-009 (form) -> J-M06-012 (preview) -> J-M06-011 (confirm) | Payment recorded, funds split | YES |
| J-M06-J06 | Officer processes refund | WF-041 | Payment detail -> J-M06-013 (expand) -> enter amount/reason -> J-M06-014 (confirm) | Refund processed, allocations reversed | YES |
| J-M06-J07 | Officer views financial dashboard | WF-043 | J-M06-015/016/017 (metric cards) -> J-M06-019 (chart) -> J-M06-020 (activity) | Dashboard displayed | YES |
| J-M06-J08 | Officer manages invoices (list, filter, bulk actions) | WF-042/043 | J-M06-021 (generate) -> J-M06-022/023 (filter/search) -> J-M06-024/025 (select) -> J-M06-027 (bulk mark paid) -> J-M06-028 (export) | Invoices managed | PARTIAL -- bulk send reminders is stub (J-M06-026) |
| J-M06-J09 | Officer views invoice detail + actions | WF-044/045 | J-M06-030 (nav) -> J-M06-035 (mark paid) | Invoice status updated | PARTIAL -- send/void/PDF are stubs (J-M06-036/037/038) |
| J-M06-J10 | Officer sends dues reminders | WF-042 | J-M06-007 (Send Reminders button) | Reminders queued | YES (basic), but per-invoice send is stub |
| J-M06-J11 | Officer reviews member financial detail | WF-043 | J-M06-040 (members list) -> J-M06-044/045/046 (invoices/payments/timeline) | Member financial profile displayed | YES |
| J-M06-J12 | Officer manages funds | WF-039/040 | J-M06-039 (Edit Rules toggle) -> fund editor | Fund config saved | PARTIAL -- editor toggle exists but full CRUD not audited |
| J-M06-J13 | Officer approves/rejects payment proofs | WF-044 | J-M06-047 (Confirm) / J-M06-048 (Reject + reason) | Proof processed | YES |
| J-M06-J14 | Receipt generation/download | WF-045 | J-M06-038 (Download PDF on invoice detail) | PDF downloaded | NO -- stub only (`toast.info`) |

---

## R3: Dead Interaction Registry

Actions wired to UI but producing no effect or leading to dead ends.

| ID | Finding ID | Screen | Element | Issue | Severity | Spec Gap? |
|----|-----------|--------|---------|-------|----------|-----------|
| J-M06-D01 | J-M06-026 | Invoices list | Bulk "Send Reminders" button | `toast.info('Send reminders coming soon')` -- no API call | P2 | WF-042 expects per-invoice reminders |
| J-M06-D02 | J-M06-032 | Invoices list | Per-row "Send Invoice" dropdown | `toast.info('Send invoice coming soon')` -- no API call | P2 | WF-042 |
| J-M06-D03 | J-M06-033 | Invoices list | Per-row "Void" dropdown | `toast.info('Void coming soon')` -- no API call | P2 | API_CONTRACTS has no void endpoint |
| J-M06-D04 | J-M06-034 | Invoices list | Per-row "Write Off" dropdown | `toast.info('Write off coming soon')` -- no API call | P2 | API_CONTRACTS has no write-off endpoint |
| J-M06-D05 | J-M06-036 | Invoice detail | "Send to Member" dropdown | `toast.info('Send invoice coming soon')` -- no API call | P2 | WF-042 |
| J-M06-D06 | J-M06-037 | Invoice detail | "Void Invoice" dropdown | `toast.info('Void invoice coming soon')` -- no API call | P2 | No void endpoint in API_CONTRACTS |
| J-M06-D07 | J-M06-038 | Invoice detail | "Download PDF" dropdown | `toast.info('PDF download coming soon')` -- no API call | P1 | WF-045 (Receipt Generation) is P0 workflow |
| J-M06-D08 | J-M06-042 | Member detail | "Send Reminder" action | `toast.info('coming soon')` | P2 | WF-042 |
| J-M06-D09 | J-M06-043 | Member detail | "Generate Invoice" action | `toast.info('coming soon')` | P2 | WF-042 |

---

## R4: State Coverage Registry

UI states per screen vs. spec-required states.

| ID | Screen | Loading | Empty | Error | Populated | Permission | Validation | Notes |
|----|--------|---------|-------|-------|-----------|------------|------------|-------|
| J-M06-S01 | `/pay/$token` | YES (loading var) | N/A | YES (fetchError, payError, invalid token, expired token, already paid) | YES (invoice details + Pay Now) | N/A (public) | N/A | Matches spec: ValidToken, ExpiredToken, AlreadyPaid, Processing, Failed states all present |
| J-M06-S02 | `/org/$orgSlug/dues` | YES (Skeleton) | YES (EmptyState for payments, invoices) | PARTIAL (no explicit error state for API failure) | YES (DuesStatusCard, invoices, payments, timeline, arrears) | N/A (member always has access) | N/A | Missing: explicit error boundary for dashboard API failure |
| J-M06-S03 | `/my/payments` | Delegated to PaymentHistoryTable | Delegated | Delegated | Delegated | N/A | N/A | Thin wrapper -- states handled by child component |
| J-M06-S04 | `/my/billing` | YES | YES | YES | YES | N/A | N/A | -- |
| J-M06-S05 | `/org/$orgSlug/officer/payments/` | Delegated to child components | Delegated | Delegated | YES (dashboard + table + proofs) | Officer guard (layout) | N/A | -- |
| J-M06-S06 | `/org/$orgSlug/officer/payments/new` | N/A (form) | N/A | N/A | YES (form) | Officer guard | YES (zod schema, amount > 0, required fields) | Confirmation dialog present |
| J-M06-S07 | `/org/$orgSlug/officer/payments/$paymentId` | YES (CardSkeleton) | N/A | YES ("Payment not found.") | YES (details + allocations + refund form) | Officer guard | N/A | -- |
| J-M06-S08 | `/org/$orgSlug/officer/finances/` | YES (MetricCardSkeleton x3) | N/A | MISSING | YES (3 metric cards + chart + activity feed + alerts) | Officer guard | N/A | **Finding**: No error state for dashboard API failure |
| J-M06-S09 | `/org/$orgSlug/officer/finances/invoices/` | YES (Skeleton rows) | YES (EmptyState) | MISSING | YES (tabbed table + bulk actions + pagination) | Officer guard | N/A | **Finding**: No error state for list API failure |
| J-M06-S10 | `/org/$orgSlug/officer/finances/invoices/$invoiceId` | YES (Skeleton) | N/A | YES ("Invoice not found") | YES (details + status badge + actions) | Officer guard | N/A | -- |
| J-M06-S11 | `/org/$orgSlug/officer/finances/funds` | YES | YES (if no funds) | MISSING | YES (fund cards + editor) | Officer guard | YES (percentages must sum to 100%) | -- |
| J-M06-S12 | `/org/$orgSlug/officer/finances/members` | YES | YES | MISSING | YES (table + filters) | Officer guard | N/A | -- |
| J-M06-S13 | `/org/$orgSlug/officer/finances/members/$memberId` | YES (Skeleton) | N/A | YES (not found) | YES (sidebar + invoices + payments + timeline) | Officer guard | N/A | -- |
| J-M06-S14 | `/org/$orgSlug/officer/finances/assessments` | YES | YES | MISSING | YES | Officer guard | N/A | -- |
| J-M06-S15 | `/org/$orgSlug/officer/finances/dues` | YES | YES | MISSING | YES | Officer guard | N/A | -- |

**Spec vs. Implementation gap**: MODULE_SPEC Section 9 defines 4 screens with 6 states each (Loading, Empty, Populated, ValidationError, PermissionError, GatewayUnavailable). The implementation has 15+ screens (more granular). Several officer screens lack explicit error states for API failures (J-M06-S08, S09, S11, S12, S14, S15).

---

## R5: Spec Traceability Registry

Mapping spec artifacts to UI implementation.

### Workflow Coverage

| WF-ID | Workflow | UI Implementation | Coverage |
|-------|---------|-------------------|----------|
| WF-038 | Pay Dues Online | `/pay/$token` (one-tap), `/org/$orgSlug/dues` (proof upload) | PARTIAL -- Stripe redirect flow exists but no success/failure callback routes in app |
| WF-039 | Fund Allocation | FundAllocationPreview component (client-side), fund cards on `/finances/funds` | YES (display), PARTIAL (config editing behind toggle) |
| WF-040 | Dues Config | `/officer/finances/dues`, `/officer/finances/assessments`, `/officer/finances/funds` | YES |
| WF-041 | Refund Processing | RefundForm on `/officer/payments/$paymentId` | YES |
| WF-042 | Dunning/Reminders | "Send Reminders" button on officer payments page, AlertBanner on dashboard | PARTIAL -- bulk send works, per-invoice send is stub |
| WF-043 | Financial Dashboard | `/officer/finances/` (3 metric cards, chart, activity feed) | YES |
| WF-044 | Manual Payment Recording | `/officer/payments/new` (RecordPaymentForm) + proof confirm/reject | YES |
| WF-045 | Receipt Generation | "Download PDF" on invoice detail | NO -- stub only |

### Acceptance Criteria Coverage

| AC | Description | UI Evidence | Status |
|----|-------------|-------------|--------|
| AC-M06-001 | Fund Allocation Integrity | FundAllocationPreview shows split; `allocateFunds()` with remainder handling | YES (client preview), backend enforcement assumed |
| AC-M06-002 | Idempotent Webhooks | No UI surface (backend concern) | N/A |
| AC-M06-003 | One-Tap Payment | `/pay/$token` route with validate -> checkout flow | YES |
| AC-M06-004 | Concurrent Payment Warning | RecordPaymentForm uses confirmation dialog | PARTIAL -- no explicit 5-min duplicate check UI warning per M6-R4 |
| AC-M06-005 | Report Accuracy | Report results component with collection/fund/status report types | YES (display) |
| AC-M06-006 | Refund Reversal | RefundForm with amount validation, confirmation dialog, fund reversal display on payment detail | YES |
| AC-M06-007 | Life Member Payment Block | Not visible in frontend code -- needs backend enforcement | MISSING (no UI guard found) |

### Business Rule UI Enforcement

| Rule | UI Enforcement | Finding |
|------|---------------|---------|
| BR-05 | FundAllocationPreview displays split; `allocateFunds()` lib | Client-side preview only; server enforces |
| BR-06 | RecordPaymentForm captures member, amount, date, method, reference; officer identity via session | YES |
| BR-07 | Not UI-visible (backend extends expiry on payment confirm) | N/A |
| BR-08 | RefundForm validates amount <= maxRefundable | YES |
| M6-R1 | `fund-math.ts` `allocateFunds()` with last-fund remainder absorption | YES |
| M6-R4 | Confirmation dialog exists but no 5-min duplicate check | PARTIAL |
| M6-R5 | Send Reminders button triggers generation; no configurable schedule UI found | PARTIAL |
| M6-R6 | Receipt number displayed on payment detail (`payment.receiptNumber`) | Display YES, generation backend |

### Error Handling UI Coverage

| Error Scenario (from spec) | UI Coverage | Finding |
|---------------------------|-------------|---------|
| Gateway unreachable during checkout | `/pay/$token` shows "Network error. Please try again." on catch | YES |
| Webhook never arrives (24h) | No UI surface (backend/cron concern) | N/A |
| Refund gateway failure | RefundForm `onError` shows toast | YES |
| Fund percentages != 100 | `validateFundAllocations()` in money.ts; fund editor validation | YES |
| Life member payment attempt | Not found in frontend code | MISSING -- spec says "Life members are exempt from dues" |
| Duplicate manual recording (5-min window) | Confirmation dialog exists but no time-based duplicate warning | MISSING |
| Token expired on /pay/:token | `data.error` displayed when `!data.valid` | YES |

---

## R6: Finding Summary

### P0 Findings (Blockers)

None.

### P1 Findings (High)

| ID | Finding | Impact | Remediation |
|----|---------|--------|-------------|
| J-M06-F01 | Receipt PDF download is stub-only (J-M06-D07) | WF-045 is P0 workflow; no receipt download possible | Implement GET `/org/:orgId/payments/:id/receipt` endpoint + wire PDF download in invoice detail |
| J-M06-F02 | 6 officer screens lack error states for API failures (S08, S09, S11, S12, S14, S15) | Users see blank/broken UI on API errors | Add error boundary or `isError` conditional with retry CTA |
| J-M06-F03 | Life member payment block has no frontend guard (AC-M06-007) | Life members could attempt payment; relies entirely on backend 400 | Add client-side check: if `dues_expiry_date >= 2099-12-31`, hide Pay Now and show "Life members are exempt" |

### P2 Findings (Medium)

| ID | Finding | Impact | Remediation |
|----|---------|--------|-------------|
| J-M06-F04 | 8 stub actions across invoice management (J-M06-D01 through D09) | Officer sees "coming soon" for send/void/write-off actions | Prioritize send invoice (WF-042); void/write-off can remain deferred |
| J-M06-F05 | No 5-minute duplicate payment warning (M6-R4) | Two treasurers could record same payment without warning | Add timestamp check before confirm dialog: "A payment was recorded for this member X minutes ago" |
| J-M06-F06 | Stripe checkout success/failure callback pages not found | After Stripe redirect, user lands on generic page or external URL | Add `/pay/$token/success` and `/pay/$token/cancel` routes per WF-038 exception flows |
| J-M06-F07 | Per-invoice reminder send not implemented | Officers cannot send targeted reminders to specific overdue invoices | Wire bulk and single-invoice reminder to API |
| J-M06-F08 | Reminder schedule configuration UI not found | M6-R5 says defaults are 60/30/7 pre-expiry, 7/30 post-expiry; no UI to change | Add reminder config section to dues configuration page (PUT `/org/:orgId/config/reminder-schedule`) |

### P3 Findings (Low)

| ID | Finding | Impact | Remediation |
|----|---------|--------|-------------|
| J-M06-F09 | `fund-allocation-preview.tsx` displays `fundId` (UUID) instead of fund name | Officer sees UUID in preview, not human-readable name | Map `fundId` to fund name from `funds` array |
| J-M06-F10 | PaymentHistoryTable on `/my/payments` uses `scope="member"` prop but no org filter UI | Member with multiple orgs sees all payments without org filter | Add org filter dropdown per spec: "filters (date range, org)" |
| J-M06-F11 | `/org/$orgSlug/dues` member page has no explicit error boundary | API failure shows broken state | Wrap in error boundary with retry |
| J-M06-F12 | Redirect routes exist for legacy paths (`/officer/dues/member/$memberId` -> `/officer/finances/members/$memberId`) | Working as intended but adds maintenance surface | Document redirects; remove after migration period |

---

## Metrics

| Metric | Count |
|--------|-------|
| Total interactive elements audited | 54 |
| Journeys mapped | 14 |
| Journeys complete | 8 |
| Journeys partial | 5 |
| Journeys missing | 1 |
| Dead interactions | 9 |
| Screens audited | 15 |
| Screens missing error state | 6 |
| Spec workflows covered | 7/8 (WF-045 stub only) |
| Acceptance criteria with UI evidence | 5/7 |
| P1 findings | 3 |
| P2 findings | 5 |
| P3 findings | 4 |
| Total findings | 12 |

---

## Files Audited

### Route Files
- `apps/memberry/src/routes/pay/$token.tsx`
- `apps/memberry/src/routes/_authenticated/my/payments.tsx`
- `apps/memberry/src/routes/_authenticated/my/billing.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/dues.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/payments/index.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/payments/$paymentId.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/payments/new.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/index.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/invoices.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/invoices/index.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/invoices/$invoiceId.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/funds.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/members.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/members/$memberId.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/assessments.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/dues.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dues/member.$memberId.tsx` (redirect)
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dues/assessments.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dues/treasurer.tsx`

### Feature Components
- `apps/memberry/src/features/dues/components/payment-history-table.tsx`
- `apps/memberry/src/features/dues/components/dues-invoice-list.tsx`
- `apps/memberry/src/features/dues/components/financial-dashboard.tsx`
- `apps/memberry/src/features/dues/components/pending-proofs-list.tsx`
- `apps/memberry/src/features/dues/components/record-payment-form.tsx`
- `apps/memberry/src/features/dues/components/refund-form.tsx`
- `apps/memberry/src/features/dues/components/fund-allocation-preview.tsx`
- `apps/memberry/src/features/dues/components/proof-upload-form.tsx`
- `apps/memberry/src/features/dues/components/dues-status-card.tsx`
- `apps/memberry/src/features/dues/components/dues-status-badge.tsx`
- `apps/memberry/src/features/dues/components/arrears-breakdown.tsx`
- `apps/memberry/src/features/dues/components/payment-schedule-timeline.tsx`
- `apps/memberry/src/features/dues/components/metric-card.tsx`
- `apps/memberry/src/features/dues/components/alert-banner.tsx`
- `apps/memberry/src/features/dues/components/collections-area-chart.tsx`
- `apps/memberry/src/features/dues/components/recent-activity-feed.tsx`
- `apps/memberry/src/features/dues/components/report-results.tsx`

### Utility Files
- `apps/memberry/src/features/dues/lib/money.ts`
- `apps/memberry/src/features/dues/lib/csv-export.ts`

### Spec Artifacts
- `docs/product/modules/m06-dues-payments/MODULE_SPEC.md`
- `docs/product/modules/m06-dues-payments/API_CONTRACTS.md`
- `docs/product/WORKFLOW_MAP.md` (WF-038 through WF-045)
- `docs/product/ROLE_PERMISSION_MATRIX.md`
