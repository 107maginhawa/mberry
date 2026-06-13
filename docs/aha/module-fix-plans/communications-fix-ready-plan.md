# AHA Fix-Ready Plan: Communications (+ feed)

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Communications (+ feed) |
| Module slug | `communications` |
| Source gap plan | `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/communications-gap-plan.md` |
| Output file | `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/communications-fix-ready-plan.md` |
| Audit decision | FAIL |
| Superpowers used | No (organize-only pass; static reasoning sufficient — no implementation, no test authoring) |
| Organizer decision | PARTIALLY READY |
| Reason | The P0 delivery spine (job registration + `announcement.published` subscriber + compose-UI publish/schedule) and the prefs pipeline (response-shape + topicId-UUID) are fix-ready now with concrete file evidence. RBAC re-role and stats-surfacing are fix-ready after the spine. Two active fixes carry confirmation flags that gate them (tenant-isolation `repo.get` signature; PII scoping on `listPersonSubscriptions`) but neither blocks the first batch. One product decision (canonical broadcast primitive: announcements vs messages) is recommended before wiring delivery, but the gap plan and m07 spec are announcement-centric, so the recommended path is "wire the announcement primitive only" — that keeps Batch A unblocked. |
| Limitations | Organizer pass only — no audit redo, no source/test edits. Wiring conclusions in the gap plan were drawn statically (no runtime HTTP capture, no cron firing). `repo.get` org-param signature, `listPersonSubscriptions` PII scoping, `x-audit` runtime composition, and title 200-vs-300 reconciliation remain `[NEEDS CONFIRMATION]`/`[NEEDS PRODUCT DECISION]` and are routed to sections 8/9, not into the active spine. Feed (m13) is intentionally out of active scope per index §20. |

## 2. Fix Strategy Summary

**Fix first (Batch A — P0 delivery spine + prefs).** The module FAILs for one reason: an officer can compose an announcement and see a success state, but **no member is ever contacted** — fan-out and scheduled delivery are unwired, and the compose UI never leaves draft. Three independent P0 defects each break the spine and must be fixed together so one E2E proves real delivery:
1. Wire backend delivery: register communication jobs in `app.ts` init **and** subscribe to `announcement.published` (or direct-call the fan-out on publish).
2. Make the compose UI actually publish/schedule (it currently creates a draft and the server force-drafts it).
3. Fix notification preferences load (response-shape contract violation) and save (string topicId into a `uuid` column). This is a parallel P0 sub-batch — independent of delivery wiring.

**Fix next (Batch B — P1 RBAC + tenant + stats).** After the spine works: re-role 18 communication ops off the nonexistent `admin/coordinator` roles to `association:officer`/`x-require-position` (officers are currently 403'd); org-scope announcement mutation fetches (cross-org publish/delete risk); surface populated `announcement_stats` (depends on Batch A delivery).

**Fix during/with the above (Batch C + Batch D).** Batch C adds the one selected P2-for-V1: a server-side guard preventing in-app opt-out for mandatory announcement topics (consent integrity, M7-R1). Batch D is test hardening that the gap plan flagged as actively misleading — existing prefs and AC-M07 tests are false-green (they use UUID inputs and inline reimplementations), so they must be replaced/extended with real-path tests as the RED step for each fix.

**What NOT to fix now.** Do not wire the messages subsystem as a second delivery pipeline; do not scaffold the feed; do not add saved-segment smart audiences, M7-R6 priority-push, or an announcement `cancelled` state. These are deferred or require a product decision.

**Major risks.** (a) Batch A touches shared bootstrap (`app.ts` init) and the shared domain-event bus — isolate the trigger wiring; do not refactor email/notifs internals (Batch E). (b) The RBAC re-role requires a TypeSpec edit + full regeneration of `routes.ts`/`validators.ts` — generated-file regen, not hand-edit. (c) Two P1/P2 items carry `[NEEDS CONFIRMATION]` flags (tenant `repo.get` signature; PII scoping) — confirm before coding the fetch change.

**One pass or multiple?** Multiple batches. Batch A first (P0). Batch B after the spine is green. Batch C can ride alongside B. Batch D RED tests precede their corresponding A/B fixes. Batch E (shared bootstrap/event-bus) is not a separate work item — it is the constrained part of Batch A and must stay minimal. Batch F (schema) reduces to the topicId-UUID mapping, handled inside FIX-005 (module-local); the deeper feed/survey schema co-location is routed to the db-schema audit, not fixed here.

## 3. Active Fix Scope

Only P0/P1/selected P2/V1 REQUIRED/selected V1 RECOMMENDED items.

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | Backend delivery dead: `registerCommunicationJobs` never called; no `announcement.published` subscriber; `processAnnouncementSend` never invoked on publish | P0 | V1 REQUIRED | A | Core product promise (broadcast to members) never executes — no email/push/in-app/stats ever | `app.ts:670-683` (omits `registerCommunicationJobs`); `announcementSend.ts:265,271`; `grep domainEvents.on('announcement` → 0; `grep registerCommunicationJobs` → 1 def, 0 calls |
| FIX-002 | Scheduled delivery dead: `*/5` cron handler written but cron never registered (same root as FIX-001) | P0 | V1 REQUIRED | A | M7-R3 ≤5min path is defined but never runs; resolved by the same job-registration wiring as FIX-001 | `announcementSend.ts:271`; `app.ts:671-683` |
| FIX-003 | Compose UI cannot send/schedule: "Send Now" POSTs `status:'sent'` but `createAnnouncement` force-sets `draft`; "Schedule" never calls schedule endpoint; PATCH strips `status` | P0 | V1 REQUIRED | A | Officer believes announcement sent; it silently stays a draft → trust + operational failure | `compose-form.tsx:79-103,229-245`; `createAnnouncement.ts:31` (`status:'draft'` literal); `validators.ts:583` |
| FIX-004 | Notification prefs LOAD broken: `listPersonSubscriptions` returns `{items,total,offset,limit}` violating contract `{data,pagination}` → UI reads `data.data` = undefined | P0 | V1 REQUIRED | A | Members see empty/blank prefs UI → cannot opt out (legal/trust risk) | `listPersonSubscriptions.ts:32`; `PersonSubscriptionListResponseSchema` (`validators.ts:7603`); `notification-preferences.tsx:77` |
| FIX-005 | Notification prefs SAVE broken: UI sends synthetic string topicIds (`"dues-email"`) into `person_subscription.topic_id uuid` column → uuid-cast failure | P0 | V1 REQUIRED | A | Member preference saves throw at runtime → consent cannot be recorded | `bulkUpdatePersonSubscriptions.ts:28-36`; `notification-preferences.tsx:52-54`; `communication.schema.ts:111`; seeded topic UUIDs in `seed/layer-7-comms.ts` |
| FIX-006 | Officer role mismatch: 18 communication ops require literal `["admin","coordinator"]`; `coordinator` role does not exist; officers lack `admin` → 403 on templates/topics/segments/messages | P1 | V1 REQUIRED | B | Spec §6/WF-047 assigns these flows to Officers; they are blocked → workflows unusable | `communication.tsp:377,391,404,433,446,464,478,491,520,533,548,564,759,771,784`; `seed/layer-2-users.ts:141`; `utils/auth.ts:86-105`; `routes.ts:1924-1930` |
| FIX-007 | Cross-org announcement mutation: publish/update/delete/archive fetch by id with no org match; position check resolves org from caller header, not the record | P1 | V1 REQUIRED | B | Officer of Org A could publish/delete Org B's announcement by id → tenant-isolation breach | `publishAnnouncement.ts:25` (`repo.get(params.id)` no orgId); analog in `updateAnnouncement.ts`, `deleteAnnouncement.ts`, `archiveAnnouncement.ts` `[NEEDS CONFIRMATION on repo.get signature]` |
| FIX-008 | Delivery stats never populated: analytics reads stats off list endpoint that never joins/populates; stats only written by dead fan-out | P1 | V1 REQUIRED | B | WF-048 dashboard shows empty/misleading data; no durable proof a member was/wasn't contacted | `analytics.tsx:55-63`; `communication.repo.ts:262-276`; `getAnnouncementStats.ts`; `announcement_stats` table |
| FIX-009 | In-app mandatory channel not enforced server-side: prefs UI freely offers an In-App toggle; no guard rejecting in-app opt-out for mandatory announcement topics (M7-R1) | P2 | V1 RECOMMENDED | C | Consent integrity — members can silently opt out of a channel the spec says is mandatory; low-risk server guard | `notification-preferences.tsx:49`; `updatePersonSubscription.ts` (no channel guard); single `channel` column on topic |
| FIX-010 | Template missing-var renders empty (not placeholder); no Handlebars syntax validation on save (M7-R4) | P3 | V1 RECOMMENDED | C | Silent blank content in sent announcements; low-risk render fix that improves trust/usability | `announcementSend.ts:28-36`; `previewMessageTemplate.ts:37` (Handlebars `strict:false`); `createMessageTemplate.ts` (no validation) |
| FIX-011 | Stale m07 §10 spec text: claims 28 broadcast handlers "hand-wired, no TypeSpec"; false — all defined in `communication.tsp`/`announcements.tsp` and generated-registered. Stale `HAND_WIRED_ROUTES.yaml` entries 107–109 likewise. | P3 | V1 RECOMMENDED | C | Doc-only correction; prevents future audits/fixes acting on false wiring assumptions | `m07 MODULE_SPEC §10`; `communication.tsp`; `announcements.tsp`; `HAND_WIRED_ROUTES.yaml` entries 107-109 |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A | P0 delivery spine + prefs pipeline (make a real announcement reach a real member; let a member load/save prefs) | FIX-001, FIX-002, FIX-003, FIX-004, FIX-005 | High — touches shared `app.ts` bootstrap + domain-event bus (FIX-001/002); contract + uuid mapping (FIX-004/005); FE→API chain (FIX-003) | Run in current `04` pass. FIX-001/002 share one root (job registration) — do together. FIX-004/005 are a parallel P0 sub-batch (prefs), independent of delivery. |
| Batch B | P1 reliability/trust/permission gaps (RBAC re-role, tenant isolation, stats surfacing) | FIX-006, FIX-007, FIX-008 | Medium-High — FIX-006 requires TypeSpec edit + full regen; FIX-007 gated by `repo.get` signature confirmation; FIX-008 depends on Batch A delivery | Split into separate `04` pass after Batch A is green. FIX-008 requires Batch A complete (stats are written by the now-live fan-out). FIX-007 requires `[NEEDS CONFIRMATION]` (section 8) resolved first. |
| Batch C | Selected P2/RECOMMENDED V1 completeness (consent integrity, render fallback, doc correction) | FIX-009, FIX-010, FIX-011 | Low — FIX-009 server guard + UI disable; FIX-010 render-fn change; FIX-011 doc-only | Run alongside Batch B (later than A). FIX-011 (doc) can run anytime. None block the spine. |
| Batch D | Test hardening / regression coverage — replace false-green tests; add real-path RED tests before A/B fixes | (test work for FIX-001..008; see section 5) | Medium — existing `ac-m07.*` inline tests and uuid-input prefs tests are actively misleading and must be replaced, not extended blindly | Run as the RED step interleaved with Batch A and Batch B (write failing test first per fix). Not a standalone later batch. |
| Batch E | Shared/platform dependency (the constrained part of Batch A): `app.ts` init line + `domain-event-consumers.ts` subscriber block; email/notifs treated as `[SHARED DEPENDENCY]` (wire trigger only) | (subset of FIX-001, FIX-002) | High blast radius if over-touched — keep to one init line + one module-owned subscriber block; do NOT modify email/notifs job internals | Execute within Batch A but ISOLATE the shared-file edits to the minimum (one `registerCommunicationJobs(...)` call; one `domainEvents.on('announcement.published', ...)` block per CLAUDE.md P1.6). |
| Batch F | Database/schema dependency: topicId-UUID mapping (module-local, inside FIX-005). Deeper feed/survey schema co-location in `communication/repos` is NOT fixed here. | (subset of FIX-005) | Low for the module-local mapping; the cross-module schema leak is out of scope | Module-local mapping runs inside Batch A (FIX-005). The feed/survey co-location is routed to the db-schema audit (`06`) — do not run yet here. |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Publish triggers fan-out: job registry receives communication jobs at init AND publishing an announcement invokes `processAnnouncementSend` (subscriber fires) | integration | A published announcement actually enqueues email/push and writes in-app rows — proving the wiring runs end-to-end, not just that the fn works in isolation | New integration test near `services/api-ts/src/handlers/communication/jobs/` (extend `announcementSend.test.ts` is NOT enough — it tests the fn in isolation; add a registration+trigger test) |
| FIX-002 | Scheduled announcement fires via registered cron: a `scheduled` announcement at/after `scheduledAt` is picked up and sent | integration | M7-R3 ≤5min path is live (cron registered), not merely defined | New integration test alongside FIX-001 test (job-registration-aware) |
| FIX-003 | Compose "Send Now" reaches `sent` and enqueues delivery; "Schedule" sets `scheduled` + scheduledAt | E2E/Playwright (core journey) | Catches the silent-draft P0 — UI must actually publish/schedule, not navigate away on a draft. Convert existing nav-only spec to assert status + recipient receipt. | Extend `apps/memberry/tests/e2e/journeys/communication-delivery.spec.ts` (gap plan flags it as likely nav-only) and/or `apps/memberry/tests/e2e/officer/communications.spec.ts` |
| FIX-004 | Notification prefs load against real contract shape (`{data,pagination}`) | integration / frontend-component | Catches `{items}` vs `{data,pagination}` mismatch with NO mock that hides it | Replace mocked-SDK component test `apps/memberry/.../communications/__tests__/preferences-view.test.tsx`; add backend assertion that `listPersonSubscriptions` returns `{data,pagination}` (new/updated test in `handlers/communication/listPersonSubscriptions.test.ts`) |
| FIX-005 | Prefs save with REAL seeded topic UUID persists + reloads | integration | Catches the uuid-cast P0 — the current `bulkUpdatePersonSubscriptions.test.ts` uses uuid inputs and MASKS the bug; new test must drive the UI key → UUID mapping path | Rewrite/extend `handlers/communication/bulkUpdatePersonSubscriptions.test.ts` to assert the full save→reload round-trip via the mapping (not pre-resolved UUIDs) |
| FIX-006 | Officer (real seeded role `association:officer`) can CRUD templates/topics/segments → 2xx | permission/RBAC | Catches the admin/coordinator role-mismatch P1 — existing hurl runs as super-admin and masks it | Add RBAC unit/integration test using a seeded officer role; update `015-announcements-templates.test.ts` to run as officer, not super-admin; add officer-role hurl variant in `specs/api/tests/contract/` |
| FIX-007 | Cross-org announcement mutation rejected (Org A officer → Org B announcement by id → 403/404) | permission/RBAC | Catches tenant-isolation P1 | New RBAC test in `handlers/communication/` covering publish/update/delete/archive org-mismatch |
| FIX-008 | Delivery stats populated after publish; analytics renders real data | integration + frontend-component | Catches empty-stats P1 (WF-048) — stats must be non-empty after a real publish and the analytics page must read them | Backend: extend `handlers/communication/getAnnouncementStats.test.ts` to assert stats after fan-out. Component: `apps/memberry/.../communications/__tests__/analytics-dashboard.test.tsx` against populated data |
| FIX-009 | In-app mandatory opt-out rejected server-side | permission/data | Enforces M7-R1 — server must reject/ignore `inApp:false` for mandatory topics | New test in `handlers/communication/updatePersonSubscription.test.ts` (and/or `bulkUpdatePersonSubscriptions.test.ts`) |
| FIX-010 | Template missing variable renders a placeholder (not empty); invalid Handlebars rejected on save | backend/unit | M7-R4 graceful fallback + save-time syntax validation | Extend `handlers/communication/communication.test.ts` (render) and add to `createMessageTemplate.test.ts` (validation) |
| FIX-011 | n/a (doc-only) | — | No code behavior change; verify spec text and `HAND_WIRED_ROUTES.yaml` no longer assert false wiring | n/a |

Note (regression discipline per gap plan §19/§26): `ac-m07.communications.test.ts`, `br-26.session-management.test.ts`, `br-35.feed-moderation.test.ts`, `ac-m13.professional-feed.test.ts` are inline reimplementations that "prove nothing about real code paths." Do NOT treat them as coverage. During Batch D, prefer driving AC-M07-001..006 through real handlers; do not weaken or rely on the inline versions.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `services/api-ts/src/app.ts` (init, add `registerCommunicationJobs(...)`); `services/api-ts/src/core/domain-event-consumers.ts` (add `announcement.published` subscriber); `services/api-ts/src/handlers/communication/jobs/announcementSend.ts` (entry/registration); `services/api-ts/src/handlers/communication/publishAnnouncement.ts` (direct-call option) | shared/platform (app.ts + event bus) + module-local | High — `app.ts` boots all jobs; event bus has 9 subscribers. Keep edits to one init line + one module-owned subscriber block. |
| FIX-002 | Same as FIX-001 (`announcementSend.ts:271` cron handler is registered by the same `registerCommunicationJobs` wiring) | shared/platform + module-local | High (same surface as FIX-001) |
| FIX-003 | `apps/memberry/src/features/communications/components/compose-form.tsx` (chain create→publish/schedule); possibly `createAnnouncement.ts` UX copy alignment | module-local (frontend) | Medium — single officer compose flow |
| FIX-004 | `services/api-ts/src/handlers/communication/listPersonSubscriptions.ts` (response shape → `{data,pagination}`); possibly `apps/memberry/src/features/communications/.../notification-preferences.tsx` read path | module-local | Low-Medium — must match generated `PersonSubscriptionListResponseSchema` |
| FIX-005 | `apps/memberry/.../notification-preferences.tsx` (key→UUID mapping); `services/api-ts/src/handlers/communication/bulkUpdatePersonSubscriptions.ts`; `services/api-ts/src/handlers/communication/repos/communication.schema.ts` (only if a `slug` column is chosen over UI-side mapping); `seed/layer-7-comms.ts` (reference seeded UUIDs) | module-local (database/schema only if `slug` column added) | Low-Medium — confined to prefs; schema touch optional |
| FIX-006 | `specs/api/src/association/core/communication.tsp` (re-role 18 ops); regenerate `services/api-ts/src/generated/openapi/{routes,validators,registry}.ts` via `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate` | module-local TypeSpec + generated regen (NEVER hand-edit generated files) | Medium — regen affects only communication routes; verify no unrelated diff |
| FIX-007 | `services/api-ts/src/handlers/communication/publishAnnouncement.ts`, `updateAnnouncement.ts`, `deleteAnnouncement.ts`, `archiveAnnouncement.ts`; possibly `communication.repo.ts` (`get(id, orgId)` signature) | module-local | Medium — depends on `repo.get` signature confirmation (section 8) |
| FIX-008 | `services/api-ts/src/handlers/communication/repos/communication.repo.ts:262-276` (stats join on list); `getAnnouncementStats.ts`; `apps/memberry/.../analytics.tsx` | module-local | Low-Medium — depends on FIX-001 delivery producing stats |
| FIX-009 | `services/api-ts/src/handlers/communication/updatePersonSubscription.ts` and/or `bulkUpdatePersonSubscriptions.ts` (server guard); `apps/memberry/.../notification-preferences.tsx:49` (disable in-app toggle for mandatory topics) | module-local | Low |
| FIX-010 | `services/api-ts/src/handlers/communication/jobs/announcementSend.ts:28-36` (Handlebars placeholder); `previewMessageTemplate.ts:37`; `createMessageTemplate.ts` (syntax validation) | module-local | Low |
| FIX-011 | `docs/product/modules/m07-communications/MODULE_SPEC.md` (§10); `docs/quality/HAND_WIRED_ROUTES.yaml` (entries 107-109) | docs only | None (doc) |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 / FIX-002 | shared/platform | pg-boss job registry + `app.ts` init (lines ~670-683) | Communication jobs must be registered at boot like email/notifs/booking/etc. | No — this IS the fix; touch minimally |
| FIX-001 / FIX-002 | shared/platform | Domain event bus + `core/domain-event-consumers.ts` | Subscriber for `announcement.published` must be added here (module-owned block per CLAUDE.md P1.6) | No — this IS the fix; add one module-owned block |
| FIX-001 / FIX-002 | shared/platform `[SHARED DEPENDENCY]` | Email job/queue (`handlers/email/jobs`) and Notifs/push (`handlers/notifs/jobs`, OneSignal) | Fan-out enqueues email + push; in-app rows come from notifs | No — wire the communication TRIGGER only; do NOT modify email/notifs internals |
| FIX-005 | database/schema (module-local) | `person_subscription.topic_id uuid` + seeded topic UUIDs in `seed/layer-7-comms.ts` | UI keys must resolve to seeded topic UUIDs (or add a `slug` column) | Yes — confirm seeded topic UUID set before coding the mapping |
| FIX-006 | shared/platform (generator) | `x-security-required-roles` generator (`services/api-ts/scripts/generate.ts`) + regen pipeline | Re-roling requires TypeSpec edit then full regen of routes/validators | No — standard regen workflow; verify diff scope |
| FIX-007 | module-local + product/eng confirmation | `communication.repo.ts` `get(id[, orgId])` signature | Determines whether to add an org param to fetch or a post-fetch assertion | Yes — `[NEEDS CONFIRMATION]` (section 8) before coding |
| FIX-008 | module-local | Depends on FIX-001 (live fan-out writes `announcement_stats`) | Stats are produced only by the now-live delivery path | Yes — FIX-001 must land first |
| (out of scope) | cross-module `[CROSS-MODULE RISK]` | Feed tables (4) + survey schema co-located in `communication/repos` | Module-boundary leak; m13/m18 logically separate | Route to db-schema audit (`06`); do NOT refactor in this fix pass |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Is `announcement` (broadcast) or `message` the canonical delivery primitive? Both have full send/schedule surfaces. | `[NEEDS PRODUCT DECISION]` | FIX-001, FIX-002, FIX-003 | Determines which pipeline to wire; avoids double-building | Recommended default: wire the ANNOUNCEMENT primitive only (m07 WF-046..050 and the gap plan are announcement-centric). Leave messages untouched. Confirm with Product before expanding messages. Does NOT block Batch A under this default. |
| Does `communication.repo.get(id)` accept an org param, or must mutation handlers add an explicit `existing.organizationId === ctxOrgId` assertion? | `[NEEDS CONFIRMATION]` | FIX-007 | Shapes the tenant-isolation fix (signature change vs post-fetch assert) | Eng: confirm `repo.get` signature before coding FIX-007. Gates Batch B start for this fix only. |
| Can a member call `listPersonSubscriptions` with another member's `personId`? | `[NEEDS CONFIRMATION]` | FIX-004 (and a potential follow-on PII fix) | If unscoped, it is a P1 PII leak; if scoped, no extra work | Eng: verify org/self scoping on the `personId` query during FIX-004. If unscoped, add a self/officer guard (fold into Batch B as a sub-task). |
| Should preference (consent) changes be audited? | `[NEEDS PRODUCT DECISION]` | FIX-009 (and prefs save) | Opt-out is consent-relevant (legal/trust); no audit set today | Product + Compliance decision. If yes, add an audit entry on preference change. Treated as deferred until decided — not in active Batch C scope unless confirmed. |
| Is announcement title max 200 (code) or 300 (spec §7) correct? | `[NEEDS PRODUCT DECISION]` | (none active) | Minor schema/spec reconciliation | Product: confirm intended max; deferred (section 10) until decided. |
| Does the `x-audit` extension actually compose audit events for announcement transitions at runtime? | `[NEEDS CONFIRMATION]` | (none active — verification only) | Confirms record-history completeness | Eng: verify during Batch A/B; no code change unless it is found broken. |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Professional feed (m13): scaffold per spec OR remove dead code (handlers + 4 tables + seed + orphaned `feed-moderation.hurl`) | `[NEEDS PRODUCT DECISION]` `[BLOCKED BY MISSING SPEC]` | m13 ranking/curation/moderation rules undefined; deferred per index §20 | Product decision on feed behavior + spec; then either scaffold (separate effort) or remove dead code (separate cleanup) |
| Messages subsystem expansion / its own delivery pipeline | `[DO NOT OVERBUILD]` `[NEEDS PRODUCT DECISION]` | Parallel to announcements; wiring both doubles the fix surface with no single source of truth | Decide canonical primitive (section 8 item 1) |
| FIX-007 tenant-isolation code change | `[NEEDS CONFIRMATION]` | `repo.get` signature unknown (org param vs post-fetch assert) | Eng confirms `repo.get(id[, orgId])` signature |
| Consent-change audit on preference toggles | `[NEEDS PRODUCT DECISION]` | No decision on whether opt-out toggles must be audited (legal) | Product + Compliance decision |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| M7-R6 high-priority push override (`priority` field + override branch) | gap plan §5, §10, §22, §23 | `V2 DEFERRED` | Needs a `priority` column; only meaningful after delivery pipeline lives |
| Announcement `Cancelled` state (enum value + cancel endpoint) | gap plan §4 (Spec §8), §13, §22, §23 | `V2 DEFERRED` | Useful only once scheduling is real |
| Unique `(name, org)` index on `message_template` | gap plan §4, §13, §22, §23 | `V2 DEFERRED` | Minor; no current collision evidence |
| Saved-segment-driven smart audiences | gap plan §6, §9, §23 | `V2 DEFERRED` | No delivery consumer yet; premature until WF-046 delivery is real |
| Title max 200-vs-300 reconciliation | gap plan §4, §13, §25 | `[NEEDS PRODUCT DECISION]` | Minor spec/code mismatch; decide max first |
| Feed/survey schema co-location refactor in `communication/repos` | gap plan §13, §16, §21, §23 | `[DO NOT OVERBUILD]` (here) / route to `06` | Cross-module/db concern; belongs to db-schema/cross-cutting audit, not this fix pass |
| `delivery-funnel.tsx` "looks done" component | gap plan §6 | `[DO NOT OVERBUILD]` | Only meaningful once stats pipeline (FIX-008) lives; no separate work needed |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Second analytics warehouse / open-rate pixel tracking | gap plan §23 | Overbuild — basic sent/delivered stats (FIX-008) suffice for V1 |
| A parallel messages delivery pipeline alongside announcements | gap plan §6, §17, §22, §23 | Duplicate source of truth; pick one canonical primitive (announcements) first `[DO NOT OVERBUILD]` |
| Scaffolding the feed without an agreed m13 spec | gap plan §5, §23, §25 | Ranking/moderation rules undefined; scaffolding now would be speculative `[NEEDS PRODUCT DECISION]` |
| Broad refactor to split feed/survey schemas out of the communication module | gap plan §23 | Cross-module/db concern outside this module's fix scope; route to db-schema audit |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Missing wiring: `registerCommunicationJobs` never called + no `announcement.published` subscriber. Fix the wiring, not a workaround. |
| FIX-002 | Root cause (same as FIX-001) | Cron handler exists but is never registered — resolved by the same job-registration wiring. |
| FIX-003 | Root cause | UI sends `status:'sent'` but server force-drafts and PATCH strips status; the create→publish/schedule chain is the correct contract path. Fix the flow, not the toast. |
| FIX-004 | Root cause | Handler violates its own generated OpenAPI response schema. Conform handler to `{data,pagination}` — do not patch the UI to read `{items}`. |
| FIX-005 | Root cause | Type mismatch: synthetic string topicIds vs `uuid` column. Map UI keys → seeded topic UUIDs (or add `slug` column) — both are root-cause fixes; choose mapping to avoid schema churn. |
| FIX-006 | Root cause | TypeSpec ops declare nonexistent `coordinator` role + `admin` officers lack. Re-role at the TypeSpec source and regenerate — do not grant officers `admin`. |
| FIX-007 | Root cause (pending confirmation) | Mutation handlers fetch by id without org scope; position check uses caller header org. Add org match on fetch. `[NEEDS CONFIRMATION]` on `repo.get` signature before coding. |
| FIX-008 | Root cause | Stats are only written by the dead fan-out and never joined on list. Fix flows from FIX-001 (delivery writes stats) + surface them on list/stats endpoints. |
| FIX-009 | Root cause | No server-side enforcement of M7-R1; client-only behavior. Add server guard (authoritative) + UI disable (cosmetic). |
| FIX-010 | Root cause | Handlebars `strict:false` silently drops missing vars; no save-time validation. Set placeholder fallback + validate syntax on save. |
| FIX-011 | Symptom (doc drift) | Spec/yaml text is stale vs code; doc-only correction. No runtime behavior. |

## 13. Recommended First Fix Batch

**Batch A — P0 delivery spine + prefs pipeline.**

- **Included Fix IDs:** FIX-001, FIX-002, FIX-003, FIX-004, FIX-005.
- **Why this batch comes first:** The module's audit decision is FAIL for exactly one reason — an announcement never reaches a member and a member can't manage prefs. Every downstream fix (RBAC, tenant, stats) is cosmetic until the delivery spine and prefs pipeline work. FIX-001/002 are the same root (job registration). FIX-003 is the FE half of the same broken send journey. FIX-004/005 are an independent P0 sub-batch (prefs load/save) that can proceed in parallel.
- **Tests to write FIRST (RED), per section 5:**
  1. Prefs load against real contract shape `{data,pagination}` (FIX-004) — current component test mocks the SDK and hides this.
  2. Prefs save with a REAL seeded topic UUID, asserting persist+reload (FIX-005) — the current `bulkUpdatePersonSubscriptions.test.ts` uses uuid inputs and MASKS the bug; it must be rewritten.
  3. Publish → fan-out integration (job registered + subscriber fires; FIX-001) — `announcementSend.test.ts` only tests the fn in isolation; add a registration+trigger test.
  4. Scheduled-cron fires (FIX-002) integration test.
  5. Compose "Send Now"/"Schedule" E2E asserting `sent`/`scheduled` + recipient receipt (FIX-003) — convert the likely-nav-only `communication-delivery.spec.ts` to a real-flow assertion.
- **Explicit out-of-scope for this batch:** FIX-006/007/008 (Batch B — after the spine); FIX-009/010/011 (Batch C); the feed (blocked); the messages pipeline (do not build); M7-R6 priority push, announcement cancel state, saved-segment audiences, title reconciliation (deferred); feed/survey schema co-location refactor (route to db-schema audit). Do NOT modify email/notifs job internals — wire the communication trigger only.

## 14. Instructions for 04 Fix Prompt

- **Exact module/group name:** Communications (+ feed)
- **Exact module slug:** `communications`
- **Exact fix-ready plan path:** `/Users/elad-mini/Desktop/memberry/docs/aha/module-fix-plans/communications-fix-ready-plan.md`
- **Source gap plan (context only):** `/Users/elad-mini/Desktop/memberry/docs/aha/module-gap-plans/communications-gap-plan.md`
- **Exact batch to execute first:** Batch A — P0 delivery spine + prefs pipeline (FIX-001, FIX-002, FIX-003, FIX-004, FIX-005). Do NOT execute Batch B/C in the same pass.
- **Tests to prioritize (write RED first, in this order):** (1) prefs load contract-shape `{data,pagination}`; (2) prefs save with real seeded topic UUID, persist+reload (rewrite `bulkUpdatePersonSubscriptions.test.ts` — it currently masks the bug); (3) publish→fan-out integration (job registered + subscriber fires); (4) scheduled-cron fires; (5) compose "Send Now"/"Schedule" E2E asserting `sent`/`scheduled` + recipient receipt (convert `communication-delivery.spec.ts` from nav-only). Do NOT trust the inline `ac-m07.*`/`br-*` tests as coverage.
- **Files likely to touch:** `services/api-ts/src/app.ts` (init — one `registerCommunicationJobs(...)` line); `services/api-ts/src/core/domain-event-consumers.ts` (one `announcement.published` subscriber block per CLAUDE.md P1.6); `services/api-ts/src/handlers/communication/jobs/announcementSend.ts`; `services/api-ts/src/handlers/communication/publishAnnouncement.ts`; `services/api-ts/src/handlers/communication/listPersonSubscriptions.ts`; `services/api-ts/src/handlers/communication/bulkUpdatePersonSubscriptions.ts`; `apps/memberry/src/features/communications/components/compose-form.tsx`; `apps/memberry/.../notification-preferences.tsx`; seeded topic UUIDs in `services/api-ts/src/seed/layer-7-comms.ts`.
- **Shared/database cautions:** `app.ts` init boots all jobs and the domain-event bus has 9 existing subscribers — keep edits to one init line + one module-owned subscriber block (Batch E discipline). Email/notifs are `[SHARED DEPENDENCY]` — wire the communication TRIGGER only; do NOT modify email/notifs job internals. For FIX-005, prefer mapping UI keys → seeded topic UUIDs over adding a schema column (avoid schema churn); a `slug` column is the fallback only. Restart the API server after adding the new job registration (no hot-reload for new registrations).
- **Items NOT to implement (this pass):** Batch B (FIX-006 RBAC re-role, FIX-007 tenant isolation — also `[NEEDS CONFIRMATION]` on `repo.get`, FIX-008 stats) — separate `04` pass after Batch A is green; Batch C (FIX-009/010/011); the professional feed (blocked — `[NEEDS PRODUCT DECISION]`/`[BLOCKED BY MISSING SPEC]`); a parallel messages delivery pipeline (`[DO NOT OVERBUILD]` — decide canonical primitive, default to announcements); M7-R6 priority push, announcement `cancelled` state, saved-segment smart audiences, unique template-name index, title 200-vs-300 reconciliation (deferred); feed/survey schema co-location refactor (route to db-schema audit `06`); a second analytics warehouse / open-rate pixel tracking (do not build).

---

Next recommended step:
```
Module/group: Communications (+ feed)
Module slug: communications
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/communications-fix-ready-plan.md
Recommended batch: Batch A — P0 delivery spine + prefs pipeline
```
