---
slice: wave-0b-features
phase: wave-0
agent_skills: [oli-execution-gate]
priority: P1
status: complete
depends_on: [wave-0a-infrastructure]
---

# Wave 0b: Foundation Features

## Goal

Build user-facing foundation features on top of Wave 0a infrastructure: membership join flow, public/auth screens, and one-tap payment via Stripe.

## Acceptance Criteria

### AC-W0B-001: Join Flow Frontend
- [x] Invite validation page: show org name, pre-filled email from invite (`routes/invite/$token.tsx`)
- [x] Registration form: user creates account during claim (BetterAuth UI handles registration)
- [x] Claim flow: `claimInvite()` → `addMember()` creates membership (13 tests)
- [x] Edge cases: already member (ConflictError), approval required, expired invite, revoked invite
- [x] Token validation library: `features/invite/lib/token-validation.ts`
- [x] Org discovery page: `routes/join.tsx` with search/filter
- [ ] E2E test: full invite → register → join journey

### AC-W0B-002: Public/Auth Screens
- [x] `/auth/forgot-password` — via BetterAuth UI (`routes/auth/$authView.tsx`)
- [x] `/auth/reset-password` — via BetterAuth UI dynamic routing
- [x] `/pay/:token` — unauthenticated dues payment page (`routes/pay/$token.tsx`)
- [x] Public org page: `/org/:slug` with application form, member count, org details (`routes/org/$slug.tsx`)
- [x] Public org endpoint registered via generated OpenAPI routes
- [ ] E2E test: forgot password → reset → login

### AC-W0B-003: One-Tap Payment (Stripe)
- [x] Signed payment token: HMAC-SHA256, 72h expiry, single-use (`handlers/dues/utils/payment-token.ts`)
- [x] Payment page: shows invoice amount, org name, member name (`routes/pay/$token.tsx`)
- [x] Stripe Checkout session created on submit (`handlers/dues/checkoutPaymentToken.ts` — 6 tests)
- [x] Send payment link: officer-only endpoint (`handlers/dues/sendPaymentLink.ts`)
- [x] Validate payment token: public endpoint (`handlers/dues/validatePaymentToken.ts`)
- [x] Connected account support (per-org Stripe configuration)
- [ ] E2E test: payment link → Stripe checkout → confirmation

## Business Rules

| BR | Description | Status |
|----|------------|--------|
| BR-24 | Invitation Expiry — 7-day default, configurable per org | COMPLETE |
| BR-25 | OTP Registration — phone-based for PH market | DEFERRED (Better-Auth) |

## Route Registration Audit

All endpoints verified registered (2026-05-24):

| Endpoint | Method | Registration | Auth |
|----------|--------|-------------|------|
| `/public/orgs` | GET | Hand-wired (app.ts:179) | None (public) |
| `/public/org/:slug` | GET | Generated OpenAPI routes | None (public) |
| `/pay/:token/validate` | GET | Hand-wired (app.ts:203) | None (public) |
| `/pay/:token/checkout` | POST | Hand-wired (app.ts:204) | None (public) |
| `/org/:orgId/payments/send-link` | POST | Hand-wired (app.ts:282) | Auth + Org context |
| `/invite` | POST | Generated OpenAPI routes | Auth + Org context |
| `/invite/claim/:token` | POST | Generated OpenAPI routes | Auth only |
| `/invite/validate/:token` | GET | Generated OpenAPI routes | None (public) |

## Verification Commands
```bash
bun test services/api-ts/src/handlers/invite/
bun test services/api-ts/src/handlers/dues/validatePaymentToken.test.ts
bun test services/api-ts/src/handlers/dues/checkoutPaymentToken.test.ts
bun test services/api-ts/src/handlers/dues/sendPaymentLink.test.ts
bun test services/api-ts/src/handlers/platformadmin/getOrganizationBySlug.test.ts
```
