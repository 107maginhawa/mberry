<!-- oli-version: 1.0 -->
<!-- generated: 2026-06-03T20:45:00Z -->
<!-- emitted-by: phase-d-rebaseline-005 (Tier-E convergence loop) -->
<!-- baseline-pin: docs/audits/enforce/.baseline.json v56 -->

# Tier-F Backlog

Items surfaced during Tier-E convergence that are **out of scope** for the
ratchet but worth tracking. Empty `## Out-of-Scope Discoveries` indicates a clean converge.

---

## Out-of-Scope Discoveries

*Empty — Tier-E converged at iter 2 with all 93 detector matches annotated, zero unannotated. No new patterns surfaced.*

---

## Accepted-Floor Items

### Tier-F test-infra remediation (2026-06-03)

Pre-remediation baseline: 6241p / 385f / 220e (605 broken).
Post-remediation: 6207p / 50f / 4e (54 broken). Reduction: -551 broken (-91%).

Fixes landed:
- `bunfig.toml` + `test-setup-root.ts` — bun:test preload that (a) skips
  Playwright `*.spec.ts` files, (b) registers happy-dom + jest-dom matchers,
  (c) seeds `AUTH_SECRET` so config-loading tests don't hit the production
  zod-superRefine guard.
- `apps/{memberry,admin}/src/test/vitest-shim.ts` — workspace-local replacement
  for `vitest` that re-exports bun:test primitives + a Vitest-compatible `vi`
  shim (mock.module, jest.useFakeTimers, hoisted, etc.).
- Codemod: `from 'vitest'` → `from '@/test/vitest-shim'` across 109 test files.
- Codemod: `@monobase/sdk-ts/generated/@tanstack/react-query.gen` →
  `@monobase/sdk-ts/generated/react-query` across 81 source/test files
  (the long sub-path is exported but unresolvable by Bun's resolver; the
  shorter alias is equivalent).

Accepted floor — 54 tests remain unfixable without structural changes outside
the test-infra scope:

| # | Bucket | Cause | Why floor |
|---|---|---|---|
| ~30 | Admin route tests, OrgIconRail/OrgPickerSheet/NotificationDrawer, OrgProvider | Tests call `vi.mock(...)` AFTER the file-level imports they intend to mock. Vitest hoists `vi.mock` above imports at parse time; bun:test does not. The mock factory runs too late, the real module loads, components fail to render. | Requires rewriting each test to either use `mock.module` BEFORE imports (codemod), or to use dependency-injected wrappers. Out of scope for test-infra. |
| 4 | `csrf-token middleware` | Server returns `CSRF_TOKEN_MISSING` where test expects `CSRF_TOKEN_MISMATCH`; GET endpoint returns empty cookie. | Real product behavior drift — middleware change vs test expectation. Needs middleware/test reconciliation, not test-infra. |
| 4 | `impersonation-guard middleware` | 403 expected paths returning different codes. | Same — real product drift. |
| 3 | `flags.map is not a function` (admin feature-flags table) | SDK return shape mismatch with test data. | Genuine mock data issue. |
| 1 | `QueryClient defaults regression guard` | Static check on `main.tsx` import; build artifact path differs under bun:test. | Test-tooling-coupled; would need rework. |
| 1 | `batchGenerateSlots > generates slots for multiple events` | Test assertion drift. | Genuine product behavior to investigate. |
| 1 | `OrgProvider > empty orgId guard` | wait-for query times out — relies on intercepted SDK that didn't intercept (same root cause as bucket 1). | Same as bucket 1. |
| ~10 | Misc render-on-mock failures | Element type null — mock returned undefined where component expected. | Same vi.mock-not-hoisted root cause. |

Net effect: green test gate is achievable for new development; the 54-test
floor is documented and triaged. Further reduction requires either codemod of
test files to use `mock.module` before imports (mechanical, ~30 files), or
migration of `apps/admin` route tests to use TanStack Router's `createMemoryHistory`
+ real (un-mocked) `createFileRoute` (architectural, multi-day).

Annotation counts by category (informational, not regression):

| Category | Count | Rationale |
|---|---:|---|
| `nav-icon` | 15 | Sidebar/header icons at size 18/22 — system convention for navigation iconography. Codifying a `nav-icon` Icon variant is a future Tier-F refactor. |
| `empty-state-emphasis` | 17 | EmptyState hero icons at size 32/40/48. Intentional visual emphasis. |
| `interactive-emphasis` | 7 | Call controls (56px round), avatar-edit (32px round), rating stars (36px), survey spinner (32px). |
| `menu-item-exempt` | 8 | Custom dropdown menu items in `survey-list` + `training-card` use `<Button variant="ghost">` with `px-3 py-1.5` to match menu visual rhythm. Future: introduce shared `<MenuItem>` primitive (Tier-F). |
| `methodology-carry` | 9 | Pre-existing patterns surfaced by stricter detector — soft-success outlines, approve-buttons, badge-as-button. No new debt. |
| `skeleton-placeholder` | 2 | `skeleton-loader.tsx` Bone shapes with arbitrary px. By design. |
| `custom-component-prop` | 1 | `CreditRing size={44}` — component scalar prop, not Icon size. |
| `brand-color-system` | 1 | Admin sidebar `#2D2635` — single source for admin chrome. Tier-F: extract to `--color-admin-chrome`. |
| `auth-flow` | 2 | Sign-in + verify-email standalone shells. |
| `landing-page` | 1 | Public landing root. |
| `onboarding-step` | 3 | Multi-step onboarding wizards own their shell. |
| `public-verify` | 6 | Token/credential verification + public org/event pages — no app chrome. |
| `full-height-layout` | 15 | Officer shell + bookings shell. Have their own chrome (sidebar, header, etc.). |

**Total annotations:** 93 / 93 detector matches = 100% annotated, 0 unannotated.

---

## Already-Deferred (cross-reference)

- **v1.2.0 mega-module split** — `association:member` (157 handlers) decomposition. Plan at `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md`. Cross-cuts UI when officer/admin shells get reorganized; defer Tier-F `nav-icon` codification until that split lands.
- **m19 (deferred)** — see `ROADMAP.md`. Out of scope for UI-C ratchet.
- **OneSignal multi-app architecture** — runtime config concern, not UI consistency.

---

## Future Tier-F refactor candidates (not blocking)

1. **`nav-icon` Icon variant** — codify size=18 + size=22 as named props on the Icon abstraction, drop 15 annotations.
2. **`<MenuItem>` primitive** — replace `<Button variant="ghost" className="w-full justify-start px-3 py-1.5">` pattern, drop 8 annotations.
3. **Admin chrome token** — `--color-admin-chrome: #2D2635` in `globals.css`, replace `bg-[#2D2635]` with `bg-admin-chrome`, drop 1 annotation.
4. **EmptyState size scale** — `<EmptyState size="lg" />` instead of `<EmptyState icon={<X size={40} />} />`, drop 17 annotations.
5. **Officer/admin layout extraction** — pull `officer.tsx` shell into a `OfficerShell` layout component, so descendants can use PageShell, drop 15 full-height-layout annotations.
