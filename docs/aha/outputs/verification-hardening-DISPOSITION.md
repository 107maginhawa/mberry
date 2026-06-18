# Phase E — Gap Disposition (Verification Hardening)

Date: 2026-06-18. Every gap from the Phase-A matrix + Phase-B/C findings gets an
explicit **enforce** or **accept-risk** ruling with rationale. Phase-A per-clause
gaps (G1a–c, G2a–b, G3a–b, G4a–c, G5) are all CLOSED — the 6 journeys now assert
4/4 (Phase B). The items below are what remained.

## Gate now fully green

`E2E depth gate: PASS (138 real-flow, 14 exempt, 6 journeys 4/4)` — exit 0.

## E2E-depth gate blockers (3 pre-existing selector-only specs)

| Spec | Ruling | Rationale |
|---|---|---|
| `officer/officer-settings.spec.ts` | **ENFORCE** | Already does a real `mutate→save→reload→restore` round-trip (`toHaveValue`); the heuristic just didn't count `.toHaveValue` as a data assertion. Added it to `DATA_PATTERNS` → correctly classified real-flow. No spec test changed. |
| `member/dues.spec.ts` | **accept-risk** | UI-render smoke for the member dues view. The dues DATA path (record → durable read) is enforced by the `treasurer-records-dues` @journey-firewall journey + `recordDuesPayment` unit tests. Exempted with `@selector-only-ok` + reason. |
| `journeys/dues-lifecycle.spec.ts` | **accept-risk** | UI-render smoke for officer dues-config + member payment-history screens. The data lifecycle is enforced by the `treasurer-records-dues` + `officer-approves` journeys and the dues unit tests. Exempted with `@selector-only-ok` + reason. |

## Phase-B runtime findings

| Finding | Ruling | Rationale |
|---|---|---|
| **PAY-EXT-409** — recordDuesPayment 409 on membership-extending payments | **ENFORCE (fixed)** | P1 money bug; fixed (`updatePaymentFields`), locked by `recordDuesPayment.test.ts [PAY-EXT-409]`. |
| **Dead routes** in J1 (`/dues/payments`, `/persons/me/dues`) + J6 (`/organizations/{id}/members`) | **ENFORCE (fixed)** | Rewired to real ops / reshaped to achievable goals; journeys now green. |
| **Swallowed dashboard 403s** — `event-lifecycle/my`, `credit-compliance/{org}` | **accept-risk (now) + ENFORCE (tracked)** | Declared expected via allow-list so journeys aren't blocked. Filed as an app-bug investigation (todo #5) — a member's own dashboard swallowing a 403 is a real over-fetch/authz smell; not fixed here (out of test-hardening scope). |
| **No member-facing dues/receipt read model** (`/persons/me/dues` absent) | **accept-risk** | Product gap, not a test gap. The durable oracle is the officer-scoped payment-by-id read; the "member sees receipt" thread is verified via the membership row. A member receipt view is a product decision, out of scope. |

## Journey clause caveats

| Item | Ruling | Rationale |
|---|---|---|
| **J6 clause-1 = console/pageerror/5xx only (4xx deferred)** | **accept-risk** | The directory cross-module flow crosses many unauth→auth→role-gated transitions whose benign 401/403 probes need per-step allow-list tuning. pageerror + console.error + 5xx are enforced now; 4xx-strict is deferred to avoid a brittle allow-list. Tracked in the spec comment. |
| **J6 `test.fixme`** — "newly created member appears in directory search" | **accept-risk** | Pre-existing, documented design issue: `POST /persons` enforces 1:1 user↔person, so an officer can't create an arbitrary person. Cross-actor directory propagation is otherwise covered by the `officer-approves` journey + J6's independent roster read (step 8). |

## Done-when ✅

Every remaining gap has an enforce|accept-risk ruling + rationale; the e2e-depth
gate is green. Open follow-up: todo #5 (dashboard-403 app-bug investigation).
