# Gap Backlog — Persona Journey + Navigation Audit

**Date:** 2026-05-04
**Method:** Persona-driven click-through testing + code gap analysis + Codex review
**Source:** PRD v3 (`docs/ver-3/`), 6 personas × 107 flows × 40 business rules

---

## Bugs Fixed This Session

| # | Bug | PRD Ref | Fix |
|---|-----|---------|-----|
| B1 | Dashboard "pending applications" counted `pendingPayment` members instead of actual applications | M05, CO-7 | Separate `/api/membership/applications` query |
| B2 | Roster `?status=grace` filter ignored — showed all members | M05, CP-3 | Pass URL search params to `MemberTable` via `initialStatus` prop |
| B3 | ID Card page was static placeholder — all fields showed "—" | M11, M-11 | Implemented data fetching from `/api/persons/me` + memberships |

---

## P0: Compliance Obligations (Must Build — Legal/Regulatory)

| # | Gap | PRD Flow | PRD Module | What to Build | Effort |
|---|-----|----------|------------|---------------|--------|
| 1 | Account deletion + anonymization | M-25 | M01, BR-32 | Handler + 30-day grace period + data anonymization per DPA 2012 | M |
| 2 | Data export (portability) | M-26 | M01 | Backend to generate CSV/JSON of member data per DPA portability right | M |
| 3 | Regulatory approval maintenance | SO-8 | M09 | PRC approval status tracking, expiration alerts — compliance obligation | M |
| 4 | Data breach notification workflow | PA-11 | M03 | DPA 2012 / NPC breach notification — requires admin app shell first | L |

---

## P1: Core Flows (Backend Exists, Wire Up UI)

These have working handlers — just need frontend wiring. Effort corrected by Codex.

| # | Gap | PRD Flow | PRD Module | Persona | What to Build | Effort |
|---|-----|----------|------------|---------|---------------|--------|
| 5 | Roster `?expiring=30` filter | dashboard action card | M05 | P2 | Read `expiring` search param, filter by dues expiry date | S |
| 6 | Member reinstatement UI | CS-7 | M05 | P4 | UI for existing `reinstateMembership.ts` handler | S |
| 7 | Batch dues reminders | CT-2 | M06 | P3 | UI for existing dunning + payment-link handlers | S |
| 8 | Pay dues online | M-3 | M06, BR-30 | P6 | Wire existing `pay/$token.tsx` + gateway handlers | S |
| 9 | Apply via public page | M-8 | M04, BR-29 | P6 | Wire "Apply" button on `/org/$slug` to existing `createMembershipApplication` | S |
| 10 | Transfer membership UI | M-16 | M05 | P6 | UI for existing `createAffiliationTransfer` + approval handlers | S |
| 11 | Cross-org training promotion | SO-9 | M09 | P5 | Wire existing training publish/search for cross-org visibility | S |
| 12 | Voluntary org departure | M-27 | M05 | P6 | UI for member to leave org — handler exists | S |
| 13 | Deceased member handling | CS-6 | M05 | P4 | Add "deceased" status, exclude from reminders | S |

---

## P2: Missing Flows (Need Backend + Frontend)

| # | Gap | PRD Flow | PRD Module | Persona | What to Build | Effort |
|---|-----|----------|------------|---------|---------------|--------|
| 14 | Data correction requests | CS-5 | M02 | P4 | Member requests fix → officer reviews → approve/reject | M |
| 15 | Payment correction | CT-9 | M06 | P3 | Void and re-record payment with audit trail | M |
| 16 | Payment mismatch handling | CT-8 | M06 | P3 | Accept partial, request additional, refund excess flow | M |
| 17 | Contact officer | M-18 | M07 | P6 | Direct member → officer messaging | M |
| 18 | Payment dispute | M-22 | M06 | P6 | Member flags issue → treasurer reviews | M |
| 19 | Duplicate merge request | M-21 | M01, BR-22 | P6 | Member flags duplicate → admin resolves | M |
| 20 | Society onboarding wizard | SO-6 | M04 | P5 | Training-focused setup, skip dues config | M |
| 21 | Credit correction UI | SO-12 | M10 | P5 | Officer adjusts credits with documented reason + notification | M |
| 22 | Financial report review workflow | CP-5 | M06 | P2 | Treasurer submits → president reviews/annotates/flags | M |
| 23 | Periodic report submission | CT-4 | M06 | P3 | Submit report to president for review | M |
| 24 | Invite chapter (referral) | CO-11 | M04 | P2 | Social proof referral flow — no handler exists | M |
| 25 | Meeting agenda distribution | CS-4 | M07 | P4 | Attach agenda to event, distribute as announcement | M |
| 26 | Membership reports screen | CS-3 | M05 | P4 | Totals by category, new members, growth trends | M |

---

## P3: Larger Features (Phase 1 PRD)

| # | Gap | PRD Flow | PRD Module | Persona | What to Build | Effort |
|---|-----|----------|------------|---------|---------------|--------|
| 27 | Engagement analytics | CO-12 | M05 | P2 | At-risk members, login rates, activity trends dashboard | L |
| 28 | Org benchmarking | CO-13 | M04 | P2 | Anonymized cross-chapter comparison | L |
| 29 | Support tickets | CP-4 | M03 | P2 | Officer → Platform Admin messaging system | L |
| 30 | Payment reconciliation | CT-3 | M06 | P3 | Gateway vs bank records comparison view | L |
| 31 | Officer transition checklist | CO-9, CP-7 | M04 | P2 | Structured handover with pending items + access transfer | L |
| 32 | Offline/PWA support | M-20 | M01 | P6 | Service worker, offline ID card, cached data | L |
| 33 | Society officer transition | SO-14 | M04 | P5 | Training management handover | L |
| 34 | Society configuration | SO-10 | M04 | P5 | Credit values, approval workflows, certificate templates | M |
| 35 | ID card QR code (HMAC-signed) | M-11 | M11, BR-18 | P6 | Generate verifiable QR code per BR-18 | M |
| 36 | ID card PDF download | M-11 | M11, BR-19 | P6 | PDF generation endpoint | M |
| 37 | SVG upload security | — | M04, BR-31 | P4 | Sanitize SVG org logos, strip scripts/handlers | M |
| 38 | Credit cycle + carry-over | — | M10, BR-11/12 | P5 | Per-member cycle start, configurable duration, carry-over cap | M |
| 39 | Org name on ID card | M-11 | M11 | P6 | Fetch org profile to display name instead of member number | S |
| 40 | Member directory sidebar link | M-10 | M02 | P6 | Add "Directory" link to member sidebar | S |

---

## P4: Phase 2 PRD Modules

| # | Gap | PRD Module | Status | What Remains |
|---|-----|------------|--------|-------------|
| 41 | Elections full flow | M12 | Routes + handlers exist, BR-33 tested | Voting UI, nomination eligibility (BR-34), results display |
| 42 | Professional feed | M13 | Not started | Content creation, moderation (BR-35), reporting |
| 43 | National dashboard | M14 | Not started | Cross-chapter aggregates (BR-36), small-chapter anonymization |
| 44 | Job board | M15 | Not started | Job CRUD, expiry (BR-37), applicant tracking |

---

## P5: Phase 3 PRD Modules

| # | PRD Module | Status |
|---|------------|--------|
| 45 | M16: Advertising | Not started |
| 46 | M17: Marketplace | Not started, BR-38 |
| 47 | M18: Surveys & Polls | Not started, BR-40 |
| 48 | M19: Committee Management | Not started, BR-39 |

---

## P6: Platform Admin App

Requires separate `apps/admin` app. Item 49 blocks all others.

| # | Gap | PRD Flow | What to Build |
|---|-----|----------|---------------|
| 49 | Admin app shell | PA-1 to PA-22 | Separate `apps/admin` app with platform admin sidebar |
| 50 | Org health scoring | PA-22 | Health score: login rates, payment activity, feature adoption |
| 51 | Revenue dashboard | PA-15 | MRR, ARR, ARPU, LTV, churn metrics |
| 52 | Feature flag UI | PA-17 | UI for existing `setFeatureFlag` handler |
| 53 | User impersonation UI | PA-21 | UI for existing `startImpersonation` + orange banner |
| 54 | Subscription management | PA-3 | Trial → active → suspended → cancelled lifecycle |
| 55 | Account merge | PA-9 | Deduplicate member accounts across orgs |

---

## Dependencies

```
P0 Compliance
  #4 (breach notification) → blocked by #49 (admin app shell)

P1 Core Wiring
  #8 (pay online) → requires dues config (CT-1) + gateway setup (CT-6) ✓ already exist
  #9 (apply public) → feeds into CO-7 (review applications) ✓ already works

P2 Missing Flows
  #22/#23 (report review/submission) → depends on financial reports ✓ already exist
  #15/#16 (payment correction/mismatch) → depends on payment recording ✓ already exists
  #21 (credit correction) → depends on credit tracking ✓ already exists

P3 Larger Features
  #31 (officer transition) → depends on officer term mgmt ✓ already exists
  #38 (credit cycle) → should precede #21 (credit correction)
  #34 (society config) → should precede #20 (society onboarding)

P6 Admin
  #49 (admin shell) → blocks #50-55, #4
  #54 (subscriptions) → should precede #51 (revenue dashboard)
```

---

## Untested Handlers (Need Tests)

| Handler | Module | Risk |
|---------|--------|------|
| `approveMembershipApplication` | membership | Core approval — if broken, no new members |
| `denyMembershipApplication` | membership | Rejection flow |
| `recordManualPayment` | dues | Treasurer daily action |
| `createOfficerTerm` | membership | Governance |
| `updateOfficerTerm` | membership | Governance |
| `terminateMembership` | membership | Irreversible action |
| `reinstateMembership` | membership | Recovery flow |
| `voidInvoice` | dues | Financial correction |
| `createInvite` / `claimInvite` | invite | Member onboarding |
| `updateDuesConfig` | dues | Configuration change |
| `transitionOrgStatus` | platformadmin | Org lifecycle |
| `startImpersonation` / `endImpersonation` | platformadmin | Security-sensitive |
| `generateDuesInvoicesForOrg` | dues | Batch operation |
| `searchDirectory` | membership | Member search |
| All handlers in `audit/` | audit | Zero test files |
| All handlers in `email/` | email | Zero test files |

---

## Summary

| Priority | Items | Description |
|----------|-------|-------------|
| Bugs fixed | 3 | Done this session |
| P0: Compliance | 4 | DPA obligations — account deletion, data export, breach notification, regulatory |
| P1: Wire existing | 9 | Backend exists, need frontend — mostly S effort |
| P2: Build new | 13 | Need backend + frontend — M effort |
| P3: Larger features | 14 | Phase 1 PRD, significant work — M/L effort |
| P4: Phase 2 modules | 4 | Elections, feed, national dashboard, jobs |
| P5: Phase 3 modules | 4 | Advertising, marketplace, surveys, committees |
| P6: Platform admin | 7 | Needs separate app |
| Untested handlers | 16 | Need test coverage |
| **Total gaps** | **74** | |
