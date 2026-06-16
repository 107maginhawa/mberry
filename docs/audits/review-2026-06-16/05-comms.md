# C5 — Communications Cluster Code Review (2026-06-16)

Scope: `services/api-ts/src/handlers/{communication,comms,notifs,email,surveys,reviews}`

Format: `file:line` — **[Priority][Intra|Cross]** problem. Why. Fix.
Priorities: P0 (exploitable now / data exposure), P1 (real authz/consent/idempotency gap), P2 (hardening / correctness).

---

## comms (realtime — WebSocket / chat / video)

### Authorization posture
Room membership is checked **once on connect** (`ws.chat-room.ts:67-90`), never re-checked per message in `onMessage` (`ws.chat-room.ts:115-214`). DM REST read paths are correctly gated; the WS write path diverges from REST.

`comms/searchChatMessages.ts:42-61` — **[P0][Cross]** When `organizationId` context is absent the org filter degrades to `sql\`\``, so search relies on the `participants @> [user.id]` JSONB filter alone. `getChatMessages`/`getChatRoom` defend against stale participant arrays with a join-table OR-shim + org guard; search does not — it trusts JSONB. A removed-but-still-listed member can read message bodies via search. Why: the JSONB array is explicitly documented as possibly stale (`getChatRoom.ts:64`). Fix: require org context and verify membership via `chat_room_member`, not raw JSONB.

```ts
if (!callerOrgId) throw new ForbiddenError('Organization context required for search');
// scope to org rooms OR dms AND verify membership via chat_room_member
```

`comms/ws.chat-room.ts:115-214` — **[P0][Intra]** WS `chat.message` skips the org-isolation guard that REST enforces. REST `sendChatMessage.ts:91-93` 403s on `room.organizationId !== organizationId`; the WS path calls `messageRepo.createTextMessage(roomId, user.id, data.text)` with no org check, and `resolveOrgId` (`chatMessage.repo.ts:73-87`) derives org from the room row. Connect-time guard (`ws.chat-room.ts:81-83`) has no org comparison. Two write paths, divergent authz. Fix: mirror the REST org guard in `onConnect` and `close(1008)` on mismatch.

`comms/ws.chat-room.ts:115-214` — **[P1][Intra]** No per-message membership re-check; revocation is ignored for the socket's lifetime. `onMessage` re-fetches the room for the archived guard (line 141) but never re-checks `participants`/`isMember`. A removed user keeps send + signaling ability until disconnect. Fix: re-verify membership at top of `onMessage` for `chat.message`/`video.*`.

`comms/ws.chat-room.ts:115-214` + `sendChatMessage.ts` — **[P1][Intra]** No rate limiting on any WS message or REST send. `chat.message` inserts a row + broadcasts per frame; `chat.typing` and `video.ice-candidate` are unbounded broadcasts (`ws.chat-room.ts:196-209` `publishToChannel`) — fan-out amplification + DB flood from one authenticated participant. WS `config.middleware` (`ws.chat-room.ts:50`) is `authMiddleware()` only. Fix: per-connection token bucket in `onMessage`; rate-limit middleware on the REST send route.

`comms/joinVideoCall.ts:233-237` — **[P1][Intra]** WebRTC token uses insecure fallback secret AND is never verified server-side.
```ts
const signingKey = secret || process.env['WEBRTC_TOKEN_SECRET'] || process.env['AUTH_SECRET'] || 'dev-fallback';
```
If no secret env is set, tokens are HMAC'd with the literal `'dev-fallback'` → forgeable. Worse: no code verifies this token — `video.offer/answer/ice-candidate` relay (`ws.chat-room.ts:196-209`) gates on **room** membership only, never **call** membership. So any room participant can do WebRTC signaling for an active call without ever calling `joinVideoCall`; the capacity cap (`joinVideoCall.ts:116-121`) is bypassable. Fix: fail-fast if no real secret; gate `video.*` relay on actual call-participant membership.

`comms/getIceServers.ts:12-22` — **[P2][Intra]** Returns `config.webrtc.iceServers` verbatim to any authenticated caller. If these are long-lived static TURN creds, all users share them with no expiry/rotation. Combined with the no-call-authz finding above, widens TURN abuse. Fix: issue ephemeral, per-user, time-limited TURN credentials.

`comms/ws.chat-room.ts:156-170` — **[P2][Cross]** Announcements officer-gate force-casts `(targetRoom as {organizationId:string}).organizationId`. A legacy room with null org makes `findActiveByPersonAndOrg(user.id, null)` behavior unverified (fails closed but hides the null case). Fix: guard `if (!targetRoom.organizationId) reject` first.

`comms/repos/chatRoom.repo.ts:354-367` (`isUserParticipant`) — **[P2][Intra]** Repo participant check ignores the `chat_room_member` join table. Read handlers OR-in `memberRepo.isMember` inline; write/video handlers (`sendChatMessage.ts:81`, `joinVideoCall.ts:82`, `leaveVideoCall.ts:63`, `endVideoCall.ts:64`, `updateVideoCallParticipant.ts:70`) use `room.participants.includes` only. A member tracked only in the join table (auto-joined via domain event, `createChatRoom.ts:184-190`) can read a room but cannot send to it. Inconsistent membership model. Fix: make `isUserParticipant` consult both sources; have all handlers call it.

Verified correct: DM read authz REST (`getChatMessages.ts:86-92`, `getChatRoom.ts:79-85`), WS connect authz (`ws.chat-room.ts:67-90`), archived-room write block (both paths), video start/end admin-only (`sendChatMessage.ts:148-152`, `endVideoCall.ts:71-75`), upsert privilege-escalation guard (`createChatRoom.ts:119-150`), atomic active-call claim (`chatRoom.repo.ts:331-344`).

---

## communication (announcements / templates / segments / message queue)

`communication/scheduleAnnouncement.ts` + `routes.ts:3110` — **[P1][Intra]** Schedule reaches the same org-wide fan-out as publish but lacks the President/Secretary position gate that `createAnnouncement` (`routes.ts:3134`) and `publishAnnouncement.ts:37` enforce. `updateAnnouncement` (`routes.ts:3078`) and `scheduleAnnouncement` (`routes.ts:3110`) carry only `authMiddleware({roles:["association:officer"]})` — any officer can edit a draft's title/content and schedule it to auto-publish via cron. `scheduleAnnouncement.ts:13` does call `requirePosition` inline, but it reads `ctx.get('organizationId')`, which on the `/:id/schedule` path resolves the **announcement id**, not org (org-context regex, `org-context.ts:90`) — same bug `publishAnnouncement.ts:26-37` works around. Fix: fetch `existing`, `ctx.set('organizationId', existing.organizationId)`, then `requirePosition`; add `requirePositionMiddleware` to the update route.

```ts
const existing = await repo.get(id);
if (!existing) throw new NotFoundError('Announcement');
ctx.set('organizationId', existing.organizationId);
const denied = await requirePosition(ctx, [POSITION_TITLES.PRESIDENT, POSITION_TITLES.SECRETARY]);
if (denied) return denied;
```

`communication/savedSegments.ts:13-39` (createSavedSegment) — **[P1][Cross]** `organizationId` is read from the request body (line 18) and written (line 33) after only an `if (!session)` check. The `/communications/*` mount uses `orgContextOptionalMiddleware` (fails open). An officer of org A can create/list/delete saved segments owned by org B (same pattern lines 46, 63). Fix: derive org from verified context.

```ts
const orgId = ctx.get('organizationId');
if (!orgId || orgId !== body.organizationId) return ctx.json({ error: 'Org mismatch' }, 403);
```

`communication/previewMessageTemplate.ts:38-42` — **[P2][Intra]** Raw `String()` interpolation of caller-supplied `mergeData` into subject/body with no HTML escaping: `text.replace(/\{\{(\w+)\}\}/g, (_m,key)=>String(mergeData[key]))`. Returned as JSON; if the frontend `dangerouslySetInnerHTML`s the preview (likely for HTML email bodies) → reflected XSS. Subject interpolation enables CRLF/header injection if it ever becomes an email `Subject:`. Less safe than prod render (`email/repos/template.repo.ts:412-414` uses auto-escaping Handlebars). Fix: render preview through the same escaped Handlebars path, or HTML-escape values.

`communication/jobs/announcementSend.ts:147-167` — **[P1][Intra]** Consent enforcement is channel-inconsistent. Email branch checks `personSubscriptions.enabled=false` (lines 154-172) but in-app (line 118) and push (line 224) fan out with **no** opt-out check — in-app rows even written `consentValidated:false` (line 134). A member who disabled announcement notifications still gets in-app + push. The email check is also org-wide-blunt (matches org only, not topic/category — one disabled topic suppresses ALL announcement email; over-suppress vs under-suppress mismatch). Fix: route all three channels through `notificationPreferenceRepoPort.isCategoryEnabledForPerson(...)` (`communication.repo.ts:464`).

`communication/jobs/announcementSend.ts:285-323` — **[P1][Intra]** Publish/send path has no idempotency, retry, or dead-letter. The `announcement.published` subscriber (285-304) is fire-and-forget with a swallowing try/catch (line 301) — crash mid-fan-out leaves partial delivery, no retry. The cron (307-323) does `updateStatus('sent')` then `processAnnouncementSend` with no row lock; `findScheduledDue` (`communication.repo.ts:346`) selects `status='scheduled' AND scheduledAt<=now()` with no lock, so two overlapping ticks (or publish racing cron) both fan out → duplicate org-wide blast. `announcementStats` is insert-only (line 403) → duplicate stats rows. Per-recipient email/push failures are caught and dropped (212-215, 240-242) with no DLQ. Fix: atomic claim (`UPDATE ... SET status='sent' WHERE id=? AND status='scheduled' RETURNING`, fan out only on returned row); per-recipient delivery ledger / watermark; re-queue dropped sends.

`communication/jobs/announcementSend.ts:49-55` — **[P1][Intra]** Recipient resolution hard-capped at `limit:10000, offset:0` — orgs >10k members get a silently truncated blast (compliance gap), and smaller orgs load up to 10k full member+person rows into memory per announcement. Fix: paginate / stream recipients in batches.

`communication/jobs/announcementSend.ts:227-243` — **[P1][Intra]** Push fan-out is a true N+1: one `notifsService.createNotification` await per recipient (229-238). Email send (194-216) is also per-recipient sequential await. In-app and email-lookup were batched (BATCH_SIZE=50); push and email-send were not. Fix: bulk push API or bounded-concurrency `Promise.all`; batch email enqueue.

`communication/sendMessage.ts:55-64` / `createMessage.ts:35` — **[P2][Intra]** `body.recipientPersonIds` / `existing.recipients` drive `inArray(...)` with no length cap — oversized IN-list / param-count blowup. Fix: max-recipients validation.

`communication/repos/communication.repo.ts:52` (MessageTemplateRepository.search) — **[P2][Intra]** `like(messageTemplates.name, \`%${filters.q}%\`)` does not escape LIKE wildcards (announcement search at line 321 correctly uses `escapeLikePattern`). LIKE-wildcard DoS (`%%%%`), not SQLi. Fix: apply `escapeLikePattern`.

`communication/getAnnouncementStats.ts:14` / `scheduleAnnouncement.ts:22` — **[P2][Cross]** `repo.get(id)` with no org arg → cross-tenant read of stats/announcement by id. Stats route (`routes.ts:3120`) is `association:member` with no org binding; any member of any org can read another org's announcement stats/title by guessing the id. Fix: pass `ctx.get('organizationId')` to `repo.get(id, orgId)`.

Verified SAFE: no SQL injection. Saved-segment `filters` is opaque JSONB consumed in-memory or via typed/parameterized queries (`announcementSend.ts:43-87`); the one raw `sql` (179-181) parameterizes via `ANY(${personIds})`. The exported `renderMergeFields` Handlebars `noEscape:true` (`announcementSend.ts:31`) is dead code on the fan-out path (content inserted directly) — but should be removed to prevent future misuse.

---

## email (transactional queue / unsubscribe)

`email/utils/unsub-token.ts:34-65` — **VERIFIED SAFE.** HMAC-SHA256 over `email|orgId` with server secret (`getUnsubscribeSecret()`, fails-loud in prod), constant-time `timingSafeEqual` with length pre-check. Not forgeable. No timing leak.

`core/email.ts:459` + `app.ts:374-380` — **[P1][Cross]** One-click unsubscribe link is broken (param mismatch). Send builds `&org=${orgId}` but the route validator (`app.ts:378`) requires `orgId` (`z.string().uuid()`) and the handler reads `c.req.query('orgId')` (`unsubscribeEmail.ts:43`). Every List-Unsubscribe link 400s before `verifyUnsubToken` runs — CAN-SPAM / RFC 8058 break. Fix (one char): `&orgId=...` at `core/email.ts:459`.

`core/email.ts` suppression guard + `announcementSend.ts:198` — **[P1][Cross]** Suppression unsubscribe-override bypassed for bulk announcements. Transactional mail overrides an `unsubscribe` suppression; bulk does not. But `queueEmail` in `announcementSend.ts:198-209` never sets `emailCategory`, and schema defaults to `'transactional'` (`email.schema.ts:197`) → announcement emails get the override and reach members who unsubscribed. Fix: pass `emailCategory:'bulk'`.

`email/utils/bulk-rate-limiter.ts` + `announcementSend.ts:198` — **[P1][Cross]** Bulk rate limiter is dead code in practice. Gated on `emailCategory === 'bulk'` (`core/email.ts`), which announcement sends never set (same root cause) → `canSend()` never called for the one bulk path. Same one-line fix re-arms both suppression and rate limiting. Secondary [P2]: limiter is in-memory per-process — multi-instance deploys multiply the effective limit.

`email/utils/unsub-token.ts:34` + `unsubscribeEmail.ts:42` — **[P2][Intra]** No email normalization (no lowercase/trim) → token + suppression case-fragility; unsubscribe silently fails if client casing differs. Fix: `email.trim().toLowerCase()` before HMAC and suppression insert/lookup.

`email/unsubscribeEmail.ts:40-65` — **[P2][Intra]** Token has no expiry / replay protection (deterministic, eternal). Acceptable for idempotent unsubscribe; do NOT reuse this token shape for any privileged action.

`core/email.ts:86-96 / 150-157 / 216-224` — **[P2][Intra]** No CRLF sanitization on subject/from/replyTo/raw headers. Fields are admin-authored (lower severity), but the OneSignal email path and raw headers merge have no guard. Fix: strip `[\r\n]` before assigning outgoing headers.

`email/updateEmailTemplate.ts:61` — **[P2][Cross] (unverified)** `findOneById` lookup with no org scoping — cross-tenant template risk if `admin` is not platform-global. Verify `EmailTemplateRepository.findOneById` is org-scoped.

Verified OK: queue retry/dead-letter (`queue.repo.ts:146-184,264-277` — exponential backoff, 3-attempt cap, `nextRetryAt=null` dead-letters, excludes cancelled). Admin gates on test/retry/create/update template handlers.

---

## notifs (OneSignal multi-channel)

`notifs/repos/notification.repo.ts:499-502` — **VERIFIED CORRECT.** `include_aliases = { external_id: [notification.recipient] }` uses the recipient person id; `targetApp` tag (505-509) narrows, never broadens. No cross-user leakage.

`notifs/repos/notification.repo.ts:285-368` — **VERIFIED OK.** `findOneByIdAndRecipient` filters `id AND recipient=userId`; `getNotification.ts:37`, `markNotificationAsRead.ts:37`, `markAllAsRead`, `listNotifications.ts:54` all recipient-scoped. `getNotification.ts:41` returns 404 (not 403) to avoid existence disclosure. No cross-user read.

`notifs/repos/notification.repo.ts:203-216` — **[P2][Intra]** Suppressed-notification synthetic object returns `status:'failed'`; callers treating that as a real delivery failure could mis-report/retry. The `suppressed:true` flag is the correct discriminator — ensure callers check it.

---

## surveys

`surveys/submitSurveyResponse.ts:73-99` — **VERIFIED OK.** Org-scoped (404 on mismatch), active+deadline gated, dedup via `findByResponderAndSurvey` (409 unless `allowReedit`), anonymous strips `responderId`.

`surveys/submitSurveyResponse.ts:95` + `survey.repo.ts:338-350` — **[P2][Intra]** Dedup unenforced for anonymous surveys: `responderId` is null for anonymous (line 149) so `findByResponderAndSurvey` never matches → unlimited anonymous submissions (ballot stuffing on anonymous polls/NPS). May be intended (anonymity vs dedup). If one-per-member required, add a separate hashed responder marker.

`surveys/exportSurveyResponses.ts:57-72` — **VERIFIED OK** (officer-or-admin via `hasRole`/`OfficerTermRepository`, org-scoped, anonymous omits respondent column, `escapeCsv`). **[P2]** CSV injection: `escapeCsv` quotes but doesn't neutralize leading `=`/`+`/`-`/`@` formula triggers. Fix: prefix such cells with `'`.

`surveys/deleteMemberResponses.ts:18-45` / `listSurveyResponses.ts:38-45` — **VERIFIED OK** (scoped to `userId`+`organizationId`; officer/admin gate; anonymous nulls responder).

---

## reviews (NPS)

`reviews/createReview.ts:45-59` — **VERIFIED OK.** Self-review blocked, dedup via `reviewExists` (409), reviewer forced to `session.user.id`, org from context.

`reviews/getReview.ts:33` — **[P2][Intra]** Bare `session.user.role === 'admin'` silently fails for comma-separated multi-role users (e.g. `'admin,officer'`). `listReviews.ts:36` already fixed this with `hasRole(...)`; getReview was missed. Availability bug (admin denied access), not a leak. Fix: `const isAdmin = hasRole(session.user, 'admin');`.

`reviews/listReviews.ts:62-77` / `review.repo.ts:109-114` — **VERIFIED OK** (non-admins forced to own reviewer/reviewedEntity, 403 on cross-user; `canUserAccessReview` limits to reviewer/reviewed/admin). No broad NPS leak.

---

## Test gaps (named, uncovered)

1. **WS per-message authz** — no test that a removed/revoked member loses send + `video.*` signaling on a live socket (membership only checked on connect).
2. **WS vs REST org-isolation parity** — no test that the WS `chat.message` path rejects cross-org sends the way `sendChatMessage` does.
3. **DM / search stale-participant read** — no test that `searchChatMessages` denies a removed-but-still-in-JSONB member; no test for org-context-absent search.
4. **Unsubscribe end-to-end** — no test that the generated unsubscribe link actually resolves (would have caught the `org` vs `orgId` 400).
5. **Bulk send consent + category** — no test that announcement emails carry `emailCategory:'bulk'`, honor suppression/unsubscribe, and that in-app/push respect opt-out.
6. **Announcement idempotency** — no test for double-publish / overlapping-cron duplicate fan-out (atomic claim).

---

## Top 3 Critical (C5)

1. **`comms/joinVideoCall.ts:233-237` + `ws.chat-room.ts:196-209` — [P0/P1] WebRTC signaling has no call-level authz and a forgeable token.** The token uses a `'dev-fallback'` secret if env unset and is never verified; `video.*` relay gates on room membership only, so any room participant can hijack/join an active call's signaling and bypass the capacity cap. Fail-fast on missing secret + gate signaling on actual call-participant membership.

2. **`comms/ws.chat-room.ts:115-214` — [P0] WS write path bypasses the org-isolation guard REST enforces** (plus no per-message membership re-check, so revocation is ignored for the socket lifetime). Mirror the REST org guard in `onConnect` and re-verify membership per state-changing message.

3. **`communication/jobs/announcementSend.ts` + `core/email.ts:459` — [P1] The org-wide blast path is unsafe on three axes:** no idempotency/atomic claim (overlapping cron → duplicate blast to the whole org, lines 285-323), consent bypassed on in-app/push channels (147-167), and the bulk email path mislabels itself `transactional` (missing `emailCategory:'bulk'` at line 198) so it bypasses BOTH suppression-unsubscribe AND the bulk rate limiter — while the unsubscribe link itself is 400-broken (`core/email.ts:459` `&org=`). Members who opted out still get blasted, possibly twice, with no working way to unsubscribe.
