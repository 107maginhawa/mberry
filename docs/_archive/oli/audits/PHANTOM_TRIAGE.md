# Phantom Triage — TR-FE-PHANTOM-RES-01..16

**Source:** `docs/trace/TRACE_REPORT.md` (engine `7b2a640` rescan, 60→20 residual, 4 demoted P3)
**Engine version:** `@oli/engine` 7b2a640 (param-anon fallback)
**Date:** 2026-06-03
**Owner:** GATE-FAIL fix wave (task #12)

## Buckets

| Bucket | Count | Action | Route via |
|---|---|---|---|
| **A. FE↔BE drift** (FE call site wrong; spec route exists) | 8 | edit FE to match canonical spec path | direct FE edits |
| **B. Missing-BE-route OR missing-TypeSpec-coverage** (spec absent; either no BE handler, or hand-wired BE exists but TypeSpec doesn't cover) | 5 | add TypeSpec + handler + repo (or wrap hand-wired in TypeSpec) | `/typespec` → `/handler` skill |
| **C. Engine-polish artifact** (engine false positive — FE route, wildcard, or var name) | 3 | backlog for `@oli/engine` extractor fix | engine-polish-backlog |

Total: 8 + 5 + 3 = **16**.

**Revisions (2026-06-03 in-session):**
- RES-04 moved B→A: spec already has `/association/person-subscriptions?personId=` (FE was calling `/communications/subscriptions/person?personId=` — pure drift).
- RES-07 moved B→A: spec exposes `/notifs` (already current-user-scoped; FE was calling `/notifications/my?limit=3`).
- RES-09 stays B: peer-view of credits, no spec analog; `/persons/me/credits` is self-only.
- RES-13 stays B: hand-wired BE exists (`handlers/association:member/getDuesMetrics.ts`); needs TypeSpec wrap.
- RES-15 stays B: hand-wired BE exists (`handlers/association:member/getDuesMemberSummary.ts`); needs TypeSpec wrap.
- RES-03, RES-10 stay B: no BE handler, real missing-BE.

## Bucket A — FE↔BE drift (8) — APPLIED

| ID | FE call (was) | Canonical spec route | FE call site | Status |
|---|---|---|---|---|
| RES-01 | `GET /public/verify/:certificateNumber` | `/certificates/verify/{certificateNumber}` | `apps/memberry/src/routes/verify/$certificateNumber.tsx:27` | ✓ FIXED |
| RES-04 | `GET /communications/subscriptions/person?personId=` | `/association/person-subscriptions?personId=` | `apps/memberry/src/features/communications/components/notification-preferences.tsx:78` | ✓ FIXED |
| RES-05 | `GET /events/my` | `/association/event-lifecycle/my` | `apps/memberry/src/features/dashboard/components/member-dashboard.tsx:65` | ✓ FIXED |
| RES-06 | `GET /training/my` | `/association/training-lifecycle/my` | `apps/memberry/src/features/dashboard/components/member-dashboard.tsx:74` | ✓ FIXED |
| RES-07 | `GET /notifications/my?limit=3` | `/notifs?limit=3` (already current-user-scoped) | `apps/memberry/src/features/dashboard/components/member-dashboard.tsx:83` | ✓ FIXED |
| RES-08 | `GET /association/member/directory/:personId/public` | `/association/member/directory/search/{personId}/public` | `apps/memberry/src/features/directory/components/member-profile.tsx:34` | ✓ FIXED |
| RES-11 | `GET /association/member/professional-licenses` | `/association/member/licenses` | `apps/memberry/src/features/membership/components/credential-list.tsx:29` | ✓ FIXED |
| RES-12 | `GET /communications/announcements?organizationId=…` | `/communications/announcements/{organizationId}` (path param) | `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/communications/sent.tsx:39` | ✓ FIXED |

Test mocks updated: `apps/memberry/src/features/dashboard/components/member-dashboard.test.tsx` (`/events/my`→`/event-lifecycle/my`, `/training/my`→`/training-lifecycle/my`, `/notifications/my`→`/notifs`).

## Bucket B — Missing-BE-route OR missing-TypeSpec-coverage (5) — DEFERRED

Defer to a fresh `/gsd-phase` cycle: each row needs `/typespec` → `bun run build` → `bun run generate` → `/handler` skill (when no BE) or wrap-existing decision (when hand-wired), + repo + tests + `/test-contract`.

| ID | FE call | BE status | Recommended TypeSpec route | Owner module |
|---|---|---|---|---|
| RES-03 | `GET /comms/messages/search?…` | **no BE handler** | `@route("/comms/messages/search")` `op search(query, …): Paginated<Message>` | `comms` |
| RES-09 | `GET /association/member/credits?personId=…` | **no BE handler** (peer-view, not self; `/persons/me/credits` is self-only) | `@route("/association/member/credits") @get op list(@query personId): Paginated<CreditEntry>` | `association:member` |
| RES-10 | `GET /association/member/chapters` | **no BE handler** (spec has `/admin/national/chapters` only — admin-tier) | add member-facing list `@route("/association/member/chapters")` | `association:member` |
| RES-13 | `GET /association/member/dues-metrics/:orgId` | **hand-wired BE exists** (`handlers/association:member/getDuesMetrics.ts`, `app.ts:574`) | wrap existing hand-wired in TypeSpec OR document as approved hand-wired exception | `dues` / `association:member` |
| RES-15 | `GET /association/member/dues-member-summary/:orgId/:memberId` | **hand-wired BE exists** (`handlers/association:member/getDuesMemberSummary.ts`) | wrap in TypeSpec OR document as approved hand-wired | `dues` / `association:member` |

## Bucket C — Engine-polish artifact (3) — FILED UPSTREAM 2026-06-03

These are extractor false positives from `@oli/engine`; no codebase fix needed.
**Status:** filed upstream at `~/Desktop/oli-engine/BACKLOG.md` (entries `E1-RES-02/14/16`). Carry as P3 in TRACE_REPORT until engine fix lands.

| ID | Phantom signature | Why FP | Upstream entry |
|---|---|---|---|
| RES-02 | `GET /verify/*` (wildcard) | engine confused TanStack FE route `routes/verify/$certificateNumber.tsx` path with API call extraction | `BACKLOG.md` § Extractor false positives — `E1-RES-02` |
| RES-14 | `GET /communications/templates/:edit` | template literal `${edit}` where `edit` is a variable — engine treated `edit` as literal segment name | `BACKLOG.md` § Extractor false positives — `E1-RES-14` |
| RES-16 | `GET /public/orgs*` (wildcard) | engine extracted wildcard from `${qs ? '?'+qs : ''}` query-string suffix | `BACKLOG.md` § Extractor false positives — `E1-RES-16` |

Companion filing — `TR-PHANTOM-ENGINE-FP × 4` (`/persons/me`, `/persons/me/export`, `/surveys`, `/surveys`) filed at the same time under `BACKLOG.md` § Phantom-detector literal-vs-pattern boundary FPs (`E2-PERSONS-ME`, `E2-PERSONS-ME-EXPORT`, `E2-SURVEYS-LIST`, `E2-SURVEYS-CREATE`). Cross-ref `docs/audits/CHECK_LEARNINGS.md` row 43.

## Execution Plan

1. **Bucket A first** (8 cheap FE edits) — touch 7 files in `apps/memberry/src/`. After each: typecheck + E2E. Commit per logical group (verify, dashboard, directory, finances, announcements).
2. **Bucket B second** (5 TypeSpec routes) — sequenced as: `/typespec` → `bun run build` → `bun run generate` → `/handler` skill → repo + tests → `/test-contract`.
3. **Bucket C third** (3 engine FPs) — append to `~/Desktop/oli-engine/BACKLOG.md` or open issue; tag commit message `engine-polish-backlog`.

## Verification

After each bucket:
- `/oli-check --traceability` — P1 count must drop by bucket size (A:−8, B:−5, C:−0 since carried as WARN).
- After all three: `/oli-check --auto` → expect `GATE: WARN-WITH-REAL-FINDINGS` (Bucket C carried) or `GATE: PASS` if engine fix lands first.

## Cross-refs

- Engine bootstrap: `~/Desktop/oli-engine` (memory `project_oli_engine`)
- Wave 58 m21-billing zero-anchor playbook: commits `290c3882`, `3861235b`, `4b957032`
- Anchor format rule: canonical global `WF-NNN`, NOT module-local `WF-MNN-NN` (CHECK_LEARNINGS row 30)
