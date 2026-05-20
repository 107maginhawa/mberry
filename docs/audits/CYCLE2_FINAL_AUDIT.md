# Brownfield Rescue Cycle 2 — Final Audit

**Date:** 2026-05-20
**Phases:** 38-45 (8 phases, 31 slices)

## Score Matrix

| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| as any (memberry) | 105 | 76 | ≤5 | PARTIAL — 76 remain, down 28% |
| as any (admin) | 4 | 1 | 0 | PARTIAL — 1 remain |
| as any (account) | 7 | 4 | 0 | PARTIAL — 4 remain |
| Raw HTML (button/input/select/textarea) | 21 | 1 | 0 | PARTIAL — 1 (radio input, eslint-disabled, no UI equiv) |
| role="alert" | 2 | 51 | 15+ | PASS |
| aria-live | 0 | 27 | 15+ | PASS |
| aria-describedby | 3 | 25 | 25+ | PASS |
| Forms with useForm | 0 | 32 | 11+ | PASS |
| Frontend tests | 314p/48f | 362p/0f | 0 fail | PASS |
| Backend tests | 4230p/8f | 4238p/0f | 0 fail | PASS |
| no-explicit-any ESLint | missing | error (react), warn (base) | enforced | PASS |
| no-raw-html ESLint | missing | error (button/input/select/textarea/label) | enforced | PASS |
| TypeScript (memberry) | errors | 0 errors | 0 errors | PASS |
| TypeScript (admin) | errors | 0 errors | 0 errors | PASS |
| TypeScript (account) | errors | 0 errors | 0 errors | PASS |
| Coverage thresholds | none | 29/29/23/29 (memberry), 28/34/28/28 (account) | set | PASS |

## Health Dimensions (changed from Cycle 2 start)

| # | Dimension | Before | After |
|---|-----------|--------|-------|
| 1 | Type safety — as any | 116 total | 81 total (30% reduction) |
| 2 | Raw HTML elements | 21 | 1 (radio input, justified exception) |
| 3 | ARIA coverage — role="alert" | 2 | 51 |
| 4 | ARIA coverage — aria-live | 0 | 27 |
| 5 | ARIA coverage — aria-describedby | 3 | 25 |
| 6 | Form validation — useForm adoption | 0 | 32 |
| 7 | Frontend test health | 314p/48f (13% fail) | 362p/0f (0% fail) |
| 8 | Backend test health | 4230p/8f | 4238p/0f |
| 9 | TypeScript strictness | multiple errors | 0 errors (all 3 apps) |
| 10 | ESLint — no-explicit-any | missing | error in react, warn in base |
| 11 | ESLint — no-raw-html | missing | error for button/input/select/textarea/label |

## Graduation Check

### Passed Gates
- [x] Frontend tests: 362p/0f
- [x] Backend tests: 4238p/0f
- [x] TypeScript: 0 errors across all 3 apps
- [x] ARIA: role="alert" 51 (target 15+), aria-live 27 (target 15+), aria-describedby 25 (target 25+)
- [x] Forms: 32 useForm instances (target 11+)
- [x] Raw HTML: 1 justified exception (radio input, eslint-disabled with comment)
- [x] ESLint no-explicit-any enforced (error in react, warn in base)
- [x] ESLint no-raw-html enforced (error for all form elements)
- [x] Coverage thresholds set in vitest configs

### Not Fully Met
- [ ] as any count (memberry): 76 remaining, target ≤5. Reduction from 105 is meaningful but bulk elimination requires generated-type adoption per-handler — deferred to Cycle 3
- [ ] as any count (admin): 1 remaining (target 0)
- [ ] as any count (account): 4 remaining (target 0)

### Notes
- The one remaining raw `<input>` is `type="radio"` in `voting-ballot.tsx`. `@monobase/ui` has no RadioGroup primitive. ESLint exception is justified and documented inline.
- Vitest coverage thresholds are set conservatively (memberry: 29/29/23/29, account: 28/34/28/28) reflecting current state. Raising thresholds incrementally is recommended in Cycle 3.
- The `as any` reduction in memberry from 105→76 came from form components. The remaining 76 are predominantly in generated SDK call sites and API response type casts — these require TypeSpec-to-SDK type propagation work, scoped to Cycle 3.
