# Cluster D — Officer finance/comms

Static read-only UI journey audit. apps/memberry (React + TanStack Router file routes, @monobase/sdk-ts hooks, `sonner` toasts). Nothing executed.

## Scan Manifest

Scope: 38 in-scope route files (all present) + cross-ref components from features/{billing,dues,communications}.

| Sub-module | Files | Status |
|---|---|---|
| officer-communications | communications.tsx, communications/{index,new,sent,analytics,$announcementId}.tsx, communications/templates/{index,new}.tsx | scanned 8/8 |
| officer-dues | dues/{assessments,treasurer}.tsx, dues/member.$memberId.tsx | scanned 3/3 |
| officer-finances | finances/{index,assessments,dues,funds,invoices,members}.tsx, finances/invoices/{index,$invoiceId}.tsx, finances/members/$memberId.tsx | scanned 10/10 |
| officer-payments | payments.tsx, payments/{index,new,$paymentId}.tsx | scanned 4/4 |
| officer-elections | elections/{index,new,$electionId}.tsx, elections/$electionId/edit.tsx | scanned 4/4 |
| officer-events | events/{index,new,$eventId}.tsx, events/$eventId/attendance.tsx | scanned 4/4 |
| officer-training | training/{index,new,$trainingId}.tsx, training/$trainingId/attendance.tsx | scanned 4/4 |
| officer-reports | reports/{credits,financial}.tsx | scanned 2/2 |

Cross-ref components: features/billing/components/merchant-account-setup.tsx; features/dues/components/gateway-setup; settings/{gateway,providers}.tsx (Stripe onboarding path).

**Inventoried 38 = Scanned 38. COMPLETE.**

## Route-guard baseline (applies to ALL files)

Parent layout `_authenticated/org/$orgSlug/officer.tsx:9` declares `beforeLoad: requireOrgOfficer`. Every officer/** route inherits this guard via TanStack nested routing. Per-file absence of `beforeLoad` is NOT a gap. `dues/{assessments,treasurer,member.$memberId}.tsx` additionally carry their own `beforeLoad` (redundant, harmless). **Registry 4: member cannot reach officer screens — guard verified. No P1 role-gap.**

## Registry 1 — Interactive element census (per sub-module)

### officer-communications
- communications.tsx — pure layout/`<Outlet>`, 0 interactive. PASS.
- communications/index.tsx — 1 `<Link>` (nav to compose). PASS.
- communications/{new,sent,analytics}.tsx, templates/* — render feature components (compose-form, announcement-list, delivery-funnel, template-form/list); navigate-only at route level. PASS.
- communications/$announcementId.tsx — 4 onClick, 2 mutations (publish @42, archive @51) both with interpolated onError, 1 `<Link>`, 2 `navigate`. PASS.
- templates/index.tsx — 1 onClick + 3 navigate. PASS.

### officer-dues
- dues/assessments.tsx, treasurer.tsx, member.$memberId.tsx — thin wrappers delegating to finances/dues feature views; redundant own `beforeLoad`. No interactive leaks. PASS.

### officer-finances
- finances/index.tsx — 2 navigate (drill-down cards). PASS.
- finances/{assessments,dues}.tsx — render feature views, read-only. PASS.
- finances/funds.tsx — saveMutation @62 (`upsertDuesFundsMutation`) has onError w/ `err.message`. PASS.
- finances/invoices.tsx — markPaidMut @110 onError; tab/pagination/export wired; **1 coming-soon button @306**.
- finances/members.tsx — CSV export wired; **2 coming-soon buttons @295,@298**.
- finances/invoices/index.tsx — 3 mutations (markPaid @115, update @121, generate @127) all onError; **1 coming-soon @396**.
- finances/invoices/$invoiceId.tsx — markPaid mutation @37 onError; **3 coming-soon DropdownMenuItems @110,113,116** (send/void/PDF).
- finances/members/$memberId.tsx — **4 coming-soon DropdownMenuItems @118,121,124,127** (record payment/reminder/invoice/assessment).

### officer-payments
- payments/index.tsx — sendReminders mutation @22 onError (static). PASS-w-note.
- payments/{new,$paymentId}.tsx — render feature forms/detail, no orphan handlers. PASS.

### officer-elections / officer-events / officer-training
- All index/new/$id/edit screens render feature components; onClicks are tab-switch / edit-mode / pagination / export — all wired to real state or handlers.
- events/$eventId/attendance.tsx — checkInMutation @47 (`checkInCustomEventMutation`) full onSuccess+onError(@72) w/ interpolated msg. QR-not-found → toast @98. PASS.
- training/$trainingId/attendance.tsx — checkIn mutation @32 onError interpolated. PASS.

### officer-reports
- reports/credits.tsx — 4 filter buttons, all setState-wired. PASS.
- reports/financial.tsx — handleGenerate wired w/ validation. PASS.

## Registry 2 — UI workflow trace (non-PASS only)

| WF | Status | Note |
|---|---|---|
| Officer: invoice → send reminder | PARTIAL | "Send reminders coming soon" stub (finances/invoices*.tsx, members.tsx) |
| Officer: invoice → send/void/PDF | PARTIAL | coming-soon stubs (finances/invoices/$invoiceId.tsx) |
| Treasurer: member → record payment/create invoice/add assessment | PARTIAL | coming-soon stubs (finances/members/$memberId.tsx) |

All other officer finance/comms WFs (publish/archive announcement, mark-paid, generate invoices, fund allocation, attendance check-in, election/event/training CRUD, report generation, CSV export) trace COMPLETE.

## Registry 4 — Role journey (non-PASS only)
None. Officer/treasurer can complete wired journeys; member blocked by `requireOrgOfficer`. No gap.

## Registry 5 — Wiring defects (non-PASS only)
No DEAD_API_CALL (P0). No ORPHAN_FORM, no NOOP_BUTTON (all onClick wired to handler/state/toast feedback). 10 unimplemented "coming soon" stub actions are EMPTY_HANDLER-class but give user feedback (`toast.info`) → P2, see findings.

## Registry 9 — Error-UX (non-PASS only)
All failable mutations (incl. invoice mark-paid/generate, fund upsert, announcement publish/archive, attendance check-in, payment reminders) HAVE onError. **No J-ERROR-MISSING (P1).** Several use STATIC (non-interpolated) toast.error → P2 J-ERROR-GENERIC. Stripe merchant-account-setup.tsx is presentational (handlers via props `onSetupAccount`); onError lives in consumer `/my/billing` (cluster A scope), not cluster D — no defect here.

## Findings summary

| ID | Sev | Module | File:Line | Issue | Fix |
|---|---|---|---|---|---|
| J-OFIN-001 | P2 | officer-finances | finances/invoices/$invoiceId.tsx:110,113,116 | Send / Void / PDF download are `toast.info('...coming soon')` stubs | Implement send/void/PDF mutations or hide actions |
| J-OFIN-002 | P2 | officer-finances | finances/members/$memberId.tsx:118,121,124,127 | Record payment / Send reminder / Create invoice / Add assessment are coming-soon stubs | Implement treasurer member-finance actions or hide |
| J-OFIN-003 | P2 | officer-finances | finances/invoices.tsx:306; finances/invoices/index.tsx:396; finances/members.tsx:295,298 | "Send reminders" / "Generate invoices" coming-soon stubs | Wire to existing reminder/generate mutations |
| J-OFIN-004 | P2 | officer-finances | finances/invoices.tsx:117; finances/invoices/index.tsx:118,124,134; finances/invoices/$invoiceId.tsx:44 | Static generic toast.error ("Failed to mark/update/generate") — no error detail | Interpolate `err.message`/cause for actionable feedback |
| J-OPAY-001 | P2 | officer-payments | payments/index.tsx:31 | Static generic "Failed to send reminders" toast | Interpolate error detail |
| J-OEV-001 | P2 | officer-events | events/$eventId/attendance.tsx:98 | "QR code not found in registration list" is a hardcoded toast (acceptable but static) | Acceptable; no change needed (informational) |

### Counts
- P0: 0
- P1: 0
- P2: 6 findings (10 stub actions + 5 static-error sites grouped)
- P3: 0

## Notes
- High-risk "Could not start payment setup" generic-error pattern: NOT present in cluster D. Stripe onboarding trigger lives in `/my/billing` (cluster A); cluster D's gateway/providers mutations all carry onError (`settings/providers.tsx:84,98,108`; merchant-account-setup is prop-driven presentational).
- No dead API calls, no orphan forms, no silent noop buttons in cluster D.

**STATUS: COMPLETE (38/38 inventoried files scanned).**
