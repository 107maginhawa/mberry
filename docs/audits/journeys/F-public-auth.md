## Cluster F — Public/Auth/Invite

Static read-only UI journey audit. apps/memberry. Run nothing.

### Scan Manifest

| Sub-module | Files inventoried | Files scanned | Status |
|---|---|---|---|
| shell | `__root.tsx`, `_authenticated.tsx`, `utils/guards.ts` | 3 | COMPLETE |
| auth | `auth/$authView.tsx` | 1 | COMPLETE |
| landing/discover | `index.tsx`, `discover/events.tsx`, `events/$eventSlug.tsx`, `org/$slug.tsx` | 4 | COMPLETE |
| join/invite | `join.tsx`, `invite/$token.tsx`, `features/invite/lib/token-validation.ts` (+`.test.ts`) | 3 | COMPLETE |
| pay | `pay/$token.tsx` | 1 | COMPLETE |
| verify | `verify-email.tsx`, `verify/$certificateNumber.tsx`, `verify/$credentialNumber.tsx`, `verify/$token.tsx` | 4 | COMPLETE |
| onboarding | `onboarding.tsx`, `features/onboarding/lib/professional-fields.ts`, `features/account/components/data-export.tsx` (+`.test.tsx`) | 3 | COMPLETE |

Inventoried = scanned. Not INCOMPLETE.
account/components/data-export.tsx audited here (auth-adjacent privacy export). professional-fields.ts = pure data (no interactive elements). `.test.*` files excluded from element counts.

Total interactive elements: ~34.

---

### shell

Auth guard verified WORKING. `_authenticated.tsx` L16 `beforeLoad: requireAuth`. `guards.ts` `requireAuth` (L18-29): if `!context.auth.user` → `throw redirect({ to:'/auth/$authView', params:{authView:'sign-in'}, search:{redirect: location.href} })`. Preserves return URL. No P0/P1 guard gap.
`index.tsx`: guest → sign-in, authed → /dashboard (pure redirect, never renders). `requireGuest`, `requireOrgOfficer`, `composeGuards`, `requireEmailVerified`/`requireNotEmailVerified`/`requireNoPerson` all present and used. `__root.tsx` mounts `AuthUIProviderTanstack` + `Toaster`.

#### Registry 1
| Element | Type | Label | Handler | API | RoleGate | Conf |
|---|---|---|---|---|---|---|
| sidebar/header nav (Link) | Link | various | router | — | authed | High |
| 404 notFound Link | Link | back | router | — | authed | High |

No non-PASS Registry 2/4/5/9. Guard PASS.

---

### auth

Thin wrapper. `auth/$authView.tsx` delegates entirely to `<AuthView pathname callbackURL>` from `@daveyplate/better-auth-ui`. Sign-in/sign-up/forgot-password/verify-email/two-factor headers mapped. Form submit, error surfacing, success redirect handled inside Better-Auth UI lib (out of repo scope) — flows are library-managed; trust by composition.

#### Registry 1
| Element | Type | Label | Handler | API | Conf |
|---|---|---|---|---|---|
| `<AuthView>` | form host | sign-in/up/reset | better-auth-ui | better-auth | High |

No non-PASS. Note J-AUTH-N1 (info, not finding): auth error/success UX not auditable statically — owned by library.

---

### landing/discover

`discover/events.tsx`: `listPublicEventsOptions` query. Filters (search/type/pricing). Error branch renders EmptyState "Something went wrong. Please try again." — static inline error STATE (not a toast), acceptable for a read-only list. Event cards = `<Link>` to event slug.
`events/$eventSlug.tsx`: `getPublicEventOptions`. CTA (L172-186) "Join to register" → `<Link to="/join">` + `<Link to=/auth sign-in>`. No dead button.
`org/$slug.tsx`: public org page + Apply-to-Join dialog. `handleApplyClick` (L61) redirects unauth → sign-in w/ redirect param. `handleSubmitApplication` (L90) has full onError: 401→re-auth, 409→"pending application", else interpolates `err.body.error` w/ fallback. Tier-required + account-id guards toast.

#### Registry 9 (Error-UX)
| ID | Sev | File:Line | Issue |
|---|---|---|---|
| J-DISC-001 | P3 | discover/events.tsx:115 | Query-error EmptyState `description="Something went wrong. Please try again."` static, no interpolation. Read-only list, low impact — downgraded from P2. |
| J-ORG-001 | P3 | org/$slug.tsx:126 | Final catch-all `toast.error('Something went wrong. Please try again.')` — but L124 already interpolates `err.body.error` for ApiError; this is only the non-ApiError fallback. PASS-adjacent; logged P3. |

org submit-application is interpolated → Registry 9 PASS for the failable mutation.

---

### join/invite

`join.tsx`: `public-orgs` query, debounced search, org cards → `navigate('/org/$slug')`. Read-only discovery; no failable mutation. Loading skeleton + empty state present.
`invite/$token.tsx`: `validateInviteToken` on mount → sets invite/error. `claimInviteToken` on accept → on success `navigate('/my/organizations')` (or org route); on failure sets `error` with code-aware copy (EXPIRED / ALREADY_CLAIMED). `handleSignIn` redirects to sign-in w/ redirect back to invite. Error branch (L72) renders interpolated `error.error`.
`token-validation.ts`: `validateInviteToken`/`claimInviteToken` both wrap ApiError, return `{ok:false, error}` with server `body.error` preserved (fallbacks "Failed to claim invitation"). Sound.

#### Registry 2 (Journey Completion)
| Journey | Status |
|---|---|
| invite-accept (validate→claim→redirect) | COMPLETE |
| join (browse→org page→apply) | COMPLETE |

No non-PASS Registry 5/9. Invite claim error interpolated → PASS.

---

### pay

`pay/$token.tsx` — HIGH-RISK area ("Could not start payment setup" history). Reviewed carefully.
Validate token via `useQuery`. `handlePay` (L42): POST `/api/pay/{token}/checkout`; if `result.checkoutUrl` → `window.location.href`; else `setPayError(result.error || 'Failed to start payment')`; catch → `setPayError('Network error. Please try again.')`. Combined `error` (L40) merges payError + fetchError + invalid-token (`data.error`). Error branch (L74) renders "Payment Link Invalid" + interpolated `{error}`. already_paid branch present. Pay button disabled while paying.
The legacy "Could not start payment setup" failure path IS handled: server `result.error` is surfaced verbatim. No silent failure, no dead button.

#### Registry 9
| ID | Sev | File:Line | Issue |
|---|---|---|---|
| J-PAY-001 | P3 | pay/$token.tsx:50 | Fallback `'Failed to start payment'` static, only when server returns no `result.error`. Primary path interpolates server error → effectively PASS. P3 polish. |

Pay mutation has onError equivalent (try/catch + setPayError) → Registry 9 PASS (no J-ERROR-MISSING).

---

### verify

All four verify routes use `useQuery` + render explicit error/not-found branches.
- `verify/$certificateNumber.tsx`: not-found branch interpolates `{certificateNumber}`. Print button `window.print()`.
- `verify/$credentialNumber.tsx`: `error || !data` branch. Print button.
- `verify/$token.tsx`: queryFn catches ApiError, returns `error` from `body.error`, fallback "Unable to verify. Please try again." Renders interpolated `{error}`.
- `verify-email.tsx`: guarded `composeGuards(requireAuth, requireNotEmailVerified)`. `handleResendVerification` try/catch → `toast.success` / `toast.error('Failed to send verification email', {description: err.message ?? fallback})` interpolated. `handleSignOut` via authClient.

#### Registry 9
| ID | Sev | File:Line | Issue |
|---|---|---|---|
| J-VER-001 | P3 | verify/$token.tsx:30 | catch fallback "Unable to verify. Please try again." static — only when error has no `body.error`. Server error interpolated on primary path. P3. |

verify-email resend interpolated → PASS.

---

### onboarding

`onboarding.tsx`: guarded `composeGuards(requireAuth, requireEmailVerified, requireNoPerson)` — only authed+verified+no-person users land here. 2-step wizard. `createPersonMutation` with `meta.toast` { success:'Profile created!', error: err.message ?? 'Failed to create profile' } — interpolated. On success refetch person + `navigate('/dashboard')`. Step 1 personal-info onSubmit advances; Step 2 address has `handleSkipAddress` ("Skip for now" → still creates person, navigates) and submit. Back button (`goBack`). No dead buttons; skip path complete.
`data-export.tsx` (privacy export): `handleRequestExport` — rate-limit toast (interpolated hours), POST `/api/persons/me/export`, blob download, success toast (interpolated category count), catch → `toast.error('Export failed', {description:'Please try again later.'})`.

#### Registry 9
| ID | Sev | File:Line | Issue |
|---|---|---|---|
| J-ONB-001 | P2 | data-export.tsx:97 | Export catch: `toast.error('Export failed', {description:'Please try again later.'})` — no `err` interpolation. J-ERROR-GENERIC. Export can fail for distinct reasons (server, rate, size); user gets no actionable detail. |

onboarding createPerson error interpolated → PASS.

---

### Findings summary

| ID | Sev | Module | File:Line | Issue | Fix |
|---|---|---|---|---|---|
| J-ONB-001 | P2 | onboarding | data-export.tsx:97 | Generic export-fail toast, no error interpolation | Surface `err.message`/`body.error` in description |
| J-DISC-001 | P3 | discover | discover/events.tsx:115 | Static "Something went wrong" EmptyState (read-only list) | Optional: interpolate query error |
| J-ORG-001 | P3 | org | org/$slug.tsx:126 | Non-ApiError catch-all generic toast (primary path interpolated) | Optional: log/interpolate |
| J-PAY-001 | P3 | pay | pay/$token.tsx:50 | Static fallback when server returns no error | Optional polish |
| J-VER-001 | P3 | verify | verify/$token.tsx:30 | Static catch fallback (server error interpolated on primary) | Optional polish |

### Counts
- P0: 0
- P1: 0
- P2: 1
- P3: 4

No DEAD_API_CALL, no NOOP_BUTTON, no ORPHAN_FORM, no MISSING_ROUTE, no J-ERROR-MISSING. Auth guard PASS. All entry journeys (auth, onboarding, invite-accept, public-pay, verify) COMPLETE.
