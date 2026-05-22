# Compliance Fix Plan — Cycle 4 Full Resolution

**Created:** 2026-05-22
**Baseline:** 6.8/10 → 9/10 P0s fixed → ~7.8/10
**Target:** 9.0+ / 10
**Approach:** Wave-based, commit after each wave, test continuously

---

## Wave 1: Last P0 + Score Boosters (~4h)
**Impact:** 7.8 → 8.2

### W1-1: Impersonation write-block middleware (P0)
**Root cause:** Impersonation session stored in DB but not propagated to Hono context. No middleware can detect it.
**Fix:**
1. Add `impersonationSession` to `types/app.ts` Variables type
2. In `middleware/auth.ts`: after session validation, check for `X-Impersonation-Token` header → query `ImpersonationSessionRepository` → populate context
3. Add write-block middleware: if impersonationSession set AND method is POST/PUT/PATCH/DELETE → 403
4. Wire middleware in `app.ts` after auth middleware
**Files:** `types/app.ts`, `middleware/auth.ts`, `middleware/impersonation-guard.ts` (new), `app.ts`
**Tests:** Token resolution, write block, GET allowed, expired token rejected
**Verify:** `bun test -- --bail impersonation`

### W1-2: Org-context false positive verification
**Root cause:** Audit flagged 44 "missing x-org-id headers" but org-context middleware has 4 fallback layers.
**Fix:** Document that path param + query param fallbacks cover these calls. Update compliance report Dim 16 → 8.0.
**Files:** `docs/audits/COMPLIANCE_REPORT.md`
**Tests:** None needed (verification only)
**Verify:** Read `middleware/org-context.ts`, confirm fallback chain

### W1-3: Frontend error feedback (10 mutations)
**Root cause:** Mutations missing `onError` callback — user gets no signal on failure.
**Fix:** Add `onError: (error) => toast.error(error.message || 'Operation failed')` to each mutation.
**Files:**
- `apps/memberry/src/features/dues/components/dues-invoice-list.tsx`
- `apps/memberry/src/features/training/components/training-form.tsx`
- `apps/memberry/src/features/training/components/training-list.tsx`
- `apps/memberry/src/features/events/components/event-list.tsx`
- `apps/memberry/src/features/events/components/event-form.tsx` (2 mutations)
- `apps/memberry/src/routes/_authenticated/org/$orgId/officer/communications/$announcementId.tsx` (2 mutations)
- `apps/memberry/src/routes/onboarding.tsx` (2 mutations)
**Tests:** Not unit-testable (toast is side effect). Verify visually or via E2E.
**Verify:** Check each file has `onError` on all `useMutation` hooks

---

## Wave 2: P1 Handler Gaps + BR Enforcement (~8h)
**Impact:** 8.2 → 8.5

### W2-1: Missing event handler — completeEvent
**Root cause:** No handler transitions events to "completed" state.
**Fix:** Create `association:operations/completeEvent.ts` following `cancelEvent.ts` pattern.
- Validate status is 'active' or 'published'
- Transition to 'completed'
- Add `requireOfficerTerm` guard
- Audit log
**Files:** `handlers/association:operations/completeEvent.ts` (new), `repos/events.repo.ts` (add complete method), `routes.ts` or `app.ts` (register route)
**Tests:** Happy path, invalid status rejected, non-officer rejected, audit logged
**Verify:** `bun test -- --bail completeEvent`

### W2-2: BR-11 credit cycle configurable
**Root cause:** `markComplete.ts:69` hardcodes `2` year cycle.
**Fix:** Read `creditCycleYears` from org configuration (dues config or org settings). Default to 2.
**Files:** `handlers/training/markComplete.ts`
**Tests:** Test with 1yr, 2yr, 3yr cycle configs
**Verify:** `bun test -- --bail markComplete`

### W2-3: BR-02 grace period org-configurable
**Root cause:** `gracePeriodDays` field exists in schema with DEFAULT(30) but no org-level override UI.
**Fix:** Ensure `getDuesConfig` handler returns org-specific grace period. `computeMembershipStatus` already accepts `gracePeriodDays` param — just need to pass the org value.
**Files:** `handlers/association:member/utils/compute-membership-status.ts` (verify), `handlers/dues/getDuesConfig.ts` (verify)
**Tests:** Test with 0, 30, 90 day grace periods
**Verify:** `bun test -- --bail gracePeriod`

### W2-4: Announcement state machine — archiveAnnouncement only from 'sent'
**Status:** Already fixed in P0 commit. Verified.

### W2-5: castVote voter eligibility
**Status:** Already fixed in P0 commit. BR-33 enforced.

### W2-6: updateElectionStatus auth
**Status:** Already fixed in P0 commit. President required.

### W2-7: M7-R3 scheduled message processor
**Root cause:** No cron/job processes scheduled messages.
**Fix:** This is a larger feature — defer to Wave 4 if it's not blocking the score target.
**Decision:** DEFER to Wave 4 (does not directly affect compliance dimensions)

---

## Wave 3: Phase C Module Stubs (~12h)
**Impact:** 8.5 → 8.8

Build proper schema + handlers + tests for Phase C modules. Not throwaway stubs — properly integrated foundations following existing patterns.

### W3-1: M19 Committee Management — API handlers
**What exists:** Schema (committee + task tables), repos (CommitteeRepository, CommitteeTaskRepository), tests
**What's missing:** Handler files connecting repos to HTTP routes
**Fix:** Create 8 handlers following existing patterns (e.g., createEvent.ts):
- createCommittee, getCommittee, listCommittees, updateCommittee, dissolveCommittee
- createCommitteeTask, updateCommitteeTask, completeCommitteeTask
- Register routes in `app.ts`
**Tests:** CRUD happy paths, officer auth, dissolution preserves data
**Verify:** `bun test -- --bail committee`

### W3-2: M13 Professional Feed — schema + handlers
**What exists:** Tests only
**What's missing:** Everything
**Fix:** Create following industry feed patterns:
- Schema: `feed-post.schema.ts` (post, post_reaction, post_report, muted_author)
- Repo: `FeedPostRepository` (CRUD + pagination + visibility filtering)
- Handlers: createPost, listPosts, getPost, deletePost, reportPost, muteAuthor
- BR-35: Auto-hide after N reports
- M13-R1: Read-only for non-active members
**Tests:** CRUD, visibility scoping, report threshold, mute behavior
**Verify:** `bun test -- --bail feed`

### W3-3: M14 National Dashboard — schema + handlers
**What exists:** Tests only
**What's missing:** Schema + handlers
**Fix:** Create aggregation pattern:
- Schema: `dashboard-snapshot.schema.ts` (chapter_snapshot, org_metrics view)
- Repo: `DashboardRepository` (aggregation queries)
- Handlers: getNationalDashboard, exportDashboardReport
- BR-36: Scoped to own association
- M14-R2: Suppress individual metrics for chapters <5 members
**Tests:** Aggregation accuracy, access scoping, privacy suppression
**Verify:** `bun test -- --bail dashboard`

### W3-4: M18 Surveys & Polls — schema + handlers
**What exists:** Tests only
**What's missing:** Everything
**Fix:** Create survey engine:
- Schema: `survey.schema.ts` (survey, question, response, poll)
- Repo: `SurveyRepository`, `PollRepository`
- Handlers: createSurvey, submitResponse, getResults, listSurveys, createPoll, votePoll
- M18-R1: Anonymous survey hides respondent
- M18-R2: Deadline enforcement
- M18-R5: Minimum response threshold
**Tests:** CRUD, anonymity, deadline, threshold
**Verify:** `bun test -- --bail survey`

---

## Wave 4: Audit Logging Typed Events (~6h)
**Impact:** 8.8 → 9.0

### W4-1: Typed audit event mapper
**Root cause:** 40/41 audit contract events use generic types instead of specific event categories.
**Fix:**
1. Create `utils/audit-events.ts` with typed event map
2. Add `eventSubType` field to audit schema (preserving existing generic eventType)
3. Update `auditAction()` to accept typed event name
4. Update key handlers to pass specific event types:
   - Payment handlers → `financial.payment-recorded`
   - Election handlers → `governance.vote-cast`
   - Certificate handlers → `content.certificate-generated`
   - Auth handlers → `authentication.session-created`
**Files:** `utils/audit-events.ts` (new), `handlers/audit/repos/audit.schema.ts`, `utils/audit.ts`, ~15 handler files
**Tests:** Event type validation, schema migration, handler audit events
**Verify:** `bun test -- --bail audit`

---

## Wave 5: AC Test Coverage (~8h)
**Impact:** 9.0 → 9.2+

### W5-1: Write missing acceptance criteria tests
Focus on highest-impact untested ACs:
- AC-M07-001 through AC-M07-006 (communications)
- AC-M08-001 through AC-M08-006 (events)
- AC-M09-002, AC-M09-004 through AC-M09-006 (training)
- AC-M10-001, AC-M10-003 through AC-M10-005 (credit tracking)

Each test follows Given/When/Then from MODULE_SPEC.md Section 11.

---

## Score Projection

| Wave | Score | Delta | Key Dimensions |
|------|-------|-------|----------------|
| Before | 7.8 | — | P0s fixed |
| Wave 1 | 8.2 | +0.4 | Dim 5: 8→9, Dim 15: 8→8.5, Dim 16: 6→8 |
| Wave 2 | 8.5 | +0.3 | Dim 1: 8.5→9, Dim 9: 5.5→7, Dim 10: 8→9 |
| Wave 3 | 8.8 | +0.3 | Dim 2: 4→6, Dim 3: 1.5→5, Dim 9: 7→8 |
| Wave 4 | 9.0 | +0.2 | Dim 14: 3→7 |
| Wave 5 | 9.2+ | +0.2 | Dim 4: 5.5→8 |

---

## Execution Rules
1. Each wave: plan → implement → test → commit → verify
2. Never skip tests. Every handler gets at least 3 tests (happy, auth rejection, business rule)
3. Follow existing patterns (Karpathy: surgical changes, match style)
4. Phase C stubs are PROPER implementations, not mocks
5. Run `bun test` after each wave — must be 0 fail before commit
