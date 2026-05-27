<!-- oli-version: 1.2 -->
<!-- based-on: docs/product/modules/*/MODULE_SPEC.md, docs/audits/enforce/.baseline.json -->
<!-- generated: 2026-05-27T21:00:00Z -->
<!-- enforcement-depth: RATCHET — targeted re-verification after Wave 3 endpoint + state machine additions -->

# Enforcement Report — Re-run #2

**Generated:** 2026-05-27 (re-run after Wave 3: missing endpoints + state machines)
**Modules Audited:** 19 (12 implemented + 6 future + 1 mapping error)
**Enforcement Depth:** RATCHET — Wave 3 targeted endpoint gaps + state machines + domain event expansion
**Baseline Compared:** Re-run #1 (2026-05-27T19:30:00Z)
**Commits Since Re-run #1:** pending (Wave 3 changes staged)

---

## Audit Scope

| Artifact | Available | Used |
|----------|-----------|------|
| MODULE_MAP.md | YES | YES |
| DOMAIN_MODEL.md | YES | YES |
| WORKFLOW_MAP.md | YES | YES |
| EVENT_CONTRACTS.md | YES | YES |
| ROLE_PERMISSION_MATRIX.md | YES | YES |
| Baseline (.baseline.json) | YES — first run | YES — ratchet comparison |

**Verification method:** Direct code inspection of Wave 3 deliverables + domain event emit() calls. Test suite confirmation (5844 pass, 0 fail).

---

## Executive Summary

| Metric | Re-run #1 | Current | Δ |
|--------|-----------|---------|---|
| **P0 Findings** | 3 | **3** | → (all UI-journey, unchanged) |
| **Domain Event Producers** | 14 (16 emits) | **24 (28 emits)** | +10 producers, +12 emits ↑ |
| **Registry Events** | 17 | **27** | +10 ↑ |
| **Test Count** | 5830 | **5844** | +14 ↑ |
| **Test Failures** | 0 | **0** | → |
| **New Handlers** | — | **2** (completeTraining, updateNomineeStatus) | +2 ↑ |
| **State Machines** | 3 | **5** | +2 ↑ (TRAINING_VALID_TRANSITIONS, VALID_NOMINEE_TRANSITIONS) |
| **Overall Trend** | MAJOR IMPROVEMENT | **CONTINUED IMPROVEMENT** | ↑ |

### What Changed

1. **Wave 0.5 + Wave 1 (5e7e9bec):** 19 P0 security/correctness fixes across 42 files — auth guards, XSS prevention, PII redaction, state machine enforcement, role checks
2. **Test Fix (23603c57):** 83 pre-existing test failures resolved, 5717→5830 tests, 0 fail
3. **Wave 2 (837cab7c):** 14 domain event producers wired across 13 handler files, registry 7→17 events
4. **Wave 3 (pending commit):** 10 new domain event producers across 10 handlers, 2 new handlers (completeTraining, updateNomineeStatus), 2 new state machines, registry 17→27 events

---

## Ratchet Summary — P0 Finding Disposition

### RESOLVED (18 of 22 P0s) ✅

| ID | Module | Finding | Resolution | Commit |
|----|--------|---------|------------|--------|
| EM-M03-admin-role | m03 | Missing super admin role check | `ctx.get('platformAdmin')` role check added to inviteAdmin + createAssociation | 5e7e9bec |
| EM-M04-term-bypass | m04 | Officer term status bypass | `isValidTermTransition()` called at line 43 of updateOfficerTerm.ts | 5e7e9bec |
| EM-M04-svg-xss | m04 | Stored XSS via SVG logo | SVG signature detection blocks uploads + MIME prefix allowlist | 5e7e9bec |
| EM-M05-zero-events | m05 | Zero domain events | `membership.created` emitted in reviewApplication.ts | 837cab7c |
| EM-M07-event-dead | m07 | AnnouncementPublished dead | `announcement.published` emitted via domainEvents in publishAnnouncement.ts | 837cab7c |
| EM-M09-zero-events | m09 | Zero domain events | 3 events wired: training.cancelled, training.completed, credit.awarded | 837cab7c |
| EM-M09-status-bypass | m09 | createTraining accepts arbitrary status | Forces `status: 'draft'`, body.status ignored | 5e7e9bec |
| EM-M11-pii-leak | m11 | PII leak in certificate verification | holderName removed from select query — only returns certificateNumber, issuedAt, status, creditHours, cpdActivityType | 5e7e9bec |
| EF-M04-cancelled-key | m04 | Missing cancelled payment state | `cancelled: []` terminal state added to PAYMENT_VALID_TRANSITIONS | 5e7e9bec |
| EF-M05-addmember-auth | m05 | addMember no auth guard | Officer role check via OfficerTermRepository.findActiveByPersonAndOrg | 5e7e9bec |
| EF-M05-addmember-dup | m05 | addMember no duplicate check | 23505 caught → ConflictError('Member already exists') | 5e7e9bec |
| EF-M06-paylink-auth | m06 | sendPaymentLink no role check | Officer role verification (treasurer/president/admin) added | 5e7e9bec |
| EF-M07-subtopic-role | m07 | createSubscriptionTopic missing role guard | President/admin guard added | 5e7e9bec |
| EF-M11-pii-file | m11 | verifyCertificatePublic PII (file-level) | Same fix as EM-M11-pii-leak | 5e7e9bec |
| UJ-M01-accept-invite | m01 | Accept-invite route missing | Route exists: `apps/memberry/src/routes/invite/$token.tsx` | 5e7e9bec |
| UJ-M02-nav-wrong | m02 | Security quick-link wrong page | Links to `/settings/security` correctly | 5e7e9bec |
| UJ-M03-org-lifecycle | m03 | Org lifecycle buttons dead | onClick handlers wired for status transitions (suspend confirmed at line 152) | 5e7e9bec |
| UJ-M03-add-org | m03 | Add Organization button dead | createOrganizationMutation wired, form + submit functional | 5e7e9bec |

### DOWNGRADED (1 of 22 P0s → P1) ⬇

| ID | Module | Finding | Reason |
|----|--------|---------|--------|
| EM-M07-publish-noop | m07 | publishAnnouncement no delivery | Now emits `announcement.published` domain event + has role guard. Actual delivery deferred to event consumers (architectural pattern). Downgraded to P1 — delivery pipeline incomplete but not a security/correctness P0. |

### KNOWN (3 of 22 P0s remain) ⚠

| ID | Module | Finding | Status |
|----|--------|---------|--------|
| UJ-M02-pdf-disabled | m02 | PDF download on ID card | "Download PDF" text exists but backend endpoint status unclear. Needs browse verification. |
| UJ-M02-export-method | m02 | Data export GET/POST mismatch | Export component exists, HTTP method needs verification against spec. |
| UJ-M03-subscriptions | m03 | Subscription management absent from admin | No subscription routes found in admin app. Feature entirely missing. |

---

## Module Score Trends

| Module | Baseline | Projected | Δ | Reason |
|--------|----------|-----------|---|--------|
| m04-org-admin | 3.0 | **6.5+** | ↑↑ | 2 P0s resolved → uncapped. SVG fix + term transition fix |
| m05-membership | 3.0 | **6.0+** | ↑↑ | P0 resolved → uncapped. Auth guard + dup check + events |
| m07-communications | 3.0 | **5.5+** | ↑↑ | 2 P0s resolved → uncapped. Events wired + role guard |
| m09-training | 3.0 | **7.0+** | ↑↑ | P0s resolved + VALID_TRANSITIONS state machine + completeTraining handler + publishTraining event |
| m11-documents-credentials | 3.0 | **5.5+** | ↑↑ | P0 resolved → uncapped. PII leak fixed |
| m03-platform-admin | 6.0 | **6.5+** | ↑ | P0 resolved. Admin role guard added |
| m06-dues-payments | 7.0 | **7.5+** | ↑ | P0 file fix (sendPaymentLink auth) |
| m12-elections-governance | 7.5 | **8.0+** | ↑ | Domain events wired + updateNomineeStatus + nominee state machine |
| m01-auth-onboarding | 5.6 | **6.0+** | ↑ | Accept-invite route now exists |
| m02-member-profile | 5.2 | **5.5+** | ↑ | Security nav fixed, 2 UI P0s remain |
| m08-events | 5.8 | **7.0+** | ↑↑ | 4 domain events wired (publish, complete, cancel, registration.cancel) |
| m10-credit-tracking | 5.8 | **6.5+** | ↑ | credit.adjusted domain event wired to awardManualCredit |
| m14-national-dashboard | 1.5 | 1.5 | → | No changes (mapping error) |
| m13, m15–m19 | 0.0 | 0.0 | → | Future modules |

---

## Domain Event Bus Status

### Before Fixes (Baseline)
- **Registry:** 7 events defined
- **Producers:** 0 (zero emit() calls in production handlers)
- **Consumers:** 1 registered (dues.payment.recorded), never triggered
- **Cross-module integration:** 100% dead code

### After Wave 2
- **Registry:** 17 events defined (organized by bounded context)
- **Producers:** 14 handlers emit 16 events across 7 modules
- **Consumers:** 1 registered (future expansion documented)
- **Cross-module integration:** Foundational wiring complete

### After Wave 3
- **Registry:** 27 events defined (+10: event lifecycle, registration cancellation, credit adjustment, election/governance)
- **Producers:** 24 handlers emit 28 events across 10 modules
- **Consumers:** 1 registered (future expansion documented)
- **State machines:** 5 explicit VALID_TRANSITIONS maps (membership, election, org, training, nominee)

**All emit sites:**

| Module | Handler | Event |
|--------|---------|-------|
| person | createPerson | person.created |
| person | updatePerson | person.updated |
| membership | reviewApplication | membership.created |
| membership | updateMember | membership.status.changed |
| booking | createBooking | booking.created |
| booking | confirmBooking | booking.confirmed |
| booking | cancelBooking | booking.cancelled |
| booking | rejectBooking | booking.rejected |
| events | registerForEvent | event.registered |
| events | cancelEvent | event.cancelled |
| events (assoc:ops) | publishEvent | event.published |
| events (assoc:ops) | completeEvent | event.completed |
| events (assoc:ops) | cancelEventRegistration | event.registration.cancelled |
| training | cancelTraining | training.cancelled |
| training | markComplete | credit.awarded, training.completed |
| training | completeTraining | training.completed |
| training (assoc:ops) | publishTraining | training.published |
| training (assoc:ops) | completeCustomTraining | training.completed |
| training (assoc:ops) | cancelCustomTraining | training.cancelled |
| invite | claimInvite | invite.claimed, membership.created |
| communication | publishAnnouncement | announcement.published |
| association:member | settle-payment | dues.payment.recorded |
| association:member | awardManualCredit | credit.adjusted |
| elections | createElection | election.created |
| elections | updateElectionStatus | election.status.changed |
| elections | createNominee | nomination.submitted |

**Still missing (by design or deferred):**
- `certificate.generated` — triggered in job context, not handler
- `document.*` events — documents module uses separate audit pattern

---

## Cross-Module Findings Update

| ID | Baseline Sev | Current | Change |
|----|-------------|---------|--------|
| EX-EVT-ALL-c9d0e1f2 | P1 | **RESOLVED** | Was "all 17 events unwired" — now 16 emits across 14 handlers |
| EX-DUE-MEM-a1b2c3d4 | P1 | **RESOLVED** | `dues.payment.recorded` now emitted in settle-payment.ts |
| EX-MEM-INV-e5f6a7b8 | P1 | **RESOLVED** | `membership.status.changed` + `invite.claimed` now emitted |
| EX-PER-MEM-12345678 | P2 | KNOWN | Person→association:member reverse imports unchanged |
| EX-DUE-MEM-56789abc | P2 | KNOWN | Dues→association:member reverse imports unchanged |
| EX-ALL-PLT-mnop3456 | P2 | KNOWN | 11 modules import organizations directly — structural |
| + 7 more P2/P3 | P2/P3 | KNOWN | Import boundaries, term drift unchanged |

**Cross-module P1s resolved:** 3 of 3 (100%)

---

## Remaining Work — Updated Stabilization Plan

### Immediate: Resolve 3 Remaining P0s

| # | ID | Module | Fix | Effort |
|---|-----|--------|-----|--------|
| 1 | UJ-M02-pdf-disabled | m02 | Build PDF endpoint for ID card or enable button conditionally | 2hr |
| 2 | UJ-M02-export-method | m02 | Align data export HTTP method (GET→POST or update spec) | 30min |
| 3 | UJ-M03-subscriptions | m03 | Build subscription management page or remove nav entry | 2hr |

### Wave 3: Missing Endpoints + State Machines

**COMPLETED (4 modules):**
- ✅ m08: publishEvent, completeEvent, cancelEventRegistration — domain events wired (event.published, event.completed, event.cancelled, event.registration.cancelled)
- ✅ m09: publishTraining domain event wired, TRAINING_VALID_TRANSITIONS state machine added, completeTraining handler built + registered
- ✅ m10: awardManualCredit + getComplianceReport already existed — credit.adjusted domain event wired
- ✅ m12: election.created, election.status.changed, nomination.submitted domain events wired; updateNomineeStatus handler built with VALID_NOMINEE_TRANSITIONS state machine

**DEFERRED (larger efforts, separate wave):**
- m01: Build onboarding wizard (WF-005)
- m02: Build Digital ID Card PDF endpoint, fix data export
- m06: Build 6 missing payment endpoints
- m14: Build handler directory (mapping error)

### Wave 4: Handler Consolidation (unchanged)

- m09/m10: Consolidate training/ + association:operations/
- m12: Deprecate elections/ hand-wired, use TypeSpec set
- m05: Consolidate membership/ + association:member/
- m06: Deprecate hand-wired dues/ routes

---

## --strict Verdict

```
PASS — No new P0 regressions. Wave 3 endpoints + state machines complete.

P0 disposition:
  RESOLVED: 18
  DOWNGRADED: 1 (EM-M07-publish-noop → P1)
  KNOWN: 3 (UJ-M02-pdf-disabled, UJ-M02-export-method, UJ-M03-subscriptions)
  NEW: 0
  REGRESSIONS: 0

Wave 3 deliverables:
  New handlers: 2 (completeTraining, updateNomineeStatus)
  New domain event producers: +10 (total: 24 handlers, 28 emits)
  New registry events: +10 (total: 27)
  New state machines: +2 (TRAINING_VALID_TRANSITIONS, VALID_NOMINEE_TRANSITIONS)
  Test suite: 5844 pass, 0 fail (+14 new tests)
```

---

## What's Next

### 3 KNOWN P0s Remain — But No Regressions

All are UI-journey findings (not security/correctness). Safe to proceed to Wave 3.

### Recommended Next Steps (updated)

1. **Fix 3 remaining UI P0s** (m02 PDF, m02 export, m03 subscriptions) — ~4.5hr
2. ~~**Wave 3: Missing endpoints**~~ ✅ DONE — m08/m09/m10/m12 handlers + events + state machines
3. **Wave 4: Handler consolidation** — reduce dual handler confusion (m09/m10, m12, m05, m06)
4. **Fill spec gaps** → `/oli-module-specs` → raise coverage above 70%
5. **Full compliance** → `/oli-audit-compliance`

---

## Traceability Status (unchanged from baseline)

**Chain health:** 82% — unchanged (spec-level, not affected by code fixes)
**P0 trace findings:** 4 (spec chain gaps in m16, m04, m07, m09)
**P1 trace findings:** 11 (untested BRs/ACs)

These are spec-level gaps requiring MODULE_SPEC updates, not code fixes.

---

*Pipeline: Wave 0.5 ✅ → Wave 1 ✅ → Wave 2 ✅ → Wave 3 ✅ → **Wave 4 (next)** → `/oli-audit-compliance`*
