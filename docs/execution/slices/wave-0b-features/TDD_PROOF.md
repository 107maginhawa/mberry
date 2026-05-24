---
slice: wave-0b-features
generated_by: oli-confidence-stack (manual verification)
date: 2026-05-24
---

# TDD Proof — Wave 0b Features

## Context Coverage

| Document | Loaded | Path |
|----------|--------|------|
| SLICE_SPEC.md | YES | `docs/execution/slices/wave-0b-features/SLICE_SPEC.md` |
| CONTEXT.md | YES | `.planning/phases/wave0-foundation/CONTEXT.md` |

## Spec Item Coverage

| AC ID | Description | Test File(s) | Status |
|-------|------------|-------------|--------|
| AC-W0B-001 | Join flow frontend | `invite/createInvite.test.ts` (12), `invite/validateInvite.test.ts` (7), `invite/claimInvite.test.ts` (13) | COVERED |
| AC-W0B-002 | Public/auth screens | `platformadmin/getOrganizationBySlug.test.ts` (9), BetterAuth UI | COVERED |
| AC-W0B-003 | One-tap payment | `dues/validatePaymentToken.test.ts`, `dues/checkoutPaymentToken.test.ts` (6), `dues/sendPaymentLink.test.ts` | COVERED |

## Test Results (2026-05-24)

```
58 pass, 0 fail, 128 expect() calls across 7 files
```

### Breakdown

| Handler | Tests | Assertions | Status |
|---------|-------|------------|--------|
| createInvite | 12 | — | PASS |
| validateInvite | 7 | — | PASS |
| claimInvite | 13 | — | PASS |
| getOrganizationBySlug | 9 | — | PASS |
| validatePaymentToken | — | — | PASS |
| checkoutPaymentToken | 6 | — | PASS |
| sendPaymentLink | — | — | PASS |

## Frontend Routes (verified exist)

| Route | File | Auth Required |
|-------|------|--------------|
| `/join` | `routes/join.tsx` | No |
| `/invite/:token` | `routes/invite/$token.tsx` | No (redirects to auth if needed) |
| `/org/:slug` | `routes/org/$slug.tsx` | No |
| `/pay/:token` | `routes/pay/$token.tsx` | No |
| `/auth/:authView` | `routes/auth/$authView.tsx` | No |

## Route Registration Audit

All 8 endpoints verified registered in app.ts or generated OpenAPI routes. See SLICE_SPEC.md for full table.

## Notes

- Wave 0b built across multiple sessions, not through GSD pipeline
- No git-history RED→GREEN ordering (not TDD-driven originally)
- E2E tests for join flow and payment not yet written (marked in SLICE_SPEC)
- BetterAuth UI handles auth screens (forgot-password, reset, verify-email, two-factor)
- Stripe webhook for payment settlement exists in billing module
