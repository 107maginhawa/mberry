# Codebase Review — Master Synthesis (2026-06-16)

## Remediation status (updated end of session)

Suite: **7627 pass / 0 fail / 5 todo** (7728 tests, 737 files). Coverage **93.70% lines / 88.53% funcs** (was 90.07/85.41). Typecheck CLEAN.

**FIXED + regression-tested this session:**
- storage `getFile` cross-org guard · marketplace `updateVendor` cross-org guard
- document `storageKey` exfil gate · jobs cross-org IDOR · booking/event races (atomic claim + partial unique indexes) — *verified in-tree*
- `timeSlot.repo` locationTypes jsonb filter (was throwing `jsonb && text[]`) → `jsonb_exists_any` bound param
- x-audit now emits `outcome:'failure'`/`'denied'` on 4xx/5xx (was silently skipped)
- credit cross-org leak (`listMemberCreditsForPeer`) fail-closed on missing org
- dues refund over-refund race → `SELECT…FOR UPDATE` atomic
- dues module 0 → 35 tests; repo layer laggards (2–40%) → ~100%

**RESOLVED (was "needs decision"):**
- ✅ **Migration `0073_booking_event_unique_indexes`** — hand-authored idempotent migration (matching the repo's 0061–0072 convention; drizzle-kit generate is unusable due to sparse snapshots, NOT a real history gap). Applied + verified: both `bookings_active_slot_unique` and `uq_event_reg_active` exist in the DB. Release blocker cleared.
- ✅ **comms WebRTC/WS auth** — `getCallSigningSecret()` accessor (fail-closed in prod, no `dev-fallback`); signed `call-token` (HMAC over {callId,personId,exp}, 1h TTL) verified per call; `video.*` relay now requires a token bound to the active call; per-frame org-isolation + active-membership re-check on every `chat.message`/`video.*`.
- ✅ **system/ typecheck** — the 3 orphan health stubs (dead WIP, unregistered; real health lives in `@/core/health`) now typecheck-clean.

All earlier self-contained P1s also landed (announcement consent/category/unsubscribe, cascade subscribers, invite atomicity, billing idempotency, frontend a11y/debounce).

**Final state:** typecheck 0 errors · full suite **7659 pass / 0 fail / 5 todo** (738 files) · coverage 93.70% lines.

**ALL deferred P2s now also fixed:**
- ✅ announcement cron double-blast — `claimScheduled` atomic claim (scheduled→sent).
- ✅ cert-numbering — `INSERT…ON CONFLICT DO UPDATE…RETURNING` (gap-free, no first-of-year race); removed divergent `count(*)` path (zero prod callers).
- ✅ unbounded `list*` (6+ handlers) — clamped via shared `core/pagination.ts clampPageSize` (default 100, max 500).
- ✅ sync matview refresh — moved off request path to a `compliance.recompute` fire-and-forget domain event.
- ✅ `/review` adversarial finds — `chat.typing` per-frame authz; event re-registration single-row transition.

**Only intentional leave (V1):** call-token 1h TTL (signed+expiring; hardening deferred until calls scale — needs a re-mint path).

**Final final state:** typecheck 0 errors · suite **7690 pass / 0 fail / 5 todo** (739 files) · coverage 93.70% lines.

**Known flaky (non-blocking):** `comms/repos/comms-repos.integration.test.ts` `ChatRoomMemberRepository (real DB) > markRead` can fail under parallel real-DB connection contention; passes in a clean single run. Worth isolating its DB fixture later.

---


Branch `fix/audit-remediation-2026-06`. 8 module clusters reviewed intra + cross. Baseline: typecheck CLEAN, eslint CLEAN — risk is logic/security/contracts/coverage, not style.

Per-cluster detail: `01-identity.md` … `08-cross-module.md`. Grounding: `00-REFERENCE.md`.

## Severity roll-up (deduped, highest first)

### P0 — exploitable / data-corrupting
| # | file:line | Label | Problem | Fix |
|---|---|---|---|---|
| 1 | `booking/repos/booking.repo.ts:151,215-220` | Intra | Double-booking race: status checked then flipped, **no unique constraint on `bookings.slot`** → 2 concurrent books on 1 slot + dup invoices | Atomic `UPDATE…WHERE status='available' RETURNING` in tx + unique partial index |
| 2 | `events/registerForEvent.ts:31-41`, `events.schema.ts:92` | Intra | Capacity overflow + double-register: count-then-insert, **no unique(eventId,personId)** | unique index + atomic guarded insert. Model: `elections/castVote.ts` (unique + 23505 catch) |
| 3 | `documents/createDocument.ts:51` + `downloadDocument.ts:48` | Cross | Client-supplied `storageKey` stored verbatim, presigned at download → point a self-owned doc at any bucket UUID → cross-tenant exfil | Validate storageKey was issued to this owner/org; don't trust client key |
| 4 | `comms/joinVideoCall.ts:233-237`, `ws.chat-room.ts:196-209` | Intra | WebRTC token uses `'dev-fallback'` secret if env unset + never verified; `video.*` relay gates on room membership only → call hijack / capacity bypass | Fail-closed on missing secret; verify signed token per call |
| 5 | `comms/ws.chat-room.ts:115-214` | Intra | WS `chat.message` skips the cross-org guard REST enforces; membership only checked at connect → revocation ignored for socket lifetime | Re-check org + membership per message |

### P1 — high
| # | file:line | Label | Problem | Fix |
|---|---|---|---|---|
| 6 | `member/credits/listMemberCreditsForPeer.ts:31` + `credits.repo.ts:60` | Cross | Undefined org context drops org filter → peer CPD view leaks credits across ALL orgs | Require orgId; fail-closed if absent |
| 7 | `dues/refundDuesPayment.ts:61-101` | Intra | Over-refund race: `refundedAmount` read outside tx, total from stale read → concurrent partial refunds exceed original | `FOR UPDATE` / atomic guarded UPDATE |
| 8 | `billing/handleStripeWebhook.ts` | Intra | Non-durable idempotency (per-invoice `metadata.lastStripeEventId`, no ledger); pre-stamp error → 500 → Stripe retry → double-process | Use unique `webhook_retry_log` ledger like the dues webhook already does |
| 9 | `jobs.repo` get/update/delete + `getJobPosting`/`updateJobApplication` | Intra | Job-board id-only queries, **no org predicate** → cross-org read/edit/delete/apply by UUID | Add org scope to every job-board query |
| 10 | `storage/getFile.ts:68`; `marketplace/updateVendor.ts:29` | Intra | Missing org check that sibling handlers (`getFileDownload`/`deleteFile`; `updateListing`) all have | Add the same org guard |
| 11 | `member/governance/certifyElection.ts:82-101` + `domain-event-consumers.ts:1164` | Cross | Nominees elected + election published outside tx; officer-term via fire-and-forget bus → "elected, no officer term" on consumer failure | Wrap in tx or make officer-term creation durable/retryable |
| 12 | `per-route-audit.ts:59,84,105` | Cross | x-audit logs only `outcome:'success'`, skips 4xx/5xx → denied/forbidden mutations leave no audit row (global `audit.ts` path logs failures) | Emit `outcome:'failure'` rows for 4xx/5xx |
| 13 | `reviews`,`advertising`,`comms`,`committee` | Cross | Hold `personId` rows but NO `person.deleted` subscriber → orphaned PII after deletion (DPA 2012) | Add cascade subscribers |
| 14 | `person/jobs/deletionProcessor.ts:70-76` + `domain-events.ts:70-82` / `accountDeletionCascade.ts` | Cross | Cascade is `allSettled` w/ swallowed rejections; person stamped `deletionCompletedAt` even on subscriber failure, no retry → silent erasure gap | Aggregate failures; don't stamp complete on partial failure; retry/alert |
| 15 | `invite/bulkImportMembers.ts:202` | Intra | Import mode destructures only `{ hash }`, discards raw token → every bulk-imported invite unclaimable | Persist/return raw token for delivery |
| 16 | `invite/claimInvite.ts:59-102` | Intra | Non-atomic claim (markClaimed then addMember, no tx; null tierId into NOT-NULL col) → invite burned, no membership, invitee locked out | Single tx; validate tierId |
| 17 | `timeSlot.repo.ts:86-88` | Intra | `sql.raw` with naive `'${t}'` quoting on `locationTypes` (enum-constrained upstream but unenforced at sink) | `arrayOverlaps()` with bound params |
| 18 | `communication/jobs/announcementSend.ts` + `core/email.ts:459,198` | Intra | No atomic claim → overlapping cron double-blasts; consent bypassed on in-app/push; bulk email mislabeled `transactional` bypasses unsubscribe+rate-limit; unsubscribe link 400s (`&org=` vs `orgId`) | Atomic job claim; honor consent/category; fix link param |

### P2 — medium
- `certificate-numbering.ts:7,31` + `certificates.repo.ts:33` — `FOR UPDATE` doesn't lock first-of-year gap; second divergent `count(*)` numbering path with incompatible format. Use `INSERT…ON CONFLICT DO UPDATE…RETURNING`.
- `dues/recordDuesPayment.ts:36-38` — duplicate payment is warn-only, never blocks.
- `platformadmin/updatePricingTier` — missing non-negative price re-validation that create has.
- association:operations — 6 unbounded `list*` handlers (no limit); 3 credit handlers run `REFRESH MATERIALIZED VIEW CONCURRENTLY` synchronously in request path.
- Frontend: un-debounced search (`directory-search.tsx:19`, `member-table.tsx:153`, `training-list.tsx:171`); icon-only buttons missing `aria-label`; member photos `alt=""`; clickable `<TableRow>` mouse-only + `window.location.assign` full reload (`payment-history-table.tsx:113`).
- `person/executeAccountDeletion.ts` — dead/unrouted, drifted scrub list omits `bio`/`gender`; tests give false confidence.

### Clean (verified, no action)
Frontend: no `dangerouslySetInnerHTML`/XSS sink (escaped JSX), uses `sonner`, no `/login`, no tokens in localStorage, ErrorBoundary present. Backend: officer-checks fail-closed; no secrets read outside `config.ts` accessors; bus error isolation via `allSettled`; fund-allocation + receipt-counter math correct (integer cents); `elections/castVote` race-safe (copy this pattern); unsub HMAC token sound; notifs OneSignal targeting + surveys/reviews authz sound.

## Test coverage gaps (priority order)
1. **dues — 0 tests / 5 src** (highest). Cover: `getNextReceiptSequence` concurrency + per-org isolation; `updatePaymentStatus` concurrent confirm-vs-reject + invalid transition; `findRecentPaymentForPerson` duplicate path; `refundDuesPayment` over-refund race.
2. **Concurrency regressions** (bug-proving): double-booking, event capacity-1 + double-register, refund double-spend, cert first-of-year race.
3. **Cross-org IDOR**: `getFile`, document-arbitrary-storageKey exfil chain, job-board cross-org, marketplace/advertising per-resource org-scope.
4. **person.deleted cascade integration** (real/transactional DB seeding all FK tables) — current unit tests mock db, pass despite orphaned modules.
5. **x-audit failure-trail** contract test (denied mutation → `outcome:'failure'` row).
6. **Governance**: `certifyElection` ties / passageThreshold / winner→officer-term consistency.
7. **invite**: bulk-import claimable-token, claim partial-failure + double-claim.
8. **onboarding** repo create/update (4 src, 1 test).
9. **Frontend E2E**: directory search→profile; announcement read/not-found; payment-history→detail keyboard nav.

## TOP 3 CRITICAL FIXES (whole codebase)
1. **Double-booking + event-capacity races (P0 #1,#2).** No unique constraints + non-atomic check-then-write. Add unique indexes (`bookings.slot` partial, `event_registration(eventId,personId)`) + atomic guarded UPDATE/insert with 23505 catch. Copy `elections/castVote.ts`. Money + integrity impact.
2. **Cross-tenant document exfiltration (P0 #3).** `createDocument` trusts client `storageKey`; `downloadDocument` presigns it → any user reads any org's files. Validate the key was issued to the caller's owner/org before storing/presigning.
3. **WebRTC/WS auth bypass (P0 #4,#5).** `'dev-fallback'` signing secret + unverified token + per-message authz skipped on the socket path. Fail-closed on missing secret, verify token per call, re-check org+membership on every `chat.message`/`video.*` frame.

Honest scope note: this is a review + coverage plan. Fixes for P0/P1 and the full 90%-coverage test build-out are follow-on work — they involve schema migrations (unique indexes), new cascade subscribers, and ~9 modules of tests. Recommend landing P0 fixes first (each with a regression test), then ratcheting coverage module-by-module starting with dues.
