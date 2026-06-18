# CONTINUE-56 · Phase 2 — TRUE e2e backlog (cascade removed)

Date: 2026-06-14. Branch: `aha/continue-49-subscription-billing` (PR #8).
Run: full memberry suite, **fresh DB** (drop+recreate `monobase` → migrate → seed),
`SESSION_LIMIT=100000` override active, workers=2, failures uncapped, `--reporter=line`.

## Headline

| | Count |
|---|---|
| **Passed** | **508** |
| **Failed** | **128** (118 real + 10 stub) |
| Skipped | 79 |
| Wall clock | 16.9 min (workers=2, single host) |
| **`freshAuthState` / sign-in failures** | **0** |
| 401-resource errors | 3 (intentional "returns 401" assertions) |

**The 401 cascade is gone.** CONTINUE-55 measured ~259 fresh-DB failures; ~half were
the single V-15 storageState cascade. With Phase 0 (SESSION_LIMIT) + Phase 1 (per-test
fresh auth) the real backlog is **118** non-stub failures across **61 specs**, and many
cluster around shared root causes (so far fewer than 118 distinct fixes).

## Split (118 real failures)

### A. UI-drift / data-presence — ~88 (dominant)
`toBeVisible` (33) + `toBeTruthy` (53) + `element(s) not found` (27), de-duped to ~88
after removing the guard/url/a11y rows counted below. Page **authenticates and loads**
(auth is healthy) but an expected heading / control / seeded row is absent. Two sub-kinds,
separable in Phase 3 by reading the assertion:
- **selector/heading drift (mechanical):** e.g. `My Dues` heading, `dues configuration`
  heading, `Send Reminders` button, `Export My Data` card, Delete Account card,
  upload-dialog button. Fix = update selector to current DOM.
- **data-presence:** asserts seeded content renders — Officer Training "Advanced
  Endodontics", event "General Assembly", election list, officers list, announcements,
  document categories. Fix = seed/render reconciliation (candidate for G10 per-test
  isolation if the shared org is being mutated by a sibling spec).

### B. Guard / permission cluster — ~13 (likely shared root cause → cheap)
- `officer/guard-enforcement.spec.ts` ×3 — non-officer NOT redirected away from
  `/officer/*` (`url` still contains `/officer/dashboard`). Frontend route-guard behavior.
- `states/*-states.spec.ts` "permission-error: regular member / unauthenticated cannot
  access X" ×~8 (dues, events, officer-dashboard, org-home, settings, credits, training,
  communications, roster).
- `security.spec.ts:21` unauthenticated → member dashboard `toContain`.
These share a pattern: client-side guard / permission-error expectation. **Confirm whether
the guard regressed or the test expectation drifted** before fixing (the prompt's
"early-run 403 — confirm intended access" lives here).

### C. Journey URL assertions — ~5 (likely shared → cheap)
`journeys/{navigation,secretary-journey,society-officer-journey,treasurer-journey}` +
`navigation` — `toHaveURL` after "accesses officer dashboard". One helper/expectation
pattern; probably one fix.

### D. Genuine bugs — small
- a11y: `states/dues-states.spec.ts:128`, `states/credits-states.spec.ts:102` — "1
  critical/serious a11y violation". Genuine.
- `auth.spec.ts:91` sign-in POST data `not.toBeNull()` — verify (auth-response shape, not
  a freshAuthState issue).
- `journeys/booking-flow.spec.ts` / `event-lifecycle` / `training-lifecycle` click
  timeouts — multi-step flows; could be drift or genuine.

### E. Environment / exclude — not real backlog
- `auth/password-reset.spec.ts:64` — `Mailpit get html failed: 404` (mailpit not running
  locally; runs in CI). **Local-only false negative.**
- `_visual.spec.ts:68` member-dashboard `toHaveScreenshot` — snapshot drift (update baseline).
- **10 stub failures** (`stubs/*`) — unbuilt-feature placeholders. They should be skipped:
  the global `testIgnore: ['**/stubs/**']` is being overridden by the chromium project's own
  `testIgnore`. Pre-existing config quirk — add `**/stubs/**` to the project `testIgnore`
  (or restore merge) so stubs stop counting. Excluded from the 118.

## Phase 3/4 sizing implication (for decision)
- **B + C (~18) are likely a handful of shared root causes** — cheapest, highest-leverage.
- **A-selector-drift** is mechanical, fan-out-able.
- **A-data-presence** is the signal for whether **Phase 4 (G10 `/test/isolated-fixture`,
  already built)** is needed: if these fail because a sibling spec mutated the shared seeded
  org, adopt isolated fixtures; if the data just isn't rendered, it's a render/selector fix.
- **D** = true TDD fixes (a11y first).
- Config: fix stub `testIgnore` + decide on Mailpit-in-local for password-reset.

## Per-spec failure manifest
(Full list — chromium project; mobile contributed 0 net new specs.)

Source log: `/tmp/full-suite.log`. Counts are `spec (n failures)`.

```
journeys/training-lifecycle.spec.ts (6)   — toBeVisible ×3, click-timeout ×3
states/dues-states.spec.ts (5)            — toBe ×2, toBeTruthy, a11y, toBeVisible
states/events-states.spec.ts (5)          — toBe ×2, toBeTruthy ×3
member/grace-period-access.spec.ts (4)    — toBeTruthy ×3, toBeGreaterThanOrEqual
journeys/communication-delivery.spec.ts (3) — toBeTruthy ×3  (seeded announcement assertions)
journeys/document-lifecycle.spec.ts (3)   — toBeTruthy ×2, toBeVisible (upload dialog)
journeys/dues-lifecycle.spec.ts (3)       — toBeVisible ×2, toBe
member/dues.spec.ts (3)                   — toBe ×2, toBeVisible (My Dues heading)
member/onboarding.spec.ts (3)             — click-timeout ×3 (step 2 nav)
officer/dues-reminders.spec.ts (3)        — toBeVisible ×3 (Send Reminders button)
officer/election-integrity.spec.ts (3)    — toBeTruthy ×3 (election access/list)
officer/guard-enforcement.spec.ts (3)     — not.toContain ×3  [GUARD CLUSTER]
officer/payment-expiry.spec.ts (3)        — toBeVisible ×3 (Record Payment / dashboard)
officer/payment-reconciliation.spec.ts (3)— toBeVisible ×2, toBeTruthy
profile.spec.ts (3)                       — toBeVisible, toBe, toBeDisabled
states/officer-dashboard-states.spec.ts (3) — toBeTruthy ×3  [perm-error cluster ×2]
states/org-home-states.spec.ts (3)        — toBeGreaterThanOrEqual, toBeTruthy ×2 [perm ×1]
states/settings-states.spec.ts (3)        — toBeVisible ×2 (dues config / fund alloc), toBeTruthy [perm]
actions/form-validation-tests.spec.ts (2) — toBeVisible, fill-timeout
journeys/booking-flow.spec.ts (2)         — toBeTruthy, toBeGreaterThan
journeys/election-officer-transition.spec.ts (2) — toBeTruthy ×2
journeys/event-lifecycle.spec.ts (2)      — toBeVisible, click-timeout
journeys/event-registration-payment.spec.ts (2) — toBeTruthy ×2
journeys/registration-to-payment.spec.ts (2) — toBeTruthy ×2
member/data-export.spec.ts (2)            — toBeVisible ×2 (Export My Data card)
member/event-capacity.spec.ts (2)         — toBeTruthy ×2
officer/role-assignment.spec.ts (2)       — toBeTruthy ×2 (officers list)
officer/training.spec.ts (2)              — toBeVisible ×2 (seeded "Advanced Endodontics")
public/discover-events.spec.ts (2)        — toBeTruthy ×2
states/credits-states.spec.ts (2)         — toBeTruthy [perm], a11y  [GENUINE a11y]
states/training-states.spec.ts (2)        — toBeTruthy ×2 [perm, invalid-id]
_visual.spec.ts (1)                       — toHaveScreenshot (member-dashboard baseline)
auth/otp-registration.spec.ts (1)         — toBeTruthy (signup requires fields)
auth/password-reset.spec.ts (1)           — Mailpit 404  [LOCAL-INFRA, exclude]
auth.spec.ts (1)                          — not.toBeNull (sign-in POST data)  [VERIFY]
error-boundaries.spec.ts (1)              — toBeTruthy (non-existent org error)
journeys/booking-host-actions.spec.ts (1) — toBeTruthy
journeys/navigation.spec.ts (1)           — toHaveURL  [URL CLUSTER]
journeys/secretary-journey.spec.ts (1)    — toHaveURL  [URL CLUSTER]
journeys/society-officer-journey.spec.ts (1) — toHaveURL  [URL CLUSTER]
journeys/training-to-credit.spec.ts (1)   — toBeTruthy
journeys/treasurer-journey.spec.ts (1)    — toHaveURL  [URL CLUSTER]
member/account-deletion.spec.ts (1)       — toBeVisible (Delete Account card)
member/credit-validation.spec.ts (1)      — toBeTruthy (credit cycle)
member/dashboard.spec.ts (1)              — toBeVisible (Your Organizations)
member/directory.spec.ts (1)              — toBe (search member cards)
member/digital-id-card.spec.ts (1)        — toBeVisible (member identity)
member/documents.spec.ts (1)              — toBeTruthy (category nav)
member/gateway-error.spec.ts (1)          — toBeTruthy (payment history)
member/events.spec.ts (1)                 — toBeVisible (tab filter)
member/pay-token.spec.ts (1)              — toBe (bad token invalid state)
member/training.spec.ts (1)               — toBeTruthy (training detail)
officer/application-review.spec.ts (1)    — toBeTruthy (applications list)
officer/dashboard.spec.ts (1)             — toBeTruthy (metrics strip)
officer/enrollment-management.spec.ts (1) — toBeTruthy (training list)
officer/event-checkin.spec.ts (1)         — toBeTruthy (events page)
officer/payment-refund.spec.ts (1)        — toBeVisible (history table)
officer/settings-e2e.spec.ts (1)          — toBeTruthy (settings sidebar links)
security.spec.ts (1)                      — toContain (unauth → member dashboard) [GUARD CLUSTER]
states/communications-states.spec.ts (1)  — toBeTruthy [perm-error]
states/roster-states.spec.ts (1)          — toBeTruthy [perm-error]
```

Stubs (excluded, 10): nomination-eligibility ×4, committee-dissolution, feed-moderation,
marketplace-referral, job-posting-expiry, national-dashboard, survey-anonymity.
