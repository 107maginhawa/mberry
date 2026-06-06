# UI Journey Report: m01-auth-onboarding

**Framework:** React + TanStack Router (Vite)
**Files Scanned:** 12
**Interactive Elements Found:** 28
**Audit Date:** 2026-05-27

## Files Scanned

| # | File | Role |
|---|------|------|
| 1 | `apps/memberry/src/routes/auth/$authView.tsx` | Sign-in/sign-up/forgot-password/verify-email/2FA (Better-Auth UI delegated) |
| 2 | `apps/memberry/src/routes/index.tsx` | Root redirect (guest->sign-in, authed->dashboard) |
| 3 | `apps/memberry/src/routes/__root.tsx` | AuthUIProviderTanstack wrapper, session change handler |
| 4 | `apps/memberry/src/routes/_authenticated.tsx` | Auth guard layout, 404 fallback |
| 5 | `apps/memberry/src/routes/verify-email.tsx` | Email verification prompt + resend |
| 6 | `apps/memberry/src/routes/onboarding.tsx` | 2-step person profile creation wizard |
| 7 | `apps/memberry/src/routes/invite/$token.tsx` | Invite validation + claim flow |
| 8 | `apps/memberry/src/routes/join.tsx` | Public org discovery + navigate to org profile |
| 9 | `apps/memberry/src/routes/org/$slug.tsx` | Public org profile + membership application form |
| 10 | `apps/memberry/src/routes/discover/events.tsx` | Public event listing with filters |
| 11 | `apps/memberry/src/routes/events/$eventSlug.tsx` | Public event detail + CTA links |
| 12 | `apps/memberry/src/utils/guards.ts` | Route guards: requireAuth, requireGuest, requireEmailVerified, etc. |

---

## Registry 1: Action Registry

| Module | Screen | Element | Type | Label | Handler | API Call | Role Gate | WF-NNN | Confidence |
|--------|--------|---------|------|-------|---------|----------|-----------|--------|------------|
| m01 | /auth/$authView | AuthView component | 3rd-party | Sign In / Sign Up / Forgot Password / 2FA | Delegated to @daveyplate/better-auth-ui | Better-Auth endpoints (email/password, magic-link, etc.) | None (public) | WF-003, WF-001, WF-004, WF-006 | HIGH |
| m01 | / (index) | beforeLoad redirect | redirect | N/A | context.auth.user check | None | None | WF-003 | HIGH |
| m01 | __root | AuthUIProviderTanstack | provider | N/A | onSessionChange invalidates queries | session + person query invalidation | None | WF-003 | HIGH |
| m01 | __root | Skip-to-content link | anchor | "Skip to content" | Native anchor | None | None | N/A | HIGH |
| m01 | __root | 404 "Go home" Link | Link | "Go home" | Link to="/" | None | None | N/A | HIGH |
| m01 | _authenticated | 404 "Go home" Link | Link | "Go home" | Link to="/dashboard" | None | requireAuth | N/A | HIGH |
| m01 | /verify-email | "Resend Verification Email" Button | button | "Resend Verification Email" | handleResendVerification | authClient.sendVerificationEmail | requireAuth + requireNotEmailVerified | WF-001 | HIGH |
| m01 | /verify-email | "Sign Out" Button | button | "Sign Out" | handleSignOut | authClient.signOut -> redirect /auth/sign-in | requireAuth | WF-003 | HIGH |
| m01 | /onboarding | Step 1 "Next" Button | button | "Next" | requestSubmit() on form -> handlePersonalInfoSubmit | None (local state) | requireAuth + requireEmailVerified + requireNoPerson | WF-005 | HIGH |
| m01 | /onboarding | Step 2 "Back" Button | button | "Back" | goBack() | None (local state) | requireAuth | WF-005 | HIGH |
| m01 | /onboarding | Step 2 "Skip for now" Button | button | "Skip for now" | handleSkipAddress | createPersonMutation (POST /persons) | requireAuth | WF-005 | HIGH |
| m01 | /onboarding | Step 2 "Complete Setup" Button | button | "Complete Setup" | requestSubmit() -> handleAddressSubmit | createPersonMutation (POST /persons) | requireAuth | WF-005 | HIGH |
| m01 | /onboarding | PersonalInfoForm | form | Personal Info | onSubmit={handlePersonalInfoSubmit} | None (local step) | requireAuth | WF-005 | HIGH |
| m01 | /onboarding | AddressForm | form | Address | onSubmit={handleAddressSubmit}, onSkip={handleSkipAddress} | createPersonMutation | requireAuth | WF-005 | HIGH |
| m01 | /invite/$token | "Accept Invitation" Button | button | "Accept Invitation" | handleClaim | claimInviteToken (POST /invite/:token/claim) | requireAuth (session) | WF-007 | HIGH |
| m01 | /invite/$token | "Sign in to accept invitation" Button | button | "Sign in to accept invitation" | handleSignIn -> window.location redirect | None (redirect) | None (unauthenticated) | WF-007 | HIGH |
| m01 | /invite/$token | "Log in instead" anchor | anchor | "Log in instead" | href="/auth/sign-in" | None | None (error state) | WF-007 | HIGH |
| m01 | /join | Search Input | input | "Search organizations..." | handleSearchChange -> debounced query | GET /public/orgs?search= | None (public) | N/A | HIGH |
| m01 | /join | Org Card Button | button | Org name | handleOrgClick -> navigate to /org/$slug | None (navigation) | None (public) | N/A | HIGH |
| m01 | /org/$slug | "Apply to Join" Button | button | "Apply to Join" | handleApplyClick | GET /persons/me (auth check), GET /association/member/tiers | None (public page, auth checked in handler) | WF-001 | HIGH |
| m01 | /org/$slug | Apply form - Tier Select | select | "Membership Tier" | onValueChange={setSelectedTierId} | None (local state) | Authenticated | N/A | HIGH |
| m01 | /org/$slug | Apply form - Message Textarea | textarea | "Message" | react-hook-form register | None (local state) | Authenticated | N/A | HIGH |
| m01 | /org/$slug | Apply form - "Submit Application" Button | button | "Submit Application" | handleSubmitApplication | POST /association/member/applications | Authenticated | WF-001 | HIGH |
| m01 | /org/$slug | Apply form - "Cancel" Button | button | "Cancel" | setApplyOpen(false) | None | Authenticated | N/A | HIGH |
| m01 | /org/$slug | Contact email link | anchor | Org email | href={mailto:} | None | None | N/A | HIGH |
| m01 | /discover/events | Search Input | input | "Search events..." | onChange -> setSearch | listPublicEventsOptions (query) | None (public) | N/A | HIGH |
| m01 | /discover/events | Event Type Select | select | "Event type" | onValueChange={setEventType} | listPublicEventsOptions (query) | None (public) | N/A | HIGH |
| m01 | /discover/events | Pricing Select | select | "Pricing" | onValueChange={setPricing} | listPublicEventsOptions (query) | None (public) | N/A | HIGH |
| m01 | /discover/events | Event Card Link | Link | Event title | Link to /events/:slug | None | None (public) | N/A | HIGH |
| m01 | /events/$eventSlug | "Join Now" Link->Button | Link+Button | "Join Now" | Link to="/join" | None | None (public) | N/A | HIGH |
| m01 | /events/$eventSlug | "Sign In" Link->Button | Link+Button | "Sign In" | Link to /auth/$authView params sign-in | None | None (public) | WF-003 | HIGH |

---

## Registry 2: Journey Completion Matrix

| WF-ID | Description | Steps | UI Entry | Elements Found | Handlers OK | API Verified | Completable | Severity |
|-------|-------------|-------|----------|----------------|-------------|--------------|-------------|----------|
| WF-001 | Self-Registration | 7 | /auth/sign-up (via AuthView) | AuthView handles sign-up form + OTP | YES (Better-Auth UI) | YES (Better-Auth endpoints) | PARTIAL | P1 |
| WF-002 | Account Claim (imported) | 6 | /accept-invite/[token] | NO route at /accept-invite/* | NO | NO | BROKEN | P0 |
| WF-003 | Login | 5 | /auth/sign-in | AuthView sign-in form | YES | YES | COMPLETE | -- |
| WF-004 | Forgot Password | 5 | /auth/forgot-password (via AuthView) | AuthView forgot-password view | YES (Better-Auth UI) | YES | COMPLETE | -- |
| WF-005 | Smart Onboarding Wizard | 7 | /onboarding | 2-step person creation (personal info + address) | YES | POST /persons via createPersonMutation | PARTIAL | P2 |
| WF-006 | Magic Link Login | 4 | /auth/sign-in (via AuthView) | AuthView credentials prop enables magic link? | UNMAPPABLE | Unclear if magic-link exposed in AuthView | UNMAPPABLE | P2 |
| WF-007 | Account Claim (Imported Member) | 5 | /invite/$token | Validate + claim buttons present | YES | GET /invite/:token/validate + POST /invite/:token/claim | PARTIAL | P1 |
| WF-008 | Invite Member | 4 | Officer dashboard (out of m01 frontend scope) | N/A (officer-side) | N/A | N/A | N/A | -- |
| WF-009 | Bulk CSV Import | 5 | Officer dashboard (out of m01 frontend scope) | N/A (officer-side) | N/A | N/A | N/A | -- |

### Journey Notes

- **WF-001 PARTIAL**: Spec says `/register` route with name, email, license number, password fields + OTP on `/verify`. Implementation delegates to Better-Auth UI `AuthView` at `/auth/sign-up` which renders generic sign-up. No `/register` route exists. No license number field in sign-up. OTP step handled internally by Better-Auth, not a custom `/verify` page. Step 6 (org-linked membership application) not wired from sign-up flow.
- **WF-002 BROKEN**: Spec says `/accept-invite/[token]` but actual route is `/invite/$token`. The route exists and works for WF-007 but the URL path differs from spec. More critically, the WF-002 flow expects pre-populated data with password-set + OTP steps -- the actual `/invite/$token` page only shows "Accept Invitation" (authenticated) or "Sign in to accept" (unauthenticated). No password-set or OTP step in the claim flow.
- **WF-005 PARTIAL**: Spec describes a 7-step officer onboarding wizard (org profile, import members, configure dues, connect payment, send welcome emails). Actual `/onboarding` is a 2-step member profile creation (personal info + address). These are completely different flows. The spec's WF-005 targets officers; the implementation targets new members post-registration.
- **WF-006 UNMAPPABLE**: The `AuthUIProviderTanstack` has `credentials` prop set but unclear if magic link is exposed. The Better-Auth UI `AuthView` may or may not render a "Send magic link" option depending on backend config.
- **WF-007 PARTIAL**: Invite flow works but lacks: identity verification step (license number + email match), password-set step, optional MFA enrollment. Current flow is "validate token -> claim with one click" for authenticated users.

---

## Registry 3: Element->Action Binding Map

| Element | File:Line | Handler | API Method | API Path | Backend Exists? | Confidence |
|---------|-----------|---------|------------|----------|-----------------|------------|
| AuthView (sign-in) | auth/$authView.tsx:56 | Better-Auth internal | POST | /api/auth/sign-in/email | YES (Better-Auth) | HIGH |
| AuthView (sign-up) | auth/$authView.tsx:56 | Better-Auth internal | POST | /api/auth/sign-up/email | YES (Better-Auth) | HIGH |
| AuthView (forgot-password) | auth/$authView.tsx:56 | Better-Auth internal | POST | /api/auth/forgot-password | YES (Better-Auth) | HIGH |
| AuthView (two-factor) | auth/$authView.tsx:56 | Better-Auth internal | POST | /api/auth/two-factor/verify | YES (Better-Auth) | HIGH |
| Resend Verification Email | verify-email.tsx:25 | handleResendVerification | POST | /api/auth/send-verification-email | YES (Better-Auth) | HIGH |
| Sign Out | verify-email.tsx:41 | handleSignOut | POST | /api/auth/sign-out | YES (Better-Auth) | HIGH |
| Create Person (onboarding) | onboarding.tsx:167 | createPerson.mutate | POST | /api/persons | YES (person handler) | HIGH |
| Validate Invite Token | invite/$token.tsx:27 | validateInviteToken | GET | /api/invite/:token/validate | YES (invite handler) | HIGH |
| Claim Invite Token | invite/$token.tsx:39 | claimInviteToken | POST | /api/invite/:token/claim | YES (invite handler) | HIGH |
| Auth Check (org apply) | org/$slug.tsx:65 | handleApplyClick | GET | /api/persons/me | YES | HIGH |
| Fetch Tiers | org/$slug.tsx:79 | handleApplyClick | GET | /api/association/member/tiers | YES | HIGH |
| Submit Application | org/$slug.tsx:102 | handleSubmitApplication | POST | /api/association/member/applications | YES | HIGH |
| Public Org Fetch | org/$slug.tsx:28 | useQuery | GET | /api/public/org/:slug | YES | HIGH |
| Public Orgs List | join.tsx:43 | useQuery | GET | /api/public/orgs | YES | HIGH |
| Public Events List | discover/events.tsx:39 | useQuery | GET | /api/events/public (listPublicEventsOptions) | YES | HIGH |
| Public Event Detail | events/$eventSlug.tsx:38 | useQuery | GET | /api/events/public/:slug (getPublicEventOptions) | YES | HIGH |
| Session Query | main.tsx:23 | useSession | GET | /api/auth/get-session | YES (Better-Auth) | HIGH |

---

## Registry 4: Role Journey Completion

| Role | Assigned Journeys | Completable | Blocked By |
|------|-------------------|-------------|------------|
| Unauthenticated (prospective member) | WF-001 (Self-Registration) | PARTIAL | No `/register` route; sign-up delegates to generic Better-Auth UI; no license number field; no org-linking from sign-up |
| Unauthenticated (prospective member) | WF-003 (Login) | COMPLETE | -- |
| Unauthenticated (prospective member) | WF-004 (Forgot Password) | COMPLETE | -- |
| Unauthenticated (prospective member) | WF-006 (Magic Link) | UNMAPPABLE | Cannot confirm if magic link option is exposed in AuthView |
| Imported member | WF-002 (Account Claim) | BROKEN | Route path mismatch; no password-set or OTP in claim flow |
| Imported member | WF-007 (Account Claim - Imported) | PARTIAL | No identity verification, no password-set, no MFA enrollment |
| Officer (president/secretary) | WF-005 (Smart Onboarding Wizard) | BROKEN (spec mismatch) | Implemented as member profile wizard, not officer org setup wizard |
| Officer (president/secretary) | WF-008 (Invite Member) | N/A | Officer-side flow, not in m01 frontend scope of memberry app |
| Officer (president/secretary) | WF-009 (Bulk CSV Import) | N/A | Officer-side flow, not in m01 frontend scope of memberry app |

---

## Registry 5: Dead Interaction Report

| ID | File:Line | Element | Issue | Severity |
|----|-----------|---------|-------|----------|
| J-M01-001 | onboarding.tsx:286-293 | Step 1 "Next" Button | Has both `type="submit" form="step-1-form"` AND an onClick that calls `forms[0].requestSubmit()`. Double-submission possible: the `type="submit"` with `form` attribute already triggers form submit, then the onClick fires requestSubmit() again on first form found. This is redundant but not dead -- however it could cause double state updates. | P2 |
| J-M01-002 | onboarding.tsx:310-319 | Step 2 "Complete Setup" Button | Same double-submit pattern: `type="submit"` without `form` attribute + onClick with `forms[0].requestSubmit()`. The button is not inside any form, so `type="submit"` alone would not submit. The onClick is the actual trigger. Not dead but misleading `type="submit"`. | P2 |
| J-M01-003 | verify-email.tsx:109 | "Need help? Contact support" text | Static text with no link or interaction. Appears to be a dead contact link -- no mailto, no href, no onClick. | P2 |

---

## Registry 6: Navigation Integrity

| Link/Navigate | Source File | Target Route | Exists? | Severity |
|---------------|-------------|--------------|---------|----------|
| `to="/"` | __root.tsx (NotFoundPage) | `/` (index.tsx) | YES | -- |
| `to="/dashboard"` | _authenticated.tsx (notFound) | `/_authenticated/dashboard` | YES | -- |
| `to="/auth/$authView" params={sign-in}` | index.tsx (redirect) | `/auth/sign-in` | YES | -- |
| `to="/auth/$authView" params={sign-in}` | guards.ts (requireAuth) | `/auth/sign-in` | YES | -- |
| `to="/auth/$authView" params={sign-in}` | guards.ts (requireOrgOfficer) | `/auth/sign-in` | YES | -- |
| `to="/onboarding"` | guards.ts (requirePerson) | `/onboarding` | YES | -- |
| `to="/dashboard"` | guards.ts (requireNoPerson, requireNotEmailVerified) | `/dashboard` | YES | -- |
| `to="/verify-email"` | guards.ts (requireEmailVerified) | `/verify-email` | YES | -- |
| `window.location.href = /auth/sign-in` | verify-email.tsx:45 | `/auth/sign-in` | YES | -- |
| `to="/dashboard"` | onboarding.tsx:173 | `/dashboard` | YES | -- |
| `to="/org/$orgSlug/home"` | invite/$token.tsx:43 | `/org/$orgSlug/home` (inside _authenticated) | UNKNOWN | P2 |
| `to="/my/organizations"` | invite/$token.tsx:45 | `/_authenticated/my/organizations` | YES | -- |
| `window.location.href = /auth/sign-in?redirect=` | invite/$token.tsx:54 | `/auth/sign-in` | YES | -- |
| `href="/auth/sign-in"` | invite/$token.tsx:86 | `/auth/sign-in` | YES | -- |
| `window.location.href = /auth/sign-in?redirect=` | org/$slug.tsx:70 | `/auth/sign-in` | YES | -- |
| `window.location.href = /auth/sign-in?redirect=` | org/$slug.tsx:116 | `/auth/sign-in` | YES | -- |
| `to="/org/$slug"` | join.tsx:57 | `/org/$slug` | YES | -- |
| `to="/join"` | events/$eventSlug.tsx:182 | `/join` | YES | -- |
| `to="/auth/$authView" params={sign-in}` | events/$eventSlug.tsx:185 | `/auth/sign-in` | YES | -- |
| `to="/events/${event.eventSlug}" (dynamic string)` | discover/events.tsx:146 | `/events/$eventSlug` | YES (but uses string interpolation `as any`) | P2 |

---

## Findings Summary

| ID | Severity | Registry | Finding | File |
|----|----------|----------|---------|------|
| J-M01-004 | P0 | R2 | **WF-002 (Account Claim) route mismatch**: Spec defines `/accept-invite/[token]` but no such route exists. Actual invite flow is at `/invite/$token` which implements WF-007, not WF-002. The WF-002 flow (pre-populated data, password-set, OTP verification) is entirely unimplemented. | `apps/memberry/src/routes/invite/$token.tsx` |
| J-M01-005 | P1 | R2 | **WF-001 (Self-Registration) missing custom route**: Spec requires `/register` with license number, password strength validation, OTP on `/verify`, and org-linking. Implementation delegates entirely to Better-Auth UI generic sign-up at `/auth/sign-up`. No license number collection, no custom OTP page, no org-linking from sign-up. | `apps/memberry/src/routes/auth/$authView.tsx` |
| J-M01-006 | P1 | R2 | **WF-005 (Smart Onboarding Wizard) is a spec-vs-impl mismatch**: Spec describes a 7-step officer onboarding wizard (org profile, import members, configure dues, connect payment, send welcome emails). Actual `/onboarding` is a 2-step member profile creation wizard. These are completely different features serving different actors. | `apps/memberry/src/routes/onboarding.tsx` |
| J-M01-007 | P1 | R2 | **WF-007 (Account Claim - Imported Member) missing verification steps**: Spec requires identity verification (license number + email match), password-set, optional MFA enrollment. Current flow is single-click "Accept Invitation" with no identity verification or credential setup. | `apps/memberry/src/routes/invite/$token.tsx` |
| J-M01-008 | P2 | R2 | **WF-006 (Magic Link Login) unmappable**: Cannot verify if Better-Auth UI `AuthView` component exposes the magic link option. The `AuthUIProviderTanstack` has `credentials` prop but no explicit magic-link enablement. Backend may support it but UI exposure is unclear. | `apps/memberry/src/routes/auth/$authView.tsx` |
| J-M01-001 | P2 | R5 | **Double-submit pattern on onboarding Step 1**: Button has `type="submit" form="step-1-form"` AND onClick with `requestSubmit()`, creating potential double form submission. | `apps/memberry/src/routes/onboarding.tsx:286-293` |
| J-M01-002 | P2 | R5 | **Misleading submit button on onboarding Step 2**: `type="submit"` without `form` attribute on a button outside any form element. The onClick handler is the actual trigger. | `apps/memberry/src/routes/onboarding.tsx:310-319` |
| J-M01-003 | P2 | R5 | **Dead support text**: "Need help? Contact support" renders as plain text with no link, email, or interaction target. | `apps/memberry/src/routes/verify-email.tsx:109` |
| J-M01-009 | P2 | R6 | **Unverified navigation target**: `/org/$orgSlug/home` used in invite claim success path. Route existence under `_authenticated/org/$orgSlug/` is not confirmed -- may be `route.tsx` (layout) without a `/home` child. | `apps/memberry/src/routes/invite/$token.tsx:43` |
| J-M01-010 | P2 | R6 | **String interpolation for route path**: `to={/events/${event.eventSlug}}` uses dynamic string with `as any` cast instead of TanStack Router typed params. Works but bypasses type safety. | `apps/memberry/src/routes/discover/events.tsx:146` |

---

## Architecture Notes

**Auth delegation model**: The m01 frontend delegates sign-in, sign-up, forgot-password, email verification, and 2FA entirely to the `@daveyplate/better-auth-ui` library via a single catch-all route `/auth/$authView`. This is a sound pattern for standard auth flows but creates a gap where the spec requires custom fields (license number, org-linking) that the generic UI does not provide.

**Guard chain**: The `composeGuards` utility in `guards.ts` creates a clean auth flow:
- `requireAuth` -> redirects to `/auth/sign-in` with redirect param
- `requireEmailVerified` -> redirects to `/verify-email`
- `requireNoPerson` -> redirects to `/dashboard` (prevents re-onboarding)
- `requirePerson` -> redirects to `/onboarding`

This guard chain correctly enforces: unauthenticated -> sign-in -> verify-email -> onboarding -> dashboard.

**Session bootstrap**: `main.tsx` loads session via `useSession()` before mounting the router, ensuring all guards have auth context available synchronously.
