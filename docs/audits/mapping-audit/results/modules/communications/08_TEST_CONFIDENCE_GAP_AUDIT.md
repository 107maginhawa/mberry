# Audit 08 — Test Confidence Gap
## Module: Communications (communication/ + communications/ + comms/)
**Date:** 2026-05-26
**Auditor:** Automated Mapping Audit
**Severity scale:** P0 = data loss / security breach · P1 = broken feature · P2 = degraded UX · P3 = tech debt

---

## 08-1. Test Inventory

### Backend unit tests (`services/api-ts/src/handlers/`)

#### communication/ sub-module

| Test file | Est. assertions | Coverage focus | Strength |
|-----------|----------------|----------------|----------|
| `015-announcements-templates.test.ts` | 67 | Announcement + template CRUD | STRONG |
| `ac-m07.communications.test.ts` | 36 | M07 communication flows | MODERATE |
| `announcement-handlers.test.ts` | 36 | Announcement handler suite | MODERATE |
| `communication.test.ts` | 36 | General communication module | MODERATE |
| `surveys-polls.test.ts` | 87 | Survey and poll workflows | STRONG |
| `m13.professional-feed.test.ts` | 77 | Professional feed posts | STRONG |
| `ac-m13.professional-feed.test.ts` | 36 | Feed M13 flows | MODERATE |
| `ac-m18.surveys.test.ts` | 36 | Survey M18 | MODERATE |
| `br-26.session-management.test.ts` | ~10 | BR-26 session rules | WEAK |
| `br-35.feed-moderation.test.ts` | ~10 | BR-35 moderation | WEAK |
| `br-40.survey-anonymity.test.ts` | ~10 | BR-40 anonymity | WEAK |
| `createAnnouncement.test.ts` | 3 | Single handler | **VERY WEAK** |
| `listAnnouncements.test.ts` | 3 | Single handler | **VERY WEAK** |
| `deleteAnnouncement.test.ts` | ~3 | Single handler | **VERY WEAK** |
| `archiveAnnouncement.test.ts` | ~3 | Single handler | **VERY WEAK** |
| `createMessage.test.ts` | ~4 | Single handler | WEAK |
| `createMessageTemplate.test.ts` | ~4 | Single handler | WEAK |
| `cancelMessage.test.ts` | ~4 | Single handler | WEAK |
| `createSubscriptionTopic.test.ts` | ~4 | Single handler | WEAK |
| `bulkUpdatePersonSubscriptions.test.ts` | ~4 | Single handler | WEAK |
| `archiveAnnouncement.test.ts` | ~3 | Archive only | **VERY WEAK** |

#### comms/ sub-module

| Test file | Est. assertions | Coverage focus | Strength |
|-----------|----------------|----------------|----------|
| `comms-rest-handlers.test.ts` | 86 | 9 REST handlers (auth, happy path, errors) | STRONG |
| `chat-rooms-stabilization.test.ts` | 26 | Chat room edge cases, WS message types | MODERATE |
| `video-calls-stabilization.test.ts` | 30 | Video call lifecycle, participant management | MODERATE |

### Frontend unit tests (`apps/memberry/src/`)

| Test file | Focus | Strength |
|-----------|-------|----------|
| `features/communications/components/announcement-list.test.tsx` | List rendering | MODERATE |
| `features/communications/components/compose-form.test.tsx` | Form validation | MODERATE |
| `features/communications/__tests__/compose.test.tsx` | Compose flow | MODERATE |
| `features/communications/__tests__/templates.test.tsx` | Template UI | MODERATE |
| `features/communications/__tests__/preferences-view.test.tsx` | Preferences | MODERATE |
| `features/communications/__tests__/analytics-segments.test.tsx` | Analytics/segments | MODERATE |
| `features/communications/__tests__/analytics-dashboard.test.tsx` | Dashboard | MODERATE |
| `features/communications/__tests__/template-preview-split.test.tsx` | Template preview | MODERATE |
| `features/dashboard/components/org-announcements.test.tsx` | Dashboard widget | MODERATE |
| `features/notifications/components/notification-inbox.test.tsx` | Notification inbox | MODERATE |

### E2E tests (`apps/memberry/tests/e2e/`)

| Test file | Tests | Focus | Strength |
|-----------|-------|-------|----------|
| `states/communications-states.spec.ts` | 6 | Loading, success, permission-error, empty, confirmation, a11y | MODERATE |
| `officer/communications.spec.ts` | 6 | Officer list, new button, navigate, stats, badges | MODERATE |
| `communications.spec.ts` | 2 | Officer compose → sent; member notification drawer | MODERATE |
| `journeys/communication-delivery.spec.ts` | Unknown | Delivery journey | PARTIAL |
| `actions/comms-elections-actions.spec.ts` | Unknown | Comms+elections actions | PARTIAL |

### Contract tests (`specs/api/tests/contract/`)

| File | Coverage |
|------|----------|
| `comms.hurl` | Chat room REST basics — create room, list (empty), auth check |
| `comms-extended-flow.hurl` | Extended chat + message round-trip |
| `comms-edge.hurl` | Edge cases (auth, errors) |
| `communications-flow.hurl` | Announcement CRUD — unauth 401, list, create, get |
| `communications-extended-flow.hurl` | Extended announcement flows |

**Note:** Contract tests DO exist for comms and communications sub-modules. Coverage is partial — schedule, send, cancel, segment, subscription, survey, and template endpoints have no corresponding `.hurl` files.

---

## 08-2. Confidence Scores by Layer

### Layer 1: Unit (backend handler logic)

| Sub-module | Score | Rationale |
|-----------|-------|-----------|
| communication/ (announcements) | 5/10 | Strong suite tests exist (`015-announcements-templates.test.ts`, 67 assertions) but 4+ individual handler tests have only 3 assertions each — auth guard, happy path, one error case. No tests for edge cases: concurrent publish, invalid audience segment, scheduled announcement timing |
| communication/ (messages/templates) | 4/10 | Individual handler tests (createMessage, createMessageTemplate, cancelMessage) each have ~4 assertions. Message scheduling, send retry, merge-field substitution untested |
| communication/ (surveys/polls/feed) | 7/10 | Strong dedicated test suites (87 + 77 assertions respectively). BR-40 anonymity tested |
| communications/ (segment) | 3/10 | Segment handlers likely covered indirectly by communication module tests, but no segment-specific test file found |
| comms/ (REST handlers) | 7/10 | `comms-rest-handlers.test.ts` covers 9 handlers with auth + happy path + error. `video-calls-stabilization.test.ts` adds lifecycle tests |
| comms/ (WebSocket) | 4/10 | `chat-rooms-stabilization.test.ts` includes WS message type validation but real WebSocket upgrade path not unit-tested. Mock-classified as "EXISTENCE_CHECK" per file comment — i.e., tests verify middleware injection patterns, not actual WS behavior |

**Overall backend unit confidence: 5/10**

### Layer 2: Integration (handler + database)

No integration tests found for this module. All backend tests mock the repository layer (`ChatRoomRepository`, `MessageTemplateRepository`). No tests exercise the actual Drizzle ORM queries against a real database.

**Integration confidence: 2/10**

### Layer 3: Contract (API wire contract)

| Sub-module | Score | Rationale |
|-----------|-------|-----------|
| comms/ | 5/10 | 3 Hurl files cover basics. Schedule/send/video endpoints not covered |
| communications/ | 4/10 | `communications-flow.hurl` + `communications-extended-flow.hurl` cover announcement CRUD. Archive, publish actions, segments absent |
| communication/ | 1/10 | No Hurl files found for `/association/message-templates`, `/association/messages`, `/association/surveys`, `/association/polls`, `/association/feed` |

**Overall contract confidence: 3/10**

### Layer 4: E2E (full user journey in browser)

| Journey | Score | Rationale |
|---------|-------|-----------|
| Officer announcement compose → send | 5/10 | `communications.spec.ts` covers compose → send → verify in sent list. But sent.tsx has URL bug; test may not catch it if API silently returns 200 |
| Officer announcement list + navigation | 7/10 | `officer/communications.spec.ts` has 6 solid tests: heading, list, new button, navigation, stats cards, badge formatting |
| Member announcement feed | 3/10 | No E2E covers member browsing feed → reading detail → returning |
| Chat / DM send message | 0/10 | [E2E GAP] Zero E2E tests |
| Video call join / leave | 0/10 | [E2E GAP] Zero E2E tests |
| Template CRUD | 0/10 | [E2E GAP] Zero E2E tests |
| Admin platform broadcasts | 0/10 | [E2E GAP] Admin app has no E2E coverage at all |
| Coordinator message scheduling | 0/10 | [E2E GAP] No frontend exists — no test possible |
| Notification preferences | 0/10 | [E2E GAP] Route not reachable — cannot test |

**Overall E2E confidence: 2/10**

---

## 08-3. Flaky Test Identification

### Identified flaky test

**File:** `apps/memberry/tests/e2e/states/communications-states.spec.ts`
**Test:** `success: shows communications heading and announcement list`

**Evidence:** The test was reported as failed in a prior run. The test waits for `networkidle` then asserts heading visibility with a 10-second timeout. The "New Message" button assertion is combined with an OR condition to handle multiple selectors, which can mask genuine failures.

**Root cause hypothesis:** The success test depends on seeded announcement data being present. If the test database seed is not applied or a prior test cleaned up announcements, the heading may render but the list body may be empty — causing the combined assertion to pass (heading found) while masking actual data absence.

**Risk:** FLAKY — intermittent failure under CI conditions with varying database state.

**Recommendation:** Test should assert both heading AND at least one announcement row, separately, with explicit seed/teardown lifecycle.

---

## 08-4. Very Weak Tests (3–5 assertions)

The following tests have 3 assertions or fewer, covering only the minimal handler surface:

| File | Assertions | Missing coverage |
|------|-----------|-----------------|
| `createAnnouncement.test.ts` | 3 | Duplicate title, invalid audience, missing org context, role guard |
| `listAnnouncements.test.ts` | 3 | Pagination, status filtering, empty org, cursor behavior |
| `deleteAnnouncement.test.ts` | ~3 | Delete non-existent, delete already-published, cascade effects |
| `archiveAnnouncement.test.ts` | ~3 | Archive already-archived, archive while scheduled |
| `cancelMessage.test.ts` | ~4 | Cancel already-sent, cancel non-existent, concurrent cancel |
| `createSubscriptionTopic.test.ts` | ~4 | Duplicate topic, invalid channel, org scoping |
| `bulkUpdatePersonSubscriptions.test.ts` | ~4 | Partial failure, invalid person ID, large batch |

These tests satisfy coverage line counts but provide negligible confidence in business rule enforcement.

---

## 08-5. Zero-Coverage Areas

### Backend (zero unit tests found)

| Handler / area | Risk |
|---|---|
| `scheduleMessage` | P1 — scheduling logic (cron, timezone, send-at) untested |
| `previewMessageTemplate` | P2 — merge field substitution untested |
| `sendMessage` | P1 — delivery dispatch, channel routing untested |
| `updateMessage` | P2 — immutability of sent messages untested |
| `getIceServers` (business logic) | P2 — TURN/STUN config response untested |
| `createSavedSegment` | P2 — no dedicated test; covered only via integration assumption |
| Segment deduplication | P3 — no test for duplicate segment names |
| WebSocket `onConnect` participant validation | P1 — mock tests verify handler exists but real auth path untested |
| WebSocket message persistence (`chat.message` → DB) | P1 — mocked repository; actual write path untested |

### Frontend (zero unit tests found)

| Component | Risk |
|---|---|
| `AudiencePicker` | P2 — audience segment selection logic untested |
| `DeliveryFunnel` | P3 — display math untested |
| `ChatView` (WebSocket hookup) | P1 — WebSocket connect/disconnect/reconnect untested |
| `use-chat-websocket.ts` hook | P1 — real-time state management untested |
| `use-video-call.ts` hook | P1 — WebRTC connection lifecycle untested |
| `DmList` | P2 — DM filtering/sorting untested |

### E2E (complete gaps)

| Journey | Gap severity |
|---------|-------------|
| Chat: send message, receive message | P1 |
| DM: start new conversation | P2 |
| Video: join, leave, end call | P1 |
| Announcement: member reads detail | P2 |
| Template: create, preview, use in compose | P2 |
| Notification preferences: toggle, save | P2 |
| Admin: any communications journey | P1 |
| Coordinator: any communications journey | P1 |

---

## 08-6. Contract Test Gap Analysis

### Uncovered endpoints (no Hurl file)

| Endpoint | Risk |
|---|---|
| `POST /association/messages/:id/schedule` | P1 |
| `POST /association/messages/:id/send` | P1 |
| `POST /association/messages/:id/cancel` | P2 |
| `POST /association/message-templates/:id/preview` | P2 |
| `POST /association/subscription-topics` | P2 |
| `POST /association/persons/:personId/subscriptions/bulk` | P2 |
| `POST /association/surveys`, `GET /association/surveys` | P2 |
| `POST /association/polls`, `GET /association/polls` | P2 |
| `POST /association/feed`, `GET /association/feed` | P2 |
| `POST /communications/segments` (generated) | P1 — duplicate route ambiguity |
| `POST /communications/announcements/:id/archive` | P2 |
| `POST /comms/chat-rooms/:room/video-call/join` | P1 |
| `POST /comms/chat-rooms/:room/video-call/end` | P1 |
| `WS /ws/comms/chat-rooms/:room` | P1 — WS upgrade not testable with Hurl but needs alternative |

---

## 08-7. Test Classification Issues

The `comms-rest-handlers.test.ts`, `chat-rooms-stabilization.test.ts`, and `video-calls-stabilization.test.ts` files all carry this classification comment:

```
// Mock-Classification: APPROPRIATE — WebSocket/WebRTC real-time service boundary
// Assertion-Style: EXISTENCE_CHECK — verifying middleware/context injection patterns
```

`EXISTENCE_CHECK` means tests verify that handlers can be called with mocked dependencies — not that they produce correct outputs under real conditions. For high-risk paths (WebSocket participant enforcement, video call state machine), existence checks are insufficient. These tests inflate coverage metrics without providing meaningful behavioral confidence.

---

## 08-8. Test Data Dependencies

The E2E tests hardcode `ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'` and rely on seeded data (`cleanupAnnouncements` helper exists but cleanup scope is unclear). Tests that depend on seeded announcements being present will fail if:
- Seed was not applied
- A prior test deleted the seed data
- The org ID changes (e.g., in a fresh database)

No factory pattern exists to create test data within E2E specs for communications, unlike some other modules.

---

## 08-9. Mock Appropriateness Assessment

| Test area | Mock pattern | Appropriate? |
|---|---|---|
| `comms-rest-handlers.test.ts` | Mocks `ChatRoomRepository`, `ChatMessageRepository` | Yes — isolates handler logic from DB |
| `video-calls-stabilization.test.ts` | Mocks all repos + WebSocket service | Acceptable at unit layer, but creates false confidence for WS paths |
| `communication.test.ts` | Mocks `MessageTemplateRepository` | Yes |
| `announcement-handlers.test.ts` | Unknown — not fully audited | Assumed mocked |
| Frontend unit tests | Likely mock API calls | Standard — acceptable |
| E2E tests | No mocks — hits real API | Correct |

---

## 08-10. Business Rule Coverage

| Business rule | Test coverage |
|---|---|
| BR-26 (session management) | `br-26.session-management.test.ts` — WEAK (~10 assertions) |
| BR-35 (feed moderation) | `br-35.feed-moderation.test.ts` — WEAK (~10 assertions) |
| BR-40 (survey anonymity) | `br-40.survey-anonymity.test.ts` — WEAK (~10 assertions) |
| BR-28 (officer comms) | Referenced in `officer/communications.spec.ts` — MODERATE |
| Participant-only WS access | Handler checks exist, unit test coverage WEAK (mocked) |
| Role enforcement (officer vs member) | `role-boundaries.spec.ts` — STRONG for announcement page routing |
| Segment access (admin/coordinator only) | Not tested — duplicate route bypasses restriction |

---

## 08-11. Overall Confidence Matrix

| Layer | Score | Status |
|-------|-------|--------|
| Unit — backend handlers | 5/10 | Below threshold |
| Integration — handler + DB | 2/10 | Critical gap |
| Contract — API wire | 3/10 | Major gaps |
| E2E — full browser journey | 2/10 | Critical gap |
| **Composite** | **3/10** | **FAIL** |

Target threshold for gate passage: 7/10 composite.

---

## 08-12. Priority Remediation Plan

### P0/P1 — Must fix before gate

1. **Add E2E for chat/DM message send** — `messages/index.tsx` → type message → assert received. Validates WS connection, persistence, and UI update.
2. **Add E2E for video call join/leave** — exercise the REST endpoints + WS video signaling path.
3. **Fix EXISTENCE_CHECK tests for WS auth path** — replace mock-based tests with integration tests that exercise the participant validation logic against a real (in-memory or test) DB.
4. **Add contract test for `POST /communications/announcements/:id/publish`** — most critical missing contract scenario.
5. **Add contract test for `POST /communications/messages/:id/send`** — delivery dispatch path.

### P2 — Needed for production confidence

6. **Expand `createAnnouncement.test.ts`** to 15+ assertions covering role guard, duplicate detection, invalid audience.
7. **Add E2E for member announcement detail** — navigate list → click → read detail → verify content.
8. **Add integration test for schedule → send lifecycle** — actual timing/cron behavior.
9. **Fix flaky success test** — add explicit data assertion separate from heading assertion.
10. **Add contract tests for survey/poll/feed endpoints** (currently zero).

### P3 — Cleanup

11. Reclassify EXISTENCE_CHECK tests as `STRUCTURAL` and add a corresponding behavioral tier.
12. Add factory helpers to E2E for communications data (remove hardcoded seed dependency).
13. Add TypeScript types to frontend API calls (remove `any` from response shapes).

---

## 08-13. Gate 8

**GATE STATUS: FAIL**

Composite confidence: **3/10** (threshold: 7/10)

Critical blockers:
- **Zero E2E coverage** for chat, video, DM, template CRUD, admin journeys, coordinator journeys
- **Zero integration tests** — all backend tests mock the DB layer
- **Contract coverage at 3/10** — 15+ endpoints have no Hurl contract tests
- **FLAKY E2E test** in success state path (`communications-states.spec.ts`)
- **EXISTENCE_CHECK pattern** in WS tests inflates metrics without behavioral validation

Minimum path to gate passage requires: E2E for chat (P1-A), E2E for video (P1-B), expanded handler unit tests for announcement CRUD (P2), and at least 5 additional contract test scenarios (P2).
