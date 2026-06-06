# 06 — Role-Based Journey Map Audit

**Date:** 2026-05-26
**Scope:** End-to-end user journeys per role, tracing routes → UI → API → outcomes
**Mode:** Read-only audit. No code modifications.
**Sources:** All prior audit findings (01-06) + codebase exploration

---

## 1. Journey Registry

### Member Journeys

| Journey | Role | Start Route | End State | Routes | APIs | Criticality | Test Coverage |
|---------|------|------------|-----------|--------|------|-------------|---------------|
| Sign up + onboard | Guest → Member | `/auth/sign-up` | Logged in, profile complete | auth → onboarding → dashboard | Better-Auth, `POST /api/persons` | CRITICAL | ✓ `auth.spec.ts` |
| Join organization | Member | `/my/organizations` | Org member | org picker → org home | `POST /api/membership/apply` | CRITICAL | NONE |
| Pay dues (online) | Member | `/org/:slug/dues` | Payment recorded | dues page → payment → confirmation | `POST /api/dues/payments` | CRITICAL | NONE |
| Pay dues (proof upload) | Member | `/org/:slug/dues` | Proof submitted | dues page → upload form → submit | `POST /api/storage`, `POST /api/dues/proof` | CRITICAL | NONE |
| Browse + register for event | Member | `/org/:slug/events` | Registered | event list → detail → register | `POST /api/events/:id/register` | CRITICAL | Partial (`member/events.spec.ts`) |
| Enroll in training | Member | `/org/:slug/training` | Enrolled | training list → detail → enroll | `POST /api/training/:id/enroll` | IMPORTANT | Partial (`training-browse.spec.ts`) |
| Complete training → get credit | Member | training detail | Credit issued | complete → credit awarded | Backend job | IMPORTANT | NONE |
| View certificates | Member | `/my/certificates` | Certificate viewed | cert list → detail → download | `GET /api/certificates/:id` | SECONDARY | NONE |
| Vote in election | Member | `/org/:slug/elections` | Vote recorded | election list → detail → ballot → confirm | `POST /api/elections/:id/vote` | CRITICAL | NONE |
| Self-nominate | Member | `/org/:slug/elections/:id` | Nomination recorded | election detail → dialog → confirm | `POST /api/elections/:id/nominate` | IMPORTANT | NONE |
| Send direct message | Member | `/org/:slug/messages/dm` | Message delivered | DM list → compose → send | WebSocket | IMPORTANT | NONE `[NEEDS MANUAL CONFIRMATION]` |
| Read announcement | Member | `/org/:slug/announcements` | Read confirmed | list → detail | `GET /api/announcements/:id` | SECONDARY | NONE |
| Browse directory | Member | `/org/:slug/directory` | Profile viewed | directory → member detail | `GET /api/membership/members` | SECONDARY | NONE |
| Track CPD credits | Member | `/org/:slug/my-cpd` | Credits viewed | CPD page | `GET /api/credit-compliance` | IMPORTANT | NONE |
| Export personal data | Member | `/my/data-export` | Download received | export page → request → download | `GET /api/persons/me/export` | IMPORTANT | ✓ `data-export.spec.ts` |
| Complete NPS survey | Member | Any page (modal) | Rating submitted | NPS modal → score → submit | `POST /api/reviews` | SECONDARY | NONE |
| Complete survey | Member | `/my/surveys/:id` | Response recorded | survey list → survey → submit | `POST /api/surveys/:id/response` | SECONDARY | NONE |

### Officer Journeys

| Journey | Role | Start Route | End State | Routes | APIs | Criticality | Test Coverage |
|---------|------|------------|-----------|--------|------|-------------|---------------|
| View dashboard | Any officer | `/org/:slug/officer/dashboard` | KPIs viewed | dashboard | Multiple GETs | IMPORTANT | ✓ `role-boundaries.spec.ts` (access only) |
| Manage roster | Secretary/President | `/org/:slug/officer/roster` | Members managed | roster list → member detail | `GET/POST/PATCH /api/membership/members` | CRITICAL | NONE |
| Import members | Secretary/President | `/org/:slug/officer/roster/import` | Members imported | import page → upload → confirm | `POST /api/membership/import` | IMPORTANT | NONE |
| Review applications | Secretary/President | `/org/:slug/officer/applications` | Applications processed | list → approve/reject | `PATCH /api/membership/applications/:id` | CRITICAL | NONE |
| Bulk approve applications | Secretary/President | Same | Batch approved | select → bulk approve | `POST /api/association/member/applications/bulk-approve` | IMPORTANT | NONE |
| Record payment | Treasurer/President | `/org/:slug/officer/finances` | Payment recorded | finances → record form → submit | `POST /api/dues/payments/record` | CRITICAL | NONE |
| Issue refund | Treasurer/President | `/org/:slug/officer/finances` | Refund processed | finances → refund form → confirm | `POST /api/dues/refunds` | CRITICAL | NONE |
| Create assessment | Treasurer/President | `/org/:slug/officer/finances/assessments` | Assessment created | assessments → form → submit | `POST /api/dues/assessments` | IMPORTANT | NONE |
| Create event | Society Officer/President | `/org/:slug/officer/events` | Event published | events → new → form → publish | `POST /api/events` | CRITICAL | NONE |
| Create training | Society Officer/President | `/org/:slug/officer/training` | Training published | training → new → form → publish | `POST /api/training` | CRITICAL | NONE |
| Mark attendance | Society Officer/President | `/org/:slug/officer/training/:id/attendance` | Attendance recorded | training detail → attendance → checkboxes | `POST /api/training/:id/attendance` | IMPORTANT | NONE |
| Send announcement | Secretary/President | `/org/:slug/officer/communications/new` | Announcement sent | comms → compose → send/schedule | `POST /api/announcements` | CRITICAL | NONE |
| Create election | President | `/org/:slug/officer/elections/new` | Election created | elections → wizard → create | `POST /api/elections` | CRITICAL | NONE |
| Run election lifecycle | President | `/org/:slug/officer/elections/:id` | Results certified | open nominations → open voting → close → certify | Multiple PATCHes | CRITICAL | NONE |
| Assign officer role | President | `/org/:slug/officer/officers` | Role assigned | officers → dialog → select → confirm | `POST /api/association/member/officer-terms` | CRITICAL | NONE |
| Remove officer | President | Same | Role removed | officers → confirm → remove | `DELETE /api/association/member/officer-terms/:id` | CRITICAL | NONE |
| Configure org settings | Any officer | `/org/:slug/officer/settings/*` | Settings saved | settings pages → forms → save | Various PUT endpoints | IMPORTANT | ✓ `settings.spec.ts` |

### Admin Journeys

| Journey | Role | Start Route | End State | Routes | APIs | Criticality | Test Coverage |
|---------|------|------------|-----------|--------|------|-------------|---------------|
| View platform dashboard | super/support/analyst | `/` | Stats viewed | dashboard | Multiple GETs | IMPORTANT | ✓ `admin-smoke.spec.ts` |
| Manage organizations | super/support | `/organizations` | Org managed | list → detail | `GET/PUT /api/organizations` | IMPORTANT | ✓ `organizations.spec.ts` |
| Manage associations | super/support | `/associations` | Assoc managed | list → detail | `GET/PUT /api/associations` | IMPORTANT | ✓ `associations.spec.ts` |
| View audit logs | super/support | `/audit` | Logs viewed | audit page | `GET /api/audit-logs` | IMPORTANT | ✓ `audit.spec.ts` |
| Impersonate user | super | `/impersonate` | Impersonating | select user → start | `POST /api/admin/impersonate` | CRITICAL | NONE |
| Manage operators | super | `/operators` | Operator managed | list → invite/revoke | `POST/DELETE /api/admins` | CRITICAL | NONE |
| Toggle feature flags | super | `/feature-flags` | Flag toggled | list → toggle/delete | `PATCH/DELETE /api/feature-flags` | IMPORTANT | NONE |
| View members cross-org | super/support/analyst | `/members` | Member viewed | list → detail | `GET /api/persons` | SECONDARY | ✓ `members.spec.ts` |

---

## 2. Broken Journey Report

| ID | Journey | Role | Broken Step | Severity | Evidence | Impact |
|----|---------|------|------------|----------|----------|--------|
| BJ-01 | Revoke event credits | Officer | `POST /api/association/member/credits/void-event` — endpoint missing | P0 | CD-01 from Audit 06 | Cannot revoke credits after event cancellation |
| BJ-02 | Officer reviews page | Officers | `/org/:slug/officer/reviews` — route file missing | P1 | BN-01 from Audit 03 | Sidebar link leads to 404 |
| BJ-03 | VP/board-member/staff officer nav | VP, board, staff | POSITION_NAV_CONFIG has no entry | P1 | PG-02/03/04 from Audit 02 | These officers see empty sidebar after login |
| BJ-04 | Generic officer nav | Officer (tier 5) | POSITION_NAV_CONFIG has no `officer` key | P1 | PG-08 from Audit 02 | Generic officers see empty sidebar |
| BJ-05 | Admin impersonation | super | Feature exists in backend but admin E2E untested | P1 | No E2E coverage | Cannot verify impersonation works |
| BJ-06 | Admin operator management | super | Feature exists but untested | P1 | No E2E coverage | Cannot verify operator CRUD works |
| BJ-07 | Analyst direct URL access | analyst | ROUTE_ROLES not enforced in route guards | P1 | PG-06 from Audit 02 | Analyst can navigate to `/operators` directly |
| BJ-08 | Lapsed member access | Lapsed member | No membership status check on routes | P1 | PG-01 from Audit 02 | Lapsed members access active-only features `[NEEDS PRODUCT DECISION]` |
| BJ-09 | Training detail → credits | Member | Training detail page untested | P1 | No E2E for detail page | Cannot verify enrollment → completion → credit flow |
| BJ-10 | Certificate download | Member | Certificate detail page untested | P2 | No E2E coverage | Cannot verify download works |
| BJ-11 | Election voting E2E | Member | No E2E test for voting flow | P1 | Critical journey untested | Cannot verify voting works in browser |
| BJ-12 | Dues payment E2E | Member | No E2E test for payment flow | P1 | Critical journey untested | Cannot verify payment works in browser |
| BJ-13 | DM messaging | Member | WebSocket implementation unclear | P2 | `[NEEDS MANUAL CONFIRMATION]` | May be incomplete |

---

## 3. Journey Test Matrix

### Critical Journeys — Test Needs

| Journey | E2E Test | API Integration | Permission Test | State Machine | Priority |
|---------|---------|----------------|----------------|---------------|----------|
| Pay dues | NEEDED | NEEDED | ✓ Existing | NEEDED (invoice → paid) | P1 |
| Vote in election | NEEDED | NEEDED | Partial | NEEDED (nom → voting → closed) | P1 |
| Record payment (officer) | NEEDED | NEEDED | ✓ Position test | NEEDED | P1 |
| Issue refund (officer) | NEEDED | NEEDED | ✓ Position test | NEEDED | P1 |
| Create event | NEEDED | NEEDED | Partial | NEEDED (draft → published) | P1 |
| Send announcement | NEEDED | NEEDED | Partial | N/A | P1 |
| Create election | NEEDED | NEEDED | ✓ Position test | NEEDED (full lifecycle) | P1 |
| Assign/remove officer | NEEDED | NEEDED | NEEDED | N/A | P1 |
| Import members | NEEDED | NEEDED | NEEDED | N/A | P1 |
| Manage applications | NEEDED | NEEDED | NEEDED | NEEDED (submitted → approved) | P1 |
| Impersonate user | NEEDED | NEEDED | NEEDED | NEEDED (start → end) | P1 |
| Manage operators | NEEDED | NEEDED | NEEDED | N/A | P1 |
| Training enrollment + credit | NEEDED | NEEDED | N/A | NEEDED (enroll → complete → credit) | P1 |
| Browse/register event (member) | ✓ Partial | NEEDED | N/A | N/A | P2 |
| Configure org settings | ✓ Partial | NEEDED | ✓ Existing | N/A | P2 |

---

## Gate Evaluation: Audit 07

| Criterion | Status |
|-----------|--------|
| Roles identified | PASS |
| Key journeys per role mapped | PASS |
| Journey steps traced (routes, UI, API) | PASS |
| Broken journeys identified | PASS |
| Criticality classified | PASS |
| Test needs documented | PASS |

**Gate Result: PASS**
