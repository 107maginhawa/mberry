# Execution Checklist — Gap Backlog

**Created:** 2026-05-04
**Rule:** Nothing marked done without: code works + test passes + browse-verified with real data.

---

## Phase A: P0 Compliance (4 items)

- [ ] **A1.** Account deletion + anonymization (M-25, BR-32)
  - Handler: 30-day grace period, anonymize PII, retain financial records 7yr
  - Route: `/my/settings` already has "Delete Account" button — wire it up
  - Test: unit test for anonymization logic + E2E delete flow
  - Verify: browse → Settings → Delete Account → confirm grace period banner appears

- [ ] **A2.** Data export / portability (M-26)
  - Handler: generate CSV/JSON of all member data (profile, memberships, payments, credits, certificates)
  - Route: `/my/data-export` exists — wire to real handler
  - Test: unit test for export content completeness
  - Verify: browse → Data Export → Request → verify download contains real data

- [ ] **A3.** Regulatory approval maintenance (SO-8, M09)
  - Handler: CRUD for PRC approval status per training, expiration tracking
  - Route: officer training detail page — add approval status section
  - Test: unit test for expiration alert logic
  - Verify: browse → Training detail → see approval status fields

- [ ] **A4.** Data breach notification workflow (PA-11)
  - Blocked by: Phase G (#49 admin app shell)
  - Handler: breach notification creation, affected user notification, NPC reporting
  - Note: defer until admin app exists, but document handler spec now

---

## Phase B: P1 Core Wiring — Backend Exists (9 items)

- [ ] **B1.** Roster `?expiring=30` filter
  - What: read `expiring` search param in roster page, filter members with dues expiring within N days
  - Files: `roster/index.tsx`, `member-table.tsx`
  - Test: browse → dashboard "expiring dues" card → verify only expiring members shown
  - Verify: count on dashboard matches count on filtered roster

- [ ] **B2.** Member reinstatement UI (CS-7)
  - What: button on member detail page → calls existing `reinstateMembership` handler
  - Files: `roster/$memberId.tsx`
  - Test: browse → Roster → click suspended member → Reinstate → verify status changes to Active
  - Verify: API test for `reinstateMembership`

- [ ] **B3.** Batch dues reminders (CT-2)
  - What: "Send Reminders" button on payments page → calls existing dunning handler
  - Files: `payments/index.tsx` or roster page with bulk action
  - Test: browse → Payments → Send Reminders → verify toast success
  - Verify: API test for `generateDuesInvoicesForOrg`

- [ ] **B4.** Pay dues online (M-3)
  - What: wire existing `pay/$token.tsx` route + `validatePaymentLink` + gateway handlers
  - Files: `pay/$token.tsx`, member dashboard "Pay Dues" CTA
  - Test: browse → member dashboard → Pay Dues → verify payment flow
  - Verify: payment appears in officer payments list

- [ ] **B5.** Apply via public page (M-8)
  - What: wire "Apply to Join" button on `/org/$slug` → `createMembershipApplication`
  - Files: `org/$slug.tsx`
  - Test: browse → public org page → Apply → verify application appears in officer Applications page
  - Verify: officer sees new pending application

- [ ] **B6.** Transfer membership UI (M-16)
  - What: UI for existing `createAffiliationTransfer` + approval handlers
  - Files: new component on member profile or organizations page
  - Test: browse → Organizations → Transfer → verify transfer request created
  - Verify: API test for transfer handlers

- [ ] **B7.** Cross-org training promotion (SO-9)
  - What: wire existing training publish/search for cross-org visibility
  - Files: training list page — show network-wide trainings from other orgs
  - Test: browse → member Training → see trainings from other orgs
  - Verify: training with network-wide visibility appears in member feed

- [ ] **B8.** Voluntary org departure (M-27)
  - What: "Leave Organization" button → calls handler
  - Files: member organizations page or profile
  - Test: browse → Organizations → Leave → verify membership removed
  - Verify: org no longer appears in member's org list

- [ ] **B9.** Deceased member handling (CS-6)
  - What: add "deceased" option to member status actions, exclude from reminders
  - Files: `roster/$memberId.tsx`, reminder/notification logic
  - Test: browse → Roster → member detail → Mark Deceased → verify excluded from reminders
  - Verify: member status updates, no longer in active counts

---

## Phase C: P2 Missing Flows — Need Backend + Frontend (13 items)

- [ ] **C1.** Data correction requests (CS-5)
  - What: member submits correction request → officer reviews → approve/reject
  - Backend: new handler for correction request CRUD
  - Frontend: member profile "Request Correction" + officer review queue
  - Test: full flow E2E
  - Verify: browse both member + officer views

- [ ] **C2.** Payment correction (CT-9)
  - What: void payment + re-record with audit trail
  - Backend: `voidInvoice` exists — add re-record flow
  - Frontend: officer payment detail → Void → Re-record
  - Test: API test for void + re-record + verify audit log
  - Verify: browse → payment detail → void → re-record → check history

- [ ] **C3.** Payment mismatch handling (CT-8)
  - What: when payment amount ≠ dues amount — accept partial, request more, refund excess
  - Backend: extend payment recording to handle mismatches
  - Frontend: payment recording form shows mismatch options
  - Test: API test for each mismatch scenario
  - Verify: browse → Record Payment → enter wrong amount → verify options appear

- [ ] **C4.** Contact officer (M-18)
  - What: member → officer direct messaging through platform
  - Backend: extend communications module for direct messages
  - Frontend: member profile → "Contact Officer" button
  - Test: E2E message send + receive
  - Verify: browse as member → send message → browse as officer → see message

- [ ] **C5.** Payment dispute (M-22)
  - What: member flags payment issue → treasurer reviews
  - Backend: dispute CRUD handler
  - Frontend: member payments → "Dispute" button + officer dispute queue
  - Test: full flow E2E
  - Verify: browse both views

- [ ] **C6.** Duplicate merge request (M-21, BR-22)
  - What: member flags potential duplicate → admin resolves
  - Backend: merge request handler + account merge logic
  - Frontend: member settings → "Report Duplicate" + admin merge tool
  - Test: API test for merge logic
  - Verify: browse → report duplicate → admin sees request

- [ ] **C7.** Society onboarding wizard (SO-6)
  - What: training-focused org setup, skip dues configuration
  - Backend: org type detection → conditional setup flow
  - Frontend: onboarding wizard with training-first steps
  - Test: E2E onboarding as society officer
  - Verify: browse → sign up as society → verify dues steps skipped

- [ ] **C8.** Credit correction UI (SO-12)
  - What: officer adjusts credits with documented reason + member notification
  - Backend: credit adjustment handler with reason field
  - Frontend: officer credit reports → Adjust button → reason form
  - Test: API test for adjustment + notification
  - Verify: browse → adjust credit → verify member sees notification

- [ ] **C9.** Financial report review workflow (CP-5)
  - What: treasurer submits report → president reviews/annotates/flags
  - Backend: report submission + review status + annotations
  - Frontend: treasurer "Submit Report" + president review queue
  - Test: full flow E2E
  - Verify: browse as treasurer → submit → browse as president → review

- [ ] **C10.** Periodic report submission (CT-4)
  - What: treasurer generates + submits periodic report to president
  - Backend: report generation + submission tracking
  - Frontend: financial reports → "Submit to President" button
  - Test: API test for submission
  - Verify: browse → generate report → submit → president sees it

- [ ] **C11.** Invite chapter / referral (CO-11)
  - What: officer sends invitation to another chapter to join platform
  - Backend: chapter referral handler
  - Frontend: settings or dashboard → "Invite Chapter" flow
  - Test: API test for referral creation
  - Verify: browse → invite → verify referral record created

- [ ] **C12.** Meeting agenda distribution (CS-4)
  - What: attach agenda to event, distribute as announcement
  - Backend: event-announcement linking
  - Frontend: event detail → "Attach Agenda" + "Distribute" buttons
  - Test: E2E agenda attachment + distribution
  - Verify: browse → event → attach agenda → distribute → members see announcement

- [ ] **C13.** Membership reports screen (CS-3)
  - What: dedicated reports page — totals by category, new members, growth trends
  - Backend: membership analytics query
  - Frontend: new reports page or extend existing
  - Test: verify report data accuracy
  - Verify: browse → reports → verify numbers match actual roster

---

## Phase D: P3 Larger Features (14 items)

- [ ] **D1.** Engagement analytics (CO-12) — L
- [ ] **D2.** Org benchmarking (CO-13) — L
- [ ] **D3.** Support tickets (CP-4) — L
- [ ] **D4.** Payment reconciliation (CT-3) — L
- [ ] **D5.** Officer transition checklist (CO-9, CP-7) — L
- [ ] **D6.** Offline/PWA support (M-20) — L
- [ ] **D7.** Society officer transition (SO-14) — L
- [ ] **D8.** Society configuration (SO-10) — M
- [ ] **D9.** ID card QR code HMAC-signed (BR-18) — M
- [ ] **D10.** ID card PDF download (BR-19) — M
- [ ] **D11.** SVG upload security (BR-31) — M
- [ ] **D12.** Credit cycle + carry-over (BR-11/12) — M
- [ ] **D13.** Org name on ID card — S
- [ ] **D14.** Member directory sidebar link — S

---

## Phase E: P4 Phase 2 Modules (4 items)

- [ ] **E1.** Elections full flow (M12) — wire voting UI, nomination eligibility (BR-34)
- [ ] **E2.** Professional feed (M13) — content creation, moderation (BR-35)
- [ ] **E3.** National dashboard (M14) — cross-chapter aggregates (BR-36)
- [ ] **E4.** Job board (M15) — CRUD, expiry (BR-37)

---

## Phase F: P5 Phase 3 Modules (4 items)

- [ ] **F1.** M16: Advertising
- [ ] **F2.** M17: Marketplace (BR-38)
- [ ] **F3.** M18: Surveys & Polls (BR-40)
- [ ] **F4.** M19: Committee Management (BR-39)

---

## Phase G: P6 Platform Admin App (7 items)

- [ ] **G1.** Admin app shell — scaffold `apps/admin` (blocks G2-G7 + A4)
- [ ] **G2.** Org health scoring (PA-22)
- [ ] **G3.** Revenue dashboard (PA-15)
- [ ] **G4.** Feature flag UI (PA-17)
- [ ] **G5.** User impersonation UI (PA-21)
- [ ] **G6.** Subscription management (PA-3) — blocks G3
- [ ] **G7.** Account merge (PA-9)

---

## Phase H: Test Coverage (16 handlers)

- [ ] **H1.** `approveMembershipApplication` — core approval
- [ ] **H2.** `denyMembershipApplication` — rejection flow
- [ ] **H3.** `recordManualPayment` — treasurer daily action
- [ ] **H4.** `createOfficerTerm` — governance
- [ ] **H5.** `updateOfficerTerm` — governance
- [ ] **H6.** `terminateMembership` — irreversible
- [ ] **H7.** `reinstateMembership` — recovery
- [ ] **H8.** `voidInvoice` — financial correction
- [ ] **H9.** `createInvite` / `claimInvite` — onboarding
- [ ] **H10.** `updateDuesConfig` — config change
- [ ] **H11.** `transitionOrgStatus` — org lifecycle
- [ ] **H12.** `startImpersonation` / `endImpersonation` — security
- [ ] **H13.** `generateDuesInvoicesForOrg` — batch ops
- [ ] **H14.** `searchDirectory` — member search
- [ ] **H15.** All `audit/` handlers — zero tests
- [ ] **H16.** All `email/` handlers — zero tests

---

## Completion Gate (per item)

Every item must pass ALL before marking `[x]`:

1. **Code written** — handler + route + component
2. **Unit test passes** — `bun test` for handler
3. **Type check passes** — `bun run typecheck`
4. **Browse-verified** — log in as relevant persona, click through full flow, verify real data
5. **Cross-check** — if item has dashboard stat, verify stat matches destination page

---

## Progress Tracker

| Phase | Total | Done | Remaining |
|-------|-------|------|-----------|
| A: Compliance | 4 | 0 | 4 |
| B: Wire existing | 9 | 0 | 9 |
| C: Build new | 13 | 0 | 13 |
| D: Larger features | 14 | 0 | 14 |
| E: Phase 2 modules | 4 | 0 | 4 |
| F: Phase 3 modules | 4 | 0 | 4 |
| G: Admin app | 7 | 0 | 7 |
| H: Test coverage | 16 | 0 | 16 |
| **Total** | **71** | **0** | **71** |
