# E2E Depth Audit — Wave 2 Baseline

Date: 2026-06-06T00:00:00Z
Branch: feature/codebase-hardening

## Totals

| Verdict | Count | % |
|---|---|---|
| real-flow | 36 | 24% |
| selector-only | 81 | 53% |
| unknown | 35 | 23% |
| exempt (@selector-only-ok) | 0 | 0% |
| **Total** | **152** | **100%** |

77% of specs (117/152) need upgrade. Zero specs carry a `// @selector-only-ok` exemption.

## Methodology

**Data roots scanned:**
- `apps/memberry/tests/e2e/`
- `apps/admin/tests/e2e/`

**DATA_PATTERNS** (≥2 hits → real-flow):
- `expect(response.status())` — HTTP response status assertions
- `expect(body.data...)` — response body data assertions
- `expect(*).toHaveLength(*)` — collection size assertions
- `expect(*).toEqual(*)` — deep equality assertions
- `expect(*).toContain[Equal](*)` — membership assertions
- `expect(*).toMatchObject(*)` — partial object assertions
- `waitForResponse` — network intercept patterns
- `.toBe(200 | true | false)` — status code / boolean assertions

**SELECTOR_PATTERNS** (any hit → selector bucket):
- `.toBeVisible()`, `.toHaveText()`, `.toContainText()`
- `.toHaveCount()`, `.toBeEnabled()`, `.toBeDisabled()`

**Classification rules:**
- **real-flow**: ≥2 data assertions
- **selector-only**: 0–1 data assertions AND ≥1 selector assertion
- **unknown**: 0 data AND 0 selector (stubs, visual-only, placeholder tests)
- **exempt**: file contains `// @selector-only-ok: <reason>` comment

## Specs needing upgrade (selector-only, NOT exempt)

Sorted by selectorAssertions desc (worst first):

| File | Data | Selector |
|---|---|---|
| apps/admin/tests/e2e/wave7-routes.spec.ts | 0 | 22 |
| apps/memberry/tests/e2e/officer/settings-e2e.spec.ts | 0 | 21 |
| apps/memberry/tests/e2e/journeys/training-lifecycle.spec.ts | 0 | 19 |
| apps/memberry/tests/e2e/member/delete-account.spec.ts | 0 | 18 |
| apps/memberry/tests/e2e/member/onboarding.spec.ts | 0 | 16 |
| apps/memberry/tests/e2e/officer/cpd-settings.spec.ts | 1 | 15 |
| apps/memberry/tests/e2e/journeys/dues-lifecycle.spec.ts | 0 | 14 |
| apps/memberry/tests/e2e/member/leave-org.spec.ts | 0 | 12 |
| apps/memberry/tests/e2e/actions/membership-actions.spec.ts | 0 | 12 |
| apps/memberry/tests/e2e/officer/certificate-generation.spec.ts | 0 | 12 |
| apps/memberry/tests/e2e/actions/form-validation-tests.spec.ts | 1 | 11 |
| apps/memberry/tests/e2e/officer/nav-reachability.spec.ts | 0 | 11 |
| apps/memberry/tests/e2e/member/account-deletion.spec.ts | 0 | 10 |
| apps/memberry/tests/e2e/actions/officers-admin-actions.spec.ts | 0 | 10 |
| apps/memberry/tests/e2e/officer-surveys.spec.ts | 0 | 10 |
| apps/memberry/tests/e2e/member/transfer.spec.ts | 0 | 9 |
| apps/memberry/tests/e2e/journeys/treasurer-journey.spec.ts | 0 | 9 |
| apps/memberry/tests/e2e/journeys/event-lifecycle.spec.ts | 0 | 9 |
| apps/memberry/tests/e2e/auth.spec.ts | 0 | 8 |
| apps/memberry/tests/e2e/states/dashboard-states.spec.ts | 0 | 8 |
| apps/memberry/tests/e2e/officer/events.spec.ts | 0 | 8 |
| apps/memberry/tests/e2e/org-switcher.spec.ts | 0 | 7 |
| apps/memberry/tests/e2e/states/settings-states.spec.ts | 0 | 7 |
| apps/memberry/tests/e2e/states/credits-states.spec.ts | 0 | 7 |
| apps/memberry/tests/e2e/officer/roster.spec.ts | 0 | 7 |
| apps/memberry/tests/e2e/journeys/booking-cancel.spec.ts | 0 | 7 |
| apps/memberry/tests/e2e/member/dashboard.spec.ts | 0 | 6 |
| apps/memberry/tests/e2e/member/credits.spec.ts | 0 | 6 |
| apps/memberry/tests/e2e/states/dues-states.spec.ts | 0 | 6 |
| apps/memberry/tests/e2e/officer/documents.spec.ts | 0 | 6 |
| apps/memberry/tests/e2e/member/training.spec.ts | 0 | 5 |
| apps/memberry/tests/e2e/states/roster-states.spec.ts | 0 | 5 |
| apps/memberry/tests/e2e/states/training-states.spec.ts | 0 | 5 |
| apps/memberry/tests/e2e/actions/events-actions.spec.ts | 0 | 5 |
| apps/memberry/tests/e2e/actions/training-actions.spec.ts | 0 | 5 |
| apps/memberry/tests/e2e/journeys/booking-host-actions.spec.ts | 0 | 5 |
| apps/memberry/tests/e2e/billing.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/auth/account-claim.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/member/org-home.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/member/data-export.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/member/events.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/public/discover-events.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/states/communications-states.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/states/org-home-states.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/states/events-states.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/officer/reports-credits.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/officer/training.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/officer/payment-expiry.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/officer/payment-refund.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/journeys/navigation.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/journeys/booking-flow.spec.ts | 0 | 4 |
| apps/memberry/tests/e2e/officer-reviews.spec.ts | 1 | 3 |
| apps/memberry/tests/e2e/member/event-cancel-registration.spec.ts | 0 | 3 |
| apps/memberry/tests/e2e/member/status-display.spec.ts | 0 | 3 |
| apps/memberry/tests/e2e/member/grace-period-access.spec.ts | 0 | 3 |
| apps/memberry/tests/e2e/member/payments.spec.ts | 0 | 3 |
| apps/memberry/tests/e2e/officer/settings.spec.ts | 0 | 3 |
| apps/memberry/tests/e2e/officer/payment-reconciliation.spec.ts | 0 | 3 |
| apps/memberry/tests/e2e/member-surveys.spec.ts | 0 | 3 |
| apps/memberry/tests/e2e/journeys/secretary-journey.spec.ts | 0 | 3 |
| apps/memberry/tests/e2e/journeys/society-officer-journey.spec.ts | 0 | 3 |
| apps/admin/tests/e2e/admin-routes.spec.ts | 0 | 3 |
| apps/memberry/tests/e2e/auth/session-management.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/states/officer-dashboard-states.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/actions/cross-role-tests.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/officer/training-completion.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/officer/application-review.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/officer/detail-pages.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/officer/chapters.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/officer/dashboard.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/officer/enrollment-management.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/officer/payments.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/officer/payment-correction.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/journeys/document-lifecycle.spec.ts | 0 | 2 |
| apps/admin/tests/e2e/admin-smoke.spec.ts | 0 | 2 |
| apps/admin/tests/e2e/wave7-role-gate.spec.ts | 0 | 2 |
| apps/memberry/tests/e2e/route-trace.spec.ts | 0 | 1 |
| apps/memberry/tests/e2e/member/pay-token.spec.ts | 0 | 1 |
| apps/memberry/tests/e2e/member/documents.spec.ts | 1 | 1 |
| apps/memberry/tests/e2e/member/certificates.spec.ts | 0 | 1 |
| apps/memberry/tests/e2e/journeys/public-org.spec.ts | 0 | 1 |

## Specs needing investigation (unknown)

These have 0 data assertions AND 0 selector assertions — stubs, visual specs, or placeholder tests:

| File |
|---|
| apps/memberry/tests/e2e/stubs/wave6/6b-secretary-features.spec.ts |
| apps/memberry/tests/e2e/stubs/wave6/6c-society-officer-features.spec.ts |
| apps/memberry/tests/e2e/stubs/wave6/6a-member-features.spec.ts |
| apps/memberry/tests/e2e/stubs/wave6/6e-training-visibility.spec.ts |
| apps/memberry/tests/e2e/stubs/wave6/6d-president-features.spec.ts |
| apps/memberry/tests/e2e/cross-org-isolation.spec.ts |
| apps/memberry/tests/e2e/security.spec.ts |
| apps/memberry/tests/e2e/cross-persona/treasurer-records-dues-member-sees-receipt.spec.ts |
| apps/memberry/tests/e2e/cross-persona/secretary-event-rsvp.spec.ts |
| apps/memberry/tests/e2e/cross-persona/admin-suspends-org-member-sees-lockout.spec.ts |
| apps/memberry/tests/e2e/infrastructure.spec.ts |
| apps/memberry/tests/e2e/auth/otp-registration.spec.ts |
| apps/memberry/tests/e2e/auth/session-expiry.spec.ts |
| apps/memberry/tests/e2e/auth/password-reset.spec.ts |
| apps/memberry/tests/e2e/_a11y.spec.ts |
| apps/memberry/tests/e2e/member/event-capacity.spec.ts |
| apps/memberry/tests/e2e/member/credit-carryover.spec.ts |
| apps/memberry/tests/e2e/member/gateway-error.spec.ts |
| apps/memberry/tests/e2e/member/training-browse.spec.ts |
| apps/memberry/tests/e2e/member/credit-validation.spec.ts |
| apps/memberry/tests/e2e/member/training-completion-flow.spec.ts |
| apps/memberry/tests/e2e/error-boundaries.spec.ts |
| apps/memberry/tests/e2e/role-boundaries.spec.ts |
| apps/memberry/tests/e2e/mobile/profile.spec.ts |
| apps/memberry/tests/e2e/officer/role-assignment.spec.ts |
| apps/memberry/tests/e2e/officer/guard-enforcement.spec.ts |
| apps/memberry/tests/e2e/officer/election-integrity.spec.ts |
| apps/memberry/tests/e2e/officer/event-checkin.spec.ts |
| apps/memberry/tests/e2e/journeys/training-to-credit.spec.ts |
| apps/memberry/tests/e2e/journeys/election-officer-transition.spec.ts |
| apps/memberry/tests/e2e/journeys/registration-to-payment.spec.ts |
| apps/memberry/tests/e2e/journeys/communication-delivery.spec.ts |
| apps/memberry/tests/e2e/journeys/event-registration-payment.spec.ts |
| apps/memberry/tests/e2e/_visual.spec.ts |

## Top 10 upgrade targets (Wave 2.2 → 2.4)

Priority: highest-traffic flows first — auth, billing, dues/payments, core member journeys.

1. `apps/memberry/tests/e2e/auth.spec.ts` — auth is critical path; 8 selector assertions, 0 data
2. `apps/memberry/tests/e2e/billing.spec.ts` — billing/payments; 4 selectors, 0 data (high trust risk)
3. `apps/memberry/tests/e2e/journeys/dues-lifecycle.spec.ts` — dues lifecycle; 14 selectors, 0 data
4. `apps/memberry/tests/e2e/member/delete-account.spec.ts` — destructive action; 18 selectors, 0 data
5. `apps/memberry/tests/e2e/journeys/training-lifecycle.spec.ts` — CPD core flow; 19 selectors, 0 data
6. `apps/memberry/tests/e2e/member/onboarding.spec.ts` — first-run critical path; 16 selectors, 0 data
7. `apps/memberry/tests/e2e/actions/membership-actions.spec.ts` — membership mutations; 12 selectors, 0 data
8. `apps/memberry/tests/e2e/officer/cpd-settings.spec.ts` — CPD config (officer-critical); 1 data, 15 selectors
9. `apps/memberry/tests/e2e/journeys/treasurer-journey.spec.ts` — finance persona; 9 selectors, 0 data
10. `apps/memberry/tests/e2e/member/payments.spec.ts` — payment confirmation; 3 selectors, 0 data

## Notes

- Wave 6 stubs (`stubs/wave6/*.spec.ts`) are expected unknowns — scaffold files with no assertions yet.
- `_visual.spec.ts`, `_a11y.spec.ts` are intentionally assertion-light by design; consider adding `// @selector-only-ok: visual/a11y spec` exemptions.
- `cross-persona/` journeys classified as unknown — likely use custom assertion helpers not matching regex patterns; manual inspection recommended.
- Gate script at `scripts/audit-e2e-depth-gate.ts` is **not yet wired into CI** (Wave 7). Local devs can run `bun run lint:e2e-depth` to see blockers.
