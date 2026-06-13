# AHA Module/Group Fix Report: Communications (+ feed)

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Communications (+ feed) |
| Module slug | `communications` |
| Raw gap plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/communications-gap-plan.md` |
| Fix-ready plan used | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/communications-fix-ready-plan.md` |
| Output fix report | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/communications-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — P0 delivery spine + prefs pipeline (FIX-001, FIX-002, FIX-003, FIX-004, FIX-005) |
| Superpowers used | Yes (`using-superpowers`, `test-driven-development`) |
| Working tree status checked | Yes |
| Fix scope | P0 / V1 REQUIRED only (Batch A) |
| Out of scope | Batch B (FIX-006/007/008), Batch C (FIX-009/010/011), feed (m13, blocked), messages pipeline (do-not-build), event-bus bootstrap refactor (Batch E beyond one init line), topicId↔UUID migration (Batch F), all V2 DEFERRED |
| Shared files touched | Yes — `services/api-ts/src/app.ts` (one import + one init line, `[SHARED DEPENDENCY]`) |
| Schema/migration touched | No — FIX-005 resolved via module-local runtime find-or-create mapping (no `slug` column, no migration) |
| Limitations | E2E full-stack proof for FIX-003 (member actually receives a delivered notification end-to-end through a running API+DB+browser) was NOT run — no running stack in this pass; FIX-003 proven at component level (chained publish/schedule calls) and FIX-001 at integration level (subscriber fires fan-out). The pre-existing nav-only `communication-delivery.spec.ts` was left unchanged (requires servers). The prefs schema has no per-channel dimension, so per-channel toggles necessarily persist at category/topic granularity — see Remaining Gaps. |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | Backend delivery dead: `registerCommunicationJobs` never called; no `announcement.published` subscriber → fan-out never runs | P0 | V1 REQUIRED | A | Core product promise (broadcast to members) never executed | Fixed |
| FIX-002 | Scheduled delivery dead: `*/5` cron written but never registered (same root as FIX-001) | P0 | V1 REQUIRED | A | M7-R3 ≤5min path defined but never ran | Fixed |
| FIX-003 | Compose UI cannot send/schedule: "Send Now"/"Schedule" POST a status the server ignores (force-drafts) | P0 | V1 REQUIRED | A | Officer believes announcement sent; it silently stayed a draft | Fixed |
| FIX-004 | Notification prefs LOAD broken: handler returns `{items,total,offset,limit}` violating contract `{data,pagination}` | P0 | V1 REQUIRED | A | Members saw blank prefs UI → couldn't opt out | Fixed |
| FIX-005 | Notification prefs SAVE broken: UI sends synthetic string topicIds into `uuid` column → cast failure | P0 | V1 REQUIRED | A | Member consent could not be recorded (runtime throw) | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `bun test listPersonSubscriptions.test.ts bulkUpdatePersonSubscriptions.test.ts announcementSend.test.ts` | 13 pass / 0 fail (GREEN but false-green) | FIX-001,004,005 | Pre-existing tests only checked status codes / fn-in-isolation; never asserted response shape, topicId resolution, or registration/trigger wiring — they masked all three P0s |
| `grep domainEvents.on('announcement.published')` | 0 subscribers | FIX-001 | Event was emitted in `publishAnnouncement.ts:36` but had no consumer |
| `grep registerCommunicationJobs` call sites | 1 definition, 0 calls | FIX-001/002 | Confirmed dead; `app.ts:671-683` omitted it |
| `listPersonSubscriptions.ts:32` | returned `{ items, total, offset, limit }` | FIX-004 | Contract (`validators.ts:7603`) requires `{ data, pagination }` |
| `bulkUpdatePersonSubscriptions.ts:28-36` | persisted raw `item.topicId` (e.g. `"dues-email"`) into uuid column | FIX-005 | uuid-cast failure at runtime |
| RED tests written first (all 5 fixes) | Failed for the expected reason before implementation | all | See section 6 RED rows |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | Added `announcement.published` subscriber inside `registerCommunicationJobs` that fetches the (org-scoped) announcement and runs `processAnnouncementSend`. Wired `registerCommunicationJobs(jobs, app.notifs, app.email, database)` into `initializeApp`. | `services/api-ts/src/handlers/communication/jobs/announcementSend.ts`; `services/api-ts/src/app.ts` | `[SHARED DEPENDENCY]` — one import + one init line in `app.ts`; subscriber block kept module-local (not in `domain-event-consumers.ts`, which was already dirty from prior work and which registers consumers before `app.notifs`/`app.email` exist) | Email/notifs internals untouched — wired the communication TRIGGER only |
| FIX-002 | Same `registerCommunicationJobs` wiring now registers the existing `*/5` cron at boot. | `services/api-ts/src/handlers/communication/jobs/announcementSend.ts`; `services/api-ts/src/app.ts` | `[SHARED DEPENDENCY]` (same one line) | Cron body was already correct; it was simply never registered |
| FIX-003 | Compose form now chains create/update → publish (Send Now) or → schedule (Schedule). Removed the ignored `status` body field; create persists a draft, then the dedicated endpoint transitions it. | `apps/memberry/src/features/communications/components/compose-form.tsx` | No (frontend, module-local) | Uses existing `POST .../{id}/publish` and `POST .../{id}/schedule` endpoints |
| FIX-004 | `listPersonSubscriptions` now returns `{ data, pagination{offset,limit,count,totalCount,totalPages,currentPage,hasNextPage,hasPreviousPage} }` per contract. | `services/api-ts/src/handlers/communication/listPersonSubscriptions.ts` | No | Frontend already read `data.data`, so it now works |
| FIX-005 | `bulkUpdatePersonSubscriptions` resolves each non-UUID topicId via `SubscriptionTopicRepository.findOrCreateByName(org, categoryName)` before upsert; UUIDs pass through unchanged. Added repo methods `findByName`, `findOrCreateByName`, `findByPersonWithTopic` (topic-name join). Frontend load now maps stored topic UUID → category via `topicName` and reflects the saved enabled across that category's channels. | `services/api-ts/src/handlers/communication/bulkUpdatePersonSubscriptions.ts`; `services/api-ts/src/handlers/communication/repos/communication.repo.ts`; `services/api-ts/src/handlers/communication/listPersonSubscriptions.ts`; `apps/memberry/src/features/communications/components/notification-preferences.tsx` | No (module-local; NO schema column, NO migration) | Chose runtime find-or-create mapping over a `slug` column to avoid schema churn (per plan §14). Topic granularity limitation documented in section 9. |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `services/api-ts/src/handlers/communication/listPersonSubscriptions.test.ts` | integration (handler) | Response is contract shape `{data,pagination}` with legacy `items` gone; each item carries `topicName` for UI round-trip | FIX-004, FIX-005 |
| `services/api-ts/src/handlers/communication/bulkUpdatePersonSubscriptions.test.ts` | integration (handler) | Synthetic key `dues-email` resolves to a real topic UUID before upsert (never the raw string); already-UUID topicIds pass through unchanged | FIX-005 |
| `services/api-ts/src/handlers/communication/jobs/registerCommunicationJobs.test.ts` (new) | integration (wiring) | The `*/5` cron is registered (FIX-002) AND emitting `announcement.published` drives the fan-out (subscriber wired, not dead) (FIX-001) | FIX-001, FIX-002 |
| `apps/memberry/src/features/communications/components/compose-form.test.tsx` | frontend/component | "Send Now" chains create → `/publish`; "Schedule" chains create → `/schedule` with `scheduledAt` | FIX-003 |

All new/updated tests were written RED-first and observed failing for the expected reason before implementation (TDD per superpowers `test-driven-development`).

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test listPersonSubscriptions.test.ts` (RED, FIX-004) | Failed (expected) | `res.body.data` undefined — handler returned `{items}` |
| `bun test listPersonSubscriptions.test.ts` (GREEN, FIX-004) | Passed | 4 pass |
| `bun test bulkUpdatePersonSubscriptions.test.ts` (RED, FIX-005) | Failed (expected) | `resolvedNames` empty — no resolution |
| `bun test bulkUpdatePersonSubscriptions.test.ts` (GREEN, FIX-005) | Passed | 5 pass |
| `bun test listPersonSubscriptions.test.ts` (RED, FIX-005 enrich) | Failed (expected) | handler still called `findByPerson` |
| `bun test listPersonSubscriptions.test.ts` (GREEN, FIX-005 enrich) | Passed | topicName present |
| `bun test registerCommunicationJobs.test.ts` (RED, FIX-001) | Failed (expected) | `db.select` not called — no subscriber |
| `bun test registerCommunicationJobs.test.ts` (GREEN, FIX-001/002) | Passed | 2 pass (cron + subscriber) |
| `bun test compose-form.test.tsx` (RED, FIX-003) | Failed (expected) | only one POST; no publish/schedule chain |
| `bun test compose-form.test.tsx` (GREEN, FIX-003) | Passed | 12 pass |
| `cd services/api-ts && bun test src/handlers/communication/` | Passed | 417 pass / 0 fail / 45 files |
| `bun test src/handlers/communication/ src/core/domain-event-consumers.test.ts` | Passed | 434 pass / 0 fail — no domainEvents cross-pollution |
| `bun test preferences-view.test.tsx compose.test.tsx announcement-list.test.tsx` | Passed | 7 pass (no FE regression) |
| `cd services/api-ts && bun run typecheck` | Passed | `tsc --noEmit` clean |
| `cd apps/memberry && bun run typecheck` | Passed | `tsc --noEmit` clean |
| Full-stack E2E delivery (member receipt) | Not Run | No running API+DB+browser stack in this pass; covered by component + integration tests instead |

## 7. Validation Summary

- **Passed:** All 5 Batch A fixes implemented test-first (RED→GREEN). 417 communication backend tests pass; 434 pass when run with `domain-event-consumers.test.ts` (confirms the new `announcement.published` subscriber + my `domainEvents.reset()` cause no cross-file pollution). Frontend communication component tests pass (no regression). Both `api-ts` and `memberry` typechecks are clean.
- **Failed:** None.
- **Not run:** Full-stack E2E proof of member-side delivery (FIX-003 end-to-end receipt). No running stack available; proven at component (chained publish/schedule) + integration (subscriber fires fan-out) levels.
- **Blocked:** None within Batch A.
- **Pre-existing / unrelated:** A `NOT_FOUND` error is logged during `announcementSend.test.ts` — this is the pre-existing isolation test deliberately exercising the not-found error path (caught), not a failure. The working tree carried prior AHA fixes (membership, dues, billing, training, elections + generated regen); none were touched or reverted.

## 8. Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| App bootstrap | `services/api-ts/src/app.ts` (`initializeApp`) | Boots all background jobs; the domain-event bus has 9 existing subscribers. Added exactly one import + one `registerCommunicationJobs(...)` call. | `registerCommunicationJobs.test.ts` proves registration + trigger; full communication suite + domain-event-consumers run clean together | `[SHARED DEPENDENCY]` — minimal-surface edit per Batch E discipline. `app.email`/`app.notifs`/`database` all exist at init time (attached at `app.ts:226`). Restart the API server to pick up the new registration (no hot-reload for new registrations). |
| Domain event bus | `announcement.published` | Subscriber added inside `registerCommunicationJobs` (module-owned closure, not in `domain-event-consumers.ts`). | `registerCommunicationJobs.test.ts` | Chose the module-owned-closure path because consumers in `domain-event-consumers.ts` are registered at `app.ts:205`, BEFORE `app.email`/`app.notifs` are created — so the subscriber could not get those services there. Also avoids editing the already-dirty `domain-event-consumers.ts`. |
| Email / Notifs | `EmailService`, `NotificationService` | Fan-out enqueues email + push; in-app rows inserted | unchanged internals | `[SHARED DEPENDENCY]` — wired the communication TRIGGER only; no email/notifs internals modified |

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Per-channel notification preferences do not persist independently | FIX-005 | `person_subscription` has no channel column — only `(personId, topicId, enabled)`. The UI exposes 5 categories × 3 channels (15 toggles) but the schema can only store one enabled per (person, topic/category). The fix persists at category/topic granularity (toggling any channel of a category sets the whole category). Adding a channel column = schema churn the plan explicitly defers. | Product decision: confirm category-level prefs are acceptable for V1, OR schedule a `channel` column + migration in a db-schema (`06`) pass. Either route is V2/deferred per the plan. |
| Full-stack E2E proof of member-side delivery receipt | FIX-001/003 | No running API+DB+browser stack in this pass | Rerun/upgrade `apps/memberry/tests/e2e/journeys/communication-delivery.spec.ts` from nav-only to assert `sent`/`scheduled` status + member notification receipt once a stack is available |
| Double `repo.get` on publish fan-out | FIX-001 | The subscriber fetches the announcement (for channel flags) and `processAnnouncementSend` fetches it again internally | Minor optimization — out of scope; left as minimal change. Could pass the announcement into `processAnnouncementSend` later. |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Professional feed (m13) scaffold-or-remove | `[NEEDS PRODUCT DECISION]` `[BLOCKED BY MISSING SPEC]` | m13 ranking/curation/moderation undefined; out of active scope per plan §13 and index §20 | Product decision + spec |
| Messages subsystem as a second delivery pipeline | `[DO NOT OVERBUILD]` `[NEEDS PRODUCT DECISION]` | Canonical primitive defaulted to ANNOUNCEMENTS by the plan to keep Batch A unblocked; not re-opened | Product confirmation if messages are ever to be expanded |
| FIX-007 tenant-isolation code change | `[NEEDS CONFIRMATION]` | Batch B; `repo.get(id, orgId?)` signature now confirmed to accept org param, but this is Batch B scope | Separate `04` pass (Batch B) |
| Consent-change audit on preference toggles | `[NEEDS PRODUCT DECISION]` | No decision on whether opt-out toggles must be audited | Product + Compliance decision |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| FIX-006 RBAC re-role (admin/coordinator → officer) | (Batch B) | Unselected batch this pass — requires TypeSpec edit + full regen |
| FIX-007 cross-org mutation org-scoping | (Batch B) | Unselected batch; `[NEEDS CONFIRMATION]` resolved-but-out-of-scope |
| FIX-008 delivery stats surfacing | (Batch B) | Depends on Batch A delivery being live; unselected batch |
| FIX-009 in-app mandatory server guard | (Batch C) | Unselected batch |
| FIX-010 template missing-var placeholder + Handlebars validation | (Batch C) | Unselected batch |
| FIX-011 stale m07 §10 / HAND_WIRED_ROUTES doc fix | (Batch C) | Unselected batch (doc-only) |
| M7-R6 priority push, announcement `cancelled` state, unique template-name index, saved-segment smart audiences | `V2 DEFERRED` | Plan §10 — premature until delivery/scheduling mature |
| `channel` column for per-channel prefs | `V2 DEFERRED` / `[DO NOT OVERBUILD]` | Schema churn the plan defers (FIX-005 mapping avoids it) |
| Feed/survey schema co-location refactor | `[DO NOT OVERBUILD]` / route to `06` | Cross-module/db concern outside this fix pass |
| Title 200-vs-300 reconciliation | `[NEEDS PRODUCT DECISION]` | Minor spec/code mismatch |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `services/api-ts/src/app.ts` | Import `registerCommunicationJobs`; call it in `initializeApp` with `(jobs, app.notifs, app.email, database)` | FIX-001, FIX-002 |
| `services/api-ts/src/handlers/communication/jobs/announcementSend.ts` | Import `domainEvents`; add `db` param to `registerCommunicationJobs`; register `announcement.published` subscriber → `processAnnouncementSend` | FIX-001, FIX-002 |
| `services/api-ts/src/handlers/communication/listPersonSubscriptions.ts` | Return contract `{data,pagination}`; use `findByPersonWithTopic` (topicName enrichment) | FIX-004, FIX-005 |
| `services/api-ts/src/handlers/communication/bulkUpdatePersonSubscriptions.ts` | Resolve synthetic UI keys → topic UUID (find-or-create by category name); UUIDs pass through | FIX-005 |
| `services/api-ts/src/handlers/communication/repos/communication.repo.ts` | Add `findByName`, `findOrCreateByName` (SubscriptionTopicRepository) and `findByPersonWithTopic` (PersonSubscriptionRepository) | FIX-005 |
| `apps/memberry/src/features/communications/components/compose-form.tsx` | Chain create/update → publish (Send Now) / schedule (Schedule); drop ignored `status` body field | FIX-003 |
| `apps/memberry/src/features/communications/components/notification-preferences.tsx` | Load mapping: topic UUID → category via `topicName`; apply topic-level enabled across the category's channels | FIX-005 |
| `services/api-ts/src/handlers/communication/listPersonSubscriptions.test.ts` | Contract-shape + topicName round-trip tests | FIX-004, FIX-005 |
| `services/api-ts/src/handlers/communication/bulkUpdatePersonSubscriptions.test.ts` | Synthetic-key→UUID resolution + UUID passthrough tests | FIX-005 |
| `services/api-ts/src/handlers/communication/jobs/registerCommunicationJobs.test.ts` (new) | Cron registration + publish-subscriber fan-out tests | FIX-001, FIX-002 |
| `apps/memberry/src/features/communications/components/compose-form.test.tsx` | Send-Now→publish / Schedule→schedule chain tests; date-picker mock fixed to `onValueChange` | FIX-003 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| Test output (RED→GREEN per fix; suite + typecheck results) | Inline in section 6 of this report (terminal output captured during the pass) | all |
| No screenshots / Playwright / Webwright artifacts | n/a — no browser tooling run this pass (no running stack) | FIX-003 (E2E deferred) |

## 14. Completion Decision

`PARTIALLY COMPLETE`

All 5 Batch A fixes (FIX-001..005) were implemented test-first and pass focused, module-level, and cross-module regression tests; both workspaces typecheck clean; shared edits were held to one `app.ts` init line; no schema/migration was added and no prior unrelated working-tree changes were touched. The decision is `PARTIALLY COMPLETE` rather than `COMPLETE` for two honest reasons: (1) full-stack E2E proof of member-side delivery receipt for FIX-003 was not run (no running API+DB+browser stack in this pass — covered instead by component + integration tests); and (2) FIX-005 persists notification preferences at category/topic granularity because the `person_subscription` schema has no channel dimension, so true per-channel persistence remains a documented, deferred schema gap. The core FAIL condition — an announcement never reaching a member and a member unable to load/save prefs — is resolved within the limits of the existing schema and test harness.

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for **Batch B** (FIX-006 RBAC re-role, FIX-007 tenant isolation, FIX-008 stats surfacing) now that the Batch A delivery spine is live.

```
Module/group: Communications (+ feed)
Module slug: communications
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/communications-fix-ready-plan.md
Recommended batch: Batch B — P1 RBAC + tenant + stats (FIX-006, FIX-007, FIX-008)
```

Before Batch B: resolve the FIX-007 `repo.get` confirmation (now verified — `CommunicationsRepository.get(id, orgId?)` accepts an optional org param) and decide the per-channel-vs-category preference granularity question (see section 9) — the latter may be routed to `06-database-schema-audit.md` if a `channel` column is desired. Also consider, once a running stack is available, upgrading `apps/memberry/tests/e2e/journeys/communication-delivery.spec.ts` from nav-only to a real send→receipt assertion to close the FIX-003 E2E gap.

---

# Batch B — FIX-006 + FIX-007 + FIX-008 + DEC-COMMS-05

> Appended 2026-06-12. This section records the second `04` pass on Communications (+ feed). Batch A (FIX-001..005, above) is unchanged.

## B.1 Fix Scope

| Item | Details |
| --- | --- |
| Batch executed | Batch B — P1 RBAC + tenant isolation + stats surfacing + PII scoping (FIX-006, FIX-007, FIX-008, DEC-COMMS-05) |
| Fix date | 2026-06-12 |
| Superpowers used | Yes (`using-superpowers`, `test-driven-development` — RED→GREEN per fix) |
| Working tree status checked | Yes — pre-existing dirty tree (~245 files from prior AHA passes) preserved; no resets/restores/deletes |
| Fix scope | P1 / V1 REQUIRED (FIX-006/007/008) + P1 PII scoping (DEC-COMMS-05) |
| Out of scope | Batch C (FIX-009/010/011), feed (m13, blocked), messages delivery pipeline (do-not-build), per-channel prefs column, M7-R6 priority push, announcement `cancelled` state, saved-segment smart audiences, title 200/300 reconciliation — all unchanged from prior sections |
| Shared files touched | TypeSpec source `specs/api/src/association/core/communication.tsp` (re-role 15 ops) + intended regen of `services/api-ts/src/generated/openapi/routes.ts` and `specs/api/dist/openapi/openapi.json` (generated — NOT hand-edited) |
| Schema/migration touched | No — all four fixes are handler/repo logic + a TypeSpec role re-role; no new migration |
| Limitations | FIX-006 is proven by a deterministic generated-route gate assertion (parses `routes.ts`, same approach as the codebase's `route-auth-coverage.test.ts`) plus the established `authMiddleware`/seed evidence that officers carry `association:officer`. A live-server `apiAs('treasurer@…')` officer-CRUD-→2xx integration check was NOT run (no running API on :7213 this pass), consistent with Batch A's documented live-stack deferral. After the regen the API server must be restarted to pick up the new route gate (no hot-reload for changed registrations). |

## B.2 Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-006 | 15 communication management ops gated `["admin","coordinator"]`; `coordinator` role does not exist and officers carry `association:officer`/`association:admin` (not bare `admin`) → officers 403'd on templates/messages/saved-segments | P1 | V1 REQUIRED | B | m07 §6 / WF-047 assigns these flows to Officers; they were blocked | Fixed |
| FIX-007 | publish/update/delete/archive fetched the announcement by id with no org match → an officer of org A could mutate org B's announcement by id | P1 | V1 REQUIRED | B | Tenant-isolation breach | Fixed |
| FIX-008 | `CommunicationsRepository.list` never joined `announcement_stats`; the analytics dashboard reads `announcement.stats` off the list endpoint → every KPI rendered 0 even after a real fan-out wrote stats | P1 | V1 REQUIRED | B | WF-048 dashboard showed empty/misleading data | Fixed |
| DEC-COMMS-05 | `listPersonSubscriptions` scoped by org only; the `member:owner` gate is enforced in-handler (authMiddleware delegates `:owner`), but the handler never checked `query.personId` ownership → a member could read another member's consent/subscription records | P1 | V1 REQUIRED | B (folds in) | PII / consent leak | Fixed |

## B.3 Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| RED: 4× cross-org mutation tests | Failed (promise resolved → 200) | FIX-007 | Cross-org mutation succeeded — confirmed the leak before the fix |
| RED: `listPersonSubscriptions` deny-other-member | Failed (200, data fetched) | DEC-COMMS-05 | Handler returned another member's rows |
| RED: `repo.list` stats join (real Postgres) | Failed (`row.stats` undefined) | FIX-008 | `total`/`id` asserts passed, isolating the bug to the missing stats join |
| RED: generated-route gate assertion | Failed (15 ops = `["admin","coordinator"]`) | FIX-006 | Parsed `routes.ts`; all 15 still on the phantom role |
| Full `bun test` (api-ts) baseline | 6083 pass / 1 fail / 4 todo | all | The 1 fail is the PRE-EXISTING, unrelated `registerEmailJobs > registers email.processor as interval job` (30000 vs 1000) |

## B.4 Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-006 | Re-roled the 15 `["admin","coordinator"]` management ops to `["association:officer"]` (mirroring the canonical officer role used by the sibling announcement ops in `announcements.tsp`), then regenerated. | `specs/api/src/association/core/communication.tsp`; regen → `services/api-ts/src/generated/openapi/routes.ts`, `specs/api/dist/openapi/openapi.json` | `[SHARED DEPENDENCY]` (generator) — standard TypeSpec→regen workflow; NEVER hand-edited generated files | Chose role-only `association:officer` (no `x-require-position`) so ANY officer can manage comms tools, matching "assigns to Officers" generically; adding a position filter would be a narrowing product decision. Platform-admin personas operate via their seeded `association:officer` role (seed `layer-2-users.ts`). |
| FIX-007 | Each mutation handler now resolves `orgId = ctx.get('organizationId')` and fetches via `repo.get(id, orgId)` (+ passes `orgId` to the subsequent `updateStatus`/`update`/`delete` for defense-in-depth). Org mismatch → `get` returns undefined → `NotFoundError` (404). | `services/api-ts/src/handlers/communication/publishAnnouncement.ts`, `updateAnnouncement.ts`, `deleteAnnouncement.ts`, `archiveAnnouncement.ts` | No (module-local; repo `get(id, orgId?)` signature already existed) | |
| FIX-008 | `CommunicationsRepository.list` now `leftJoin`s `announcement_stats` and maps each row to `{ ...announcement, stats }` (mirrors `get()`'s shape). `listAnnouncements` passes it through; the analytics page already reads `announcement.stats`, so it now shows real counts — no frontend change. | `services/api-ts/src/handlers/communication/repos/communication.repo.ts` | No (module-local) | |
| DEC-COMMS-05 | `listPersonSubscriptions` now allows a self-read (`query.personId === user.id`) and, for any other person's records, requires officer access via the inline `requireOfficerTerm(ctx)` helper (mirrors `listDuesPayments`'s self-or-officer pattern); non-officer cross-read → 403 with no data fetch. | `services/api-ts/src/handlers/communication/listPersonSubscriptions.ts` | No (module-local; reuses `core/auth/officer-checks`) | |

## B.5 Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `publishAnnouncement.test.ts`, `updateAnnouncement.test.ts`, `deleteAnnouncement.test.ts`, `archiveAnnouncement.test.ts` | permission/RBAC (handler) | An officer of org A is rejected (404) when mutating an org-B announcement by id; the org-scoped `get` short-circuits before any write (delete test also asserts no delete occurred) | FIX-007 |
| `listPersonSubscriptions.test.ts` (extended) | permission/RBAC (handler) | A member may read their OWN subscriptions; a non-officer reading ANOTHER member's → 403 AND the other member's rows are never fetched; an officer may read another member's. Existing Batch A shape/topicName tests updated to self-reads (the corrected contract). | DEC-COMMS-05 |
| `repos/communication.repo.list-stats.test.ts` (new) | data/schema (real Postgres, tx-rollback) | After `createStats`, `repo.list` returns the announcement with populated `stats` (recipients/emailSent/pushDelivered/inappViews) — the real left-join, not a mock | FIX-008 |
| `officer-rbac.routes.test.ts` (new) | permission/RBAC (generated-route assertion) | All 15 management ops in the generated `routes.ts` grant `association:officer` and no longer reference the phantom `coordinator` role | FIX-006 |

All Batch B tests were written RED-first and observed failing for the expected reason before implementation.

## B.6 Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test` 4 announcement-mutation files (RED) | Failed (4, expected) | "Expected promise that rejects / Received promise that resolved" — cross-org mutation succeeded |
| `bun test` same (GREEN) | Passed | 17 pass / 0 fail |
| `bun test listPersonSubscriptions.test.ts` (RED) | Failed (deny test, expected) | 403 expected, got 200 |
| `bun test listPersonSubscriptions.test.ts` (GREEN) | Passed | 7 pass / 0 fail |
| `bun test repos/communication.repo.list-stats.test.ts` (RED) | Failed (expected) | `row.stats` undefined against real Postgres |
| `bun test` FIX-008 + `listAnnouncements.test.ts` (GREEN) | Passed | 3 pass / 0 fail |
| `bun test officer-rbac.routes.test.ts` (RED) | Failed (2, expected) | 15 ops still `["admin","coordinator"]` |
| `cd specs/api && bun run build` then `cd ../../services/api-ts && bun run generate` | Passed | Regenerated routes/validators/registry; warnings pre-existing/unrelated |
| `bun test officer-rbac.routes.test.ts` (GREEN) | Passed | 3 pass / 0 fail |
| `bun test src/handlers/communication` | Passed | 427 pass / 0 fail / 47 files (417→427, +10) |
| Full `bun test` (api-ts) | Passed | 6093 pass / 1 fail / 4 todo — the 1 fail is the PRE-EXISTING, unrelated `registerEmailJobs` (30000 vs 1000) |
| `bun run --filter '*' typecheck` | Passed | 0 errors across all 5 workspaces (api-ts, memberry, admin, sdk-ts, ui) |

## B.7 Validation Summary

- **Passed:** All four Batch B fixes implemented test-first (RED→GREEN). Communication dir 427 pass / 0 fail. Full api-ts suite 6093 pass (baseline 6083 + exactly 10 new Batch B tests). Monorepo typecheck clean (5/5).
- **Failed:** None introduced. The single full-suite failure (`registerEmailJobs > registers email.processor as interval job`) is the documented PRE-EXISTING baseline failure, unrelated to communications.
- **Not run:** Live-server `apiAs` officer-CRUD integration check (no API on :7213 this pass) — proven instead by the deterministic generated-route gate assertion + established `authMiddleware`/seed evidence.
- **Flake note:** One full-suite run reported a transient second failure that did not reproduce on re-run (stable 1 fail). This is the known Bun parallel-execution prototype-pollution fragility the codebase mitigates with `restoreRepo`; the isolated communication-dir run was 0 fail.

## B.8 Shared / Cross-Module / Database Impact

| Area | Files / Components / Tables | Consumers / Blast Radius | Regression Coverage | Notes |
| --- | --- | --- | --- | --- |
| TypeSpec → generated routes | `communication.tsp` (15 ops) → `generated/openapi/routes.ts` + `dist/openapi/openapi.json` | Only the 15 communication route gates | `officer-rbac.routes.test.ts`; full suite green | `[SHARED DEPENDENCY]` (generator). Regen diff VERIFIED confined: `routes.ts` = exactly 30 lines (15 gate swaps, no path/handler change); `openapi.json` = the 15 role extensions + their auto-derived descriptions. `validators.ts`, `registry.ts`, generated `types`, and `packages/sdk-ts/src/generated/*` were UNCHANGED by the regen. |
| Officer-check helper | `core/auth/officer-checks.ts` (`requireOfficerTerm`) | Reused inline by `listPersonSubscriptions` (read-only) | `listPersonSubscriptions.test.ts` | No change to the helper; called inline like `listDuesPayments`. |

## B.9 Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| `["admin"]`-only comms ops still block officers: `deleteMessageTemplate`, `deleteMessage`, `updateSubscriptionTopic`, `deleteSubscriptionTopic`, `createSubscriptionTopic` | FIX-006 adjacent | Not in FIX-006's cited 15-op evidence set (they carry `["admin"]`, not `["admin","coordinator"]`); re-roling them is a separate gate decision — kept out to honor "do not expand scope" | If officers should fully CRUD (incl. delete) templates/messages/topics, re-role these in a follow-up (decide whether delete is officer- or admin-only first) |
| Dead `coordinator` role still referenced by `getSubscriptionTopic` (`["admin","coordinator","member"]`) and `listPersonSubscriptions` (`["admin","coordinator","member:owner"]`) gates | FIX-006 adjacent | Harmless (no one holds `coordinator`; `member`/`member:owner` still admit the intended callers) and outside the cited evidence set | Optional cleanup: drop `coordinator` from these two arrays in a later pass (also widespread across 7 other spec files — better handled in a cross-cutting `05` sweep) |
| Live-server officer-CRUD E2E for FIX-006 | FIX-006 | No running API on :7213 this pass | Once a stack is up, add an `apiAs('treasurer@…')` test hitting a template/segment op expecting 2xx and `apiAs('member@…')` expecting 403 |

## B.10 Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| (none new for Batch B) | — | Batch C / feed / messages remain blocked/deferred as recorded in the Batch A sections above | — |

## B.11 Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| FIX-009 / FIX-010 / FIX-011 (Batch C) | (separate batch) | Out of this pass's selected subset |
| Consent-change audit on subscription reads/writes | `[NEEDS PRODUCT DECISION]` | Unchanged from Batch A — product + compliance decision pending |

## B.12 Files Changed (Batch B)

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `specs/api/src/association/core/communication.tsp` | Re-role 15 management ops `["admin","coordinator"]` → `["association:officer"]` | FIX-006 |
| `services/api-ts/src/generated/openapi/routes.ts` | Regen output: 15 `authMiddleware` role gates updated (generated) | FIX-006 |
| `specs/api/dist/openapi/openapi.json` | Regen output: 15 `x-security-required-roles` extensions + descriptions (generated) | FIX-006 |
| `services/api-ts/src/handlers/communication/publishAnnouncement.ts` | Org-scope fetch + write | FIX-007 |
| `services/api-ts/src/handlers/communication/updateAnnouncement.ts` | Org-scope fetch + write | FIX-007 |
| `services/api-ts/src/handlers/communication/deleteAnnouncement.ts` | Org-scope fetch + delete | FIX-007 |
| `services/api-ts/src/handlers/communication/archiveAnnouncement.ts` | Org-scope fetch + write | FIX-007 |
| `services/api-ts/src/handlers/communication/repos/communication.repo.ts` | `list` left-joins `announcement_stats`, maps `{ ...announcement, stats }` | FIX-008 |
| `services/api-ts/src/handlers/communication/listPersonSubscriptions.ts` | Self-or-officer guard on `query.personId` | DEC-COMMS-05 |
| `…/publishAnnouncement.test.ts`, `updateAnnouncement.test.ts`, `deleteAnnouncement.test.ts`, `archiveAnnouncement.test.ts` | + cross-org rejection tests | FIX-007 |
| `…/listPersonSubscriptions.test.ts` | + DEC-COMMS-05 deny/officer tests; existing tests → self-reads | DEC-COMMS-05 |
| `…/repos/communication.repo.list-stats.test.ts` (new) | Real-Postgres stats-join test (tx rollback) | FIX-008 |
| `…/officer-rbac.routes.test.ts` (new) | Generated-route officer-gate assertion | FIX-006 |

## B.13 Completion Decision

`COMPLETE`

All four Batch B fixes (FIX-006, FIX-007, FIX-008, DEC-COMMS-05) were implemented test-first (RED→GREEN), the focused/dir/full suites pass (6093 pass; the single failure is the pre-existing unrelated `registerEmailJobs` test), the monorepo typecheck is clean (5/5), and the FIX-006 regen was verified confined to the 15 communication route gates (no ripple into validators/registry/types/SDK). The cross-org mutation breach, the empty-analytics gap, the officer-403 RBAC mismatch, and the cross-member PII read are all closed within the selected scope. Two small adjacent items (the `["admin"]`-only delete/topic ops and the residual dead `coordinator` references on two read ops) are documented in Remaining Gaps, intentionally left out to honor the no-scope-creep rule.

## B.14 Recommended Next Step

Restart the API server (`cd services/api-ts && bun dev`) so the regenerated officer route gate takes effect, then continue Track A with the next roadmap §8 item:

```
Next: A6 — Documents Batch B2 (FIX-007 cron, FIX-010 notif gate, FIX-011 audit consumer)
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/documents-fix-ready-plan.md
```

Do NOT re-freeze the `check:sdk-compat` baseline (`docs/quality/SDK_BASELINE_OPS.json`) — the FIX-006 regen legitimately changed the generated surface; the baseline is `--update`d only at milestone Step 6.
