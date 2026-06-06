# UI-ONBOARDING — First 5 Minutes Audit

**Scope:** `apps/memberry`. Read-only trace of the new-user (member) + invited-officer paths from arrival to first meaningful action.
**Date:** 2026-06-02
**Methodology:** Static read of route files, guards, forms, email templates, dashboard, and invite/join flows. No live simulation.

Files referenced (absolute paths):

- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/index.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/auth/$authView.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/verify-email.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/onboarding.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/join.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/invite/$token.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/_authenticated.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/_authenticated/dashboard.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/_authenticated/my/profile.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/_authenticated/my/organizations.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/_authenticated/org/$orgSlug/officer.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/_authenticated/org/$orgSlug/home.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/routes/events/$eventSlug.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/features/person/components/personal-info-form.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/features/person/components/address-form.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/features/person/schemas.ts`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/features/dashboard/components/quick-actions.tsx`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/utils/guards.ts`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/hooks/useMyOrgs.ts`
- `/Users/elad-mini/Desktop/memberry/apps/memberry/src/components/layout/member-bottom-nav.tsx`
- `/Users/elad-mini/Desktop/memberry/services/api-ts/src/handlers/email/templates/auth/welcome.html.hbs`
- `/Users/elad-mini/Desktop/memberry/services/api-ts/src/handlers/email/templates/auth/email-verify.html.hbs`

---

## 1. FLOW DIAGRAM

### 1.1 Member persona — cold-start (org search path)

```
[ Anyone hits / ]
        |
        v
+----------------------------+
| `/` redirect (index.tsx)   |
|  if !user -> /auth/sign-in |
|  if user  -> /dashboard    |
+----------------------------+
        |
        v
+--------------------------------------+
| /auth/sign-up  (auth/$authView.tsx)  |
|  Powered by                          |
|  @daveyplate/better-auth-ui AuthView |
|  Header: "Create an account"         |
|  Fields: name, email, password       |
|  (vendor component — Memberry        |
|   provides ONLY title + subtitle)    |
+--------------------------------------+
        |
        | submit -> Better-Auth creates user
        v
+----------------------------------------+
| Guard chain:                           |
|  requireAuth          -> ok            |
|  requireEmailVerified -> FAIL          |
+----------------------------------------+
        |
        v
+----------------------------------------+
| /verify-email                          |
|  "We've sent a verification link to    |
|   {email}"                             |
|  Buttons: [Resend] [Sign out]          |
|  Spam-folder tip block                 |
|  No live polling — user must click     |
|  email link, link goes to              |
|  callbackURL=window.origin + /dashboard|
+----------------------------------------+
        |
        | clicks link in inbox
        v
+----------------------------------------+
| /dashboard  (better-auth handles       |
|  emailVerified=true)                   |
|  Guard chain:                          |
|   requireAuth -> ok                    |
|   (NO requirePerson guard on           |
|   /dashboard — only profile pages      |
|   gate on person)                      |
+----------------------------------------+
        |
        | dashboard quietly calls /persons/me
        | no person -> 404 -> person.data = null
        v
+----------------------------------------+
| Dashboard renders WITHOUT person:      |
|  greeting "Good morning, there"        |
|  (falls back to user.name.split[0]     |
|   or literally "there")                |
|  Onboarding-prompt link IS NOT shown   |
|  (gated on `person.data && !person.    |
|   data.specialization`)                |
|  Memberships query also returns empty  |
|  -> "No memberships yet — Join an      |
|   organization to get started"         |
|   [Find Organizations]                 |
+----------------------------------------+
        |
        |  ⚠ User is on /dashboard with NO person row,
        |    yet nothing forces them to /onboarding.
        |    /onboarding is only reachable manually
        |    (no menu entry; no CTA on dashboard for
        |    "no-person" state — only "no-memberships").
        v
+--------------------------+   +----------------------+
| Click "Find Orgs"        |   | User clicks Profile  |
|  -> /my/organizations    |   |  -> EmptyState       |
+--------------------------+   |   "No profile found  |
                               |    Complete onboard- |
                               |    ing to create..." |
                               |  (text only, no CTA  |
                               |   button to onboard) |
                               +----------------------+
                                       |
        +------------------------------+
        |
        v
+----------------------------------------+
| /onboarding (manually navigated)       |
|  Guard chain: requireAuth +            |
|   requireEmailVerified + requireNoPers |
|  Two-step wizard:                      |
|   Step 1: Personal Information         |
|     - firstName *                      |
|     - middleName                       |
|     - lastName *                       |
|     - dateOfBirth *  (Calendar picker) |
|     - gender (dropdown)                |
|     - licenseNumber                    |
|     - specialization                   |
|     - prcId                            |
|     - avatar upload (optional)         |
|     => 8 visible fields, 3 required    |
|        (firstName, lastName, dob)      |
|   Step 2: Address (Optional)           |
|     - street1, street2, city, state,   |
|       postalCode, country (combobox)   |
|     - [Skip for now]   [Complete]      |
+----------------------------------------+
        |
        v
+----------------------------------------+
| createPerson mutation succeeds         |
|  toast: "Profile created!"             |
|  navigate -> /dashboard                |
|  (router.invalidate forces guard       |
|   re-eval; person now in ctx)          |
+----------------------------------------+
        |
        v
+----------------------------------------+
| /dashboard — second visit              |
|  greeting "Good morning, {firstName}"  |
|  ⚠ Still no memberships -> same        |
|    "No memberships yet" EmptyState     |
|  Onboarding-prompt link DOES appear    |
|   (because specialization is empty —   |
|    if user filled it in step 1 the     |
|    prompt is suppressed)               |
|  QuickActions: Pay Dues / Payments,    |
|   IdCard, Award, Calendar, User,       |
|   BookOpen — most route to /my/* or    |
|   a "no-org" fallback                  |
+----------------------------------------+
        |
        | clicks "Find Organizations"
        v
+----------------------------------------+
| /my/organizations                      |
|  (or /join — both exist)               |
|  /join (PUBLIC route, not gated):      |
|   "Find Your Organization"             |
|   Search input + org cards (badge,     |
|    region, memberCount)                |
|   Click card -> /org/{slug}            |
|  /org/{slug} = public org landing      |
+----------------------------------------+
        |
        v
+----------------------------------------+
| /org/{slug} — public org page          |
|  Member must use the public-facing     |
|  flow (membership application — out    |
|  of scope of this audit). No clear     |
|  in-app "join this org" button beyond  |
|  what the org page renders.            |
+----------------------------------------+
        |
        | (eventually) joined via invite, mem-app,
        | or officer-side add-member action
        v
+----------------------------------------+
| FIRST MEANINGFUL ACTION                |
|  - Land in /dashboard with at least 1  |
|    org card; QuickActions now route to |
|    that org. No tour, no checklist, no |
|    "what's next" copy.                 |
+----------------------------------------+
```

### 1.2 Member persona — warm-start (invite-link path, expected mainline)

```
[ Email from officer with invite link ]
        |
        v
+----------------------------------------+
| /invite/{token}                        |
|  validateInviteToken() -> previews:    |
|   - org name (badge / surface-warm)    |
|   - name, email, memberNumber          |
|  If !authenticated:                    |
|   [Sign in to accept invitation]       |
|   -> /auth/sign-in?redirect=/invite/.. |
|  If authenticated:                     |
|   [Accept Invitation]                  |
|   claimInviteToken() ->                |
|     if orgSlug:                        |
|       /org/{slug}/home                 |
|     else:                              |
|       /my/organizations                |
+----------------------------------------+
        |
        |  ⚠ The /invite page does NOT call /onboarding
        |    before accepting. If the user has never
        |    set up a person row, the claim succeeds
        |    (or fails on the server) but the org-home
        |    page they land on will re-trigger
        |    requirePerson via deeper routes — first
        |    nav to e.g. /my/credits will yo-yo them
        |    to /onboarding.
        v
+----------------------------------------+
| /org/{slug}/home (OrgHome)             |
|  - Recent Announcements (empty: "No    |
|     announcements yet")                |
|  - Upcoming Events (empty: "No         |
|     upcoming events — Check back       |
|     soon!")                            |
|  - No personalized "welcome to {org}", |
|    no member-number callout, no       |
|    payment prompt, no profile prompt. |
+----------------------------------------+
```

### 1.3 Officer persona

```
[ Existing officer signs in, OR ]
[ New officer claims invite token with role=officer ]
        |
        v
+----------------------------------------+
| Auth flow: identical to member         |
| (sign-up / sign-in / verify-email)     |
| then /dashboard                        |
+----------------------------------------+
        |
        | manually navigates to /org/{slug}/officer
        | (or clicks "Officer" link in nav, if their
        |  org-icon-rail shows the org)
        v
+----------------------------------------+
| /org/{slug}/officer (OfficerLayout)    |
|  Guard: requireOrgOfficer              |
|   - validates officer positions array  |
|   - 403 / redirect if not an officer   |
|  Layout:                               |
|   OfficerSidebar (left rail, role      |
|    label = positions[0].title)         |
|   OfficerMobileNav (slide-out)         |
|   Outlet for nested officer routes     |
|  Title: "{page} -- Officer | Memberry" |
+----------------------------------------+
        |
        v
+----------------------------------------+
| Officer first landing page             |
|  Today the officer layout DOES NOT     |
|  redirect to a curated "officer        |
|  dashboard" — they land on whatever    |
|  URL they typed. If they navigated     |
|  via icon-rail, they hit /org/{slug}/  |
|  home (the MEMBER-facing home), not    |
|  an officer home, because there is no  |
|  index route at /org/{slug}/officer.   |
+----------------------------------------+
```

---

## 2. TIME-TO-VALUE

Time-to-value (TTV) = **arrival -> first meaningful action**. "Meaningful" defined per persona below. Estimates are best-case using a clean inbox and zero retries.

### 2.1 Member persona

| Step                                           | Time (best-case) | Notes |
|------------------------------------------------|------------------|-------|
| Hit `/`, redirect to sign-up                   | 1 s              | instant redirect |
| Fill sign-up form (name + email + password)    | 30–45 s          | vendor `AuthView`, 3 fields, password rule check |
| Wait for verify email to arrive                | 30–120 s         | external dependency; user must alt-tab to mail |
| Click verification link                        | 5 s              | -> /dashboard with verified flag |
| Land on `/dashboard` (empty, no person)        | 3 s              | greeting reads "Good morning, there" |
| Realize need to onboard, navigate to /onboarding | 30–90 s        | **friction:** no CTA points to /onboarding from a no-person dashboard |
| Fill onboarding step 1 (3 required, 5 optional)| 60–90 s          | DOB calendar picker is slow on mobile |
| Skip address (step 2)                          | 3 s              | "Skip for now" works |
| Land on `/dashboard` post-onboarding (empty)   | 2 s              | Still no orgs |
| Click "Find Organizations", browse `/join`     | 30–60 s          | search + tap card |
| Land on `/org/{slug}` public landing           | 5 s              | no clear "join this org" button in-app — depends on org config |
| Apply for membership / wait for officer accept | hours–days       | **not bounded by UI** |

**Member time-to-value (cold-start): ~3–6 minutes of *active* UI time, BUT membership approval is async (officer-mediated). Pure "ready-to-do-something" first meaningful action only exists once they have at least one membership row, which is hours/days later.**

**Member time-to-value (invite-link warm-start): ~90 seconds.** Click email link -> sign-up (or sign-in) -> accept -> /org/{slug}/home. This is the happy path the product should design around; today the cold path is the default and is significantly slower.

### 2.2 Officer persona

| Step                                                | Time (best-case) |
|-----------------------------------------------------|------------------|
| Sign-up + verify (same as member)                   | 90 s             |
| Land on `/dashboard`, realize officer URL is hidden | 60–120 s         |
| Find org icon rail / org link, click into org       | 30 s             |
| Click "Officer" entry (sidebar)                     | 5 s              |
| Land on officer layout (no index page)              | 30 s — disoriented |
| Manually click "Members" / "Compliance" / etc.      | 60 s             |

**Officer time-to-value: ~5–8 minutes** if the org already has the officer position assigned. **No officer-side guided tour exists**, no checklist, no "what to do first" copy. The officer sidebar is the only navigation hint.

---

## 3. FRICTION POINTS (ranked by impact × frequency)

### F1 — No "you must onboard" gate on /dashboard (CRITICAL)
**Where:** `routes/_authenticated.tsx`, `routes/_authenticated/dashboard.tsx`, `utils/guards.ts`
**Symptom:** A freshly-verified user with no `person` row can fully render `/dashboard`. Greeting falls back to "Good morning, there" (`displayName` uses `user.name.split(' ')[0]` only if `user.name` is set; many sign-up flows leave it null). User sees only:
- "No memberships yet — Join an organization to get started"

But nothing tells them they have no profile, and nothing pushes them to `/onboarding`. The dashboard's "Complete your profile" link only renders when `person.data && !person.data.specialization` — so a totally absent person row shows **no** profile prompt at all.
**Why it fails:** Identity-state confusion. User thinks the app is broken or doesn't know which way to go.
**Fix shape:** Add `requirePerson` (or a softer `redirectToOnboardingIfNoPerson`) to either `_authenticated` shell or `/dashboard` specifically. Alternative: always render an unmissable "Set up your profile first" card when `person.data == null`, with primary CTA -> /onboarding.

### F2 — Verify-email screen has no polling / no auto-advance (HIGH)
**Where:** `routes/verify-email.tsx`
**Symptom:** Page is a static "check your inbox" with a "Resend" button. There is no `useQuery` polling the session for `emailVerified`. If the user clicks the email link in a different tab/browser, this tab stays stuck on /verify-email until they reload.
**Why it fails:** Modern users expect the page to detect verification and advance automatically. Today the tab is silent.
**Fix shape:** Add `useQuery` (15s interval) polling `authClient.getSession()`. When `emailVerified === true`, navigate to `/onboarding` (or callbackURL).

### F3 — Welcome + verify emails are Monobase-branded, not Memberry (HIGH — trust)
**Where:** `services/api-ts/src/handlers/email/templates/auth/welcome.html.hbs`, `email-verify.html.hbs`
**Evidence:** Welcome template literally says "Welcome to Monobase", "Your journey starts here", `<h1>🏥 Welcome to Monobase</h1>`, `<strong>Monobase</strong>`. Verify template says "Thank you for joining Monobase Platform!" and "© 2024 Monobase Platform. All rights reserved."
**Why it fails:** First emails the user gets are from a brand they don't recognize. Spam triggers, trust drops, completion rate suffers. Year string is 2024 (stale).
**Fix shape:** Replace Monobase strings with Memberry. Update copyright year. Use organization name where available (`Welcome to {{associationName}}`). Drop the `🏥` emoji from the H1.

### F4 — `/onboarding` has 8 visible fields on step 1; only 3 required (MEDIUM)
**Where:** `features/person/components/personal-info-form.tsx`
**Fields:** firstName*, middleName, lastName*, dateOfBirth*, gender, licenseNumber, specialization, prcId, avatar upload.
**Why it fails:** Cognitive load is high for what should be a low-commitment first impression. licenseNumber + prcId + specialization are profession-specific and many members won't have them at hand on first login (the PRC ID is a Philippine professional ID; non-PH users will be confused).
**Fix shape:** Collapse non-required fields under "Add professional details (optional)" disclosure. Move avatar upload to step 2 or after-onboarding. Conditionally show prcId only when country=PH.

### F5 — DOB is required for onboarding (MEDIUM)
**Where:** `features/person/schemas.ts` (`personalInfoSchema.dateOfBirth: z.date({...})`).
**Why it fails:** DOB is sensitive PII demanded *before* the user has joined any org or seen any value. Many members will bounce here. There is no privacy/why-we-ask copy next to the field.
**Fix shape:** Either (a) move DOB to "complete your profile later" step or (b) keep it but add inline copy "Used for member-discount eligibility (e.g., senior rates). Never displayed publicly." DOB range is 0–150 years, which is fine, but error UX needs "valid date" guidance.

### F6 — Step indicator says "Step 1 of 2" but the dashboard then asks for *more* (MEDIUM)
**Where:** `routes/onboarding.tsx` shows `Progress value={(currentStep/2)*100}` reaching 100% on completion. Dashboard immediately shows "Complete your profile — Add your specialization and preferences" if `!person.data.specialization`.
**Why it fails:** Implied promise broken. User feels they did the work and the app is moving the goalposts.
**Fix shape:** Either drop the dashboard prompt entirely (rely on /my/profile to capture the extra fields) or make `specialization` required in step 1 — pick one.

### F7 — `/invite/{token}` does not surface a useful next step on success (MEDIUM)
**Where:** `routes/invite/$token.tsx` claim handler -> `navigate({ to: '/org/$orgSlug/home' })` or `/my/organizations`.
**Symptom:** No success toast, no "Welcome to {orgName}" interstitial. The org home is empty in most fresh tenants ("No announcements yet", "No upcoming events"). User sees an empty page after the most positive moment.
**Fix shape:** After successful claim, show a one-time celebration card on /org/{slug}/home: "You're in! Member #{n}. Here's what to do next: [Set up profile] [Pay dues] [Browse events]".

### F8 — Profile EmptyState has no CTA (LOW–MEDIUM)
**Where:** `routes/_authenticated/my/profile.tsx`
**Code:** `EmptyState headline="No profile found" description="Complete onboarding to create your professional profile."` — no `action` prop, so the empty state is text-only. User cannot click anything to reach /onboarding.
**Fix shape:** Add `action={{ label: 'Set up profile', onClick: () => navigate({ to: '/onboarding' }) }}`.

### F9 — Officer layout has no index route (MEDIUM)
**Where:** `routes/_authenticated/org/$orgSlug/officer.tsx` is a layout-only route (Outlet). Visiting `/org/{slug}/officer` directly will render nothing or fall through to the not-found in the layout's parent.
**Symptom:** A first-time officer who clicks an "Officer" link arrives at a blank page.
**Fix shape:** Add an officer index route with a curated landing (members count, pending applications, recent payments, recent announcements to send, "Things you can do here").

### F10 — Public `/discover/events` exists but cold-start `/` never points to it (LOW)
**Where:** `routes/index.tsx` always redirects to sign-in. `/discover/events` is unauthenticated but unreachable for an anonymous landing.
**Why it fails:** Highest-converting top-of-funnel page (public events) is buried. Curious visitors hit a login wall.
**Fix shape:** Anonymous `/` should show a tiny public landing — value prop + "Browse public events" link + sign-in / join CTA — before bouncing to /auth/sign-in.

### F11 — Sign-up form is fully vendor (`@daveyplate/better-auth-ui`) (LOW)
**Where:** `routes/auth/$authView.tsx` -> `<AuthView pathname={authView} callbackURL={callbackURL} />`.
**Symptom:** Memberry only controls the title+subtitle text wrapping the vendor component. No custom marketing copy, no "Member of an org? Use the invite link" hint, no trust badges. Field count and validation rules are whatever the vendor defaults are.
**Fix shape:** Either (a) wrap with a side panel explaining what to expect or (b) replace with a hand-rolled form once stack matures so Memberry owns the friction surface.

### F12 — Mobile keyboard / DOB picker UX not validated (LOW)
**Where:** `personal-info-form.tsx` uses a Popover Calendar for DOB. On mobile this is slow; the calendar opens, then user must paginate decades to reach (say) 1985.
**Fix shape:** Use a native date input on mobile (`<input type="date">`) or a triple-select (year/month/day). Adds tap-targets ≥44px.

---

## 4. MISSING MILESTONES (celebration moments)

There are essentially **zero** explicit milestone celebrations in the codebase. Every transition relies on a single `toast.success(...)`. Specifically:

| Milestone                          | Current handling                                    | Should be |
|------------------------------------|------------------------------------------------------|-----------|
| Email verified                     | silent — only resolves the guard chain               | Toast or interstitial "Email verified" -> "Set up profile" CTA |
| Profile created (onboarding done)  | `toast: 'Profile created!'` -> /dashboard            | Confetti / animated check + "Next: join your association" |
| Invite accepted                    | navigate to /org/{slug}/home, no copy                | Celebration banner with org name + member number |
| First payment made                 | toast in dues flow only                              | Receipt screen with "You're paid up through {date}" |
| First credit logged                | no UI fanfare                                        | "1 credit logged — {n} more to compliance" progress |
| First RSVP                         | no fanfare                                           | "You're registered for {event}" |
| Profile completion (specialization)| dashboard prompt disappears silently                 | Toast: "Profile complete!" |
| Officer position assumed           | nothing                                              | Welcome-as-officer interstitial |

The "Complete your profile" link on dashboard (`UserPlus` icon + small card) is currently the only weak "nudge" toward a milestone — and it disappears the moment `specialization` is filled, with no acknowledgment.

---

## 5. EMPTY-DASHBOARD AUDIT

State observed for a verified user with `person == null` AND `memberships == []`:

1. **PageHeader greeting** — `Good morning, there` (`displayName` falls back to literal `'there'` when `person.data?.firstName` is null and `user?.name?.split(' ')[0]` is null).
2. **AlertBanner** — driven by memberships + invoices + elections. With all empty, banner is silent. No alternative "welcome / get started" mode.
3. **Onboarding-prompt link** — **does NOT render** because the condition is `person.data && !person.data.specialization`. With no person row, the prompt is hidden. (Inverse bug: people *least* set up get *least* guidance.)
4. **Your Organizations section** — `EmptyState` with `headline="No memberships yet"`, `description="Join an organization to get started"`, `action.label="Find Organizations"` -> `/my/organizations`. This is the **only** call to action on the empty dashboard.
5. **Action Widgets (3-up grid: Dues, CPD, Membership)** — render anyway, with all values undefined. ActionWidget likely shows error-message text (`'Unable to load credit data'`, `'Unable to load dues status'`) because the per-org queries 404. This is **anti-trust**: looks broken on first impression.
6. **QuickActions** — renders 6 fixed buttons (Pay Dues, ID Card, Credits, Events, Profile, Resources). Each routes to `/my/*` or an org route. With no org, half of them point to `/my/payments`, `/my/credits`, etc. — all of which will themselves be empty.
7. **Announcements (per-org)** — query is disabled when `firstOrgId` is undefined; section is hidden gracefully.

**Verdict:** The empty dashboard is *less* useful than a dedicated "welcome" screen would be. A first-time, no-person, no-org user is presented with broken widgets, no profile prompt, and one single CTA buried under the org section.

---

## 6. TRUST-BUILDING AUDIT

Trust signals are sparse:

| Area              | Current                                                | Trust gap |
|-------------------|--------------------------------------------------------|-----------|
| Sign-up           | Vendor component, no privacy copy or data-handling note | No "We never share your data" line; no security badge; no "Why we ask" tooltips on email/password |
| Verify-email      | Generic copy. Spam-folder bullet list is good          | No estimated time ("usually arrives in 30 s"). No support email |
| Welcome email     | Branded "Monobase", year 2024, generic `🏥 Welcome`     | Brand mismatch destroys trust immediately |
| Verify-email body | Branded "Monobase Platform"                            | Same brand mismatch |
| Onboarding form   | No privacy copy near DOB, license, PRC ID fields       | High-PII fields with zero "why" or "who sees this" copy |
| Address (optional)| Marked optional, good — skip button works              | No privacy copy; defaults to detected country (privacy-positive if signposted, opaque if not) |
| Org public page   | n/a (not audited deeply)                               | Member-count visible (good social proof) |
| Officer area      | "Officer | Memberry" page title (good signal)          | No role-explainer for newly-promoted officers |

**The biggest single trust hit is F3 (Monobase emails)**. Until those templates are rebranded to Memberry, every new user is told by email that they signed up for the wrong product.

---

## 7. TOP 10 ONBOARDING FIXES (ranked by ROI)

1. **Rebrand welcome.html.hbs + email-verify.html.hbs from Monobase -> Memberry.** Fix copyright year. Trivial template edits; immediate trust win for every new sign-up.
2. **Force `/onboarding` for users with no person row.** Add a `requirePersonOrRedirectToOnboarding` guard on `_authenticated` or on `/dashboard`. Eliminates the empty-dashboard maze.
3. **Poll session on `/verify-email` and auto-advance.** 15-second interval, navigate to `/onboarding` when `emailVerified` flips. Removes the "stuck-on-verify-email" tab problem.
4. **Add a CTA button to the profile EmptyState.** One-line fix: `action={{ label: 'Set up profile', onClick: () => navigate({ to: '/onboarding' }) }}`.
5. **Add success interstitial on `/invite/{token}` claim.** Show "You're in, {orgName}!" with member number, then route to org home. Highest-emotional moment; currently silent.
6. **Reduce onboarding step 1 to 4 fields visible.** firstName, lastName, dateOfBirth (or move DOB to step 2), specialization (only if it's truly required for the dashboard prompt to disappear). Hide license/PRC/avatar behind "Add professional details (optional)".
7. **Build an officer index route at `/org/{slug}/officer`.** Curated landing with pending applications, recent payments, recent unread messages, and a "first-officer checklist" if no announcements have been sent yet.
8. **Add a public landing at `/` for anonymous users.** Brief value prop + "Browse public events" + "Sign up / Sign in". Replaces the hard redirect to sign-in.
9. **Add inline "why we ask" copy next to DOB and PRC ID.** One-line subtext under each high-PII field.
10. **Replace empty-state ActionWidgets with a single "Get started" panel** when memberships + person are both absent. Today the broken-looking widgets harm trust on the first dashboard visit.

---

## 8. PROPOSED OPTIMAL FLOW

A 5-step ideal onboarding (cold-start, no invite token):

```
[Step 1] /  (anonymous landing)
   value prop + "Browse public events" + [Sign up] [Sign in]
   (replaces the silent redirect to /auth/sign-in)

[Step 2] /auth/sign-up
   3 fields: name, email, password
   privacy bullet + "Already invited? Use the link in your email"

[Step 3] /verify-email
   "We sent a link to {email}. Usually arrives in 30 s."
   [Resend] [Use a different email]
   Polls session every 15 s -> auto-advance when verified
   Email body Memberry-branded, year correct

[Step 4] /onboarding  (one screen — not two)
   firstName *, lastName *, specialization * (defines the persona)
   Optional disclosure: "Add license, PRC, address now"
   "Skip and finish later" link bottom-right (saves a partial person row)

[Step 5] /dashboard  (first meaningful state)
   Greeting "Good morning, {firstName}"
   Top card: "Welcome to Memberry — pick an organization to get started"
     -> primary CTA browses /join, secondary CTA "Have an invite link?"
   QuickActions hidden until at least one org is joined (or shown grayed
   with explicit "Join an org to unlock" copy — no broken widgets)

   When the user joins an org (via invite or membership application acceptance):
     Celebration banner on /org/{slug}/home -> "You're in, {orgName}"
     Member number + 3 next-step buttons:
       [Pay dues] [Browse events] [Complete profile]
```

For invite-link warm-start, the optimal flow is:

```
/invite/{token}  -> sign-up (3 fields, prefilled email) -> verify-email
   (polls, auto-advance) -> 1-screen onboarding (name + specialization)
   -> claim invite -> /org/{slug}/home with celebration banner.
   Total wall time target: under 2 minutes.
```

---

## Appendix — Field counts and required-vs-optional summary

**Sign-up (vendor)** — name, email, password (3 fields, all required).

**Onboarding step 1 (PersonalInfoForm)** — 8 visible inputs + avatar:
- firstName (required, max 50)
- middleName (optional, max 50)
- lastName (required, max 50)
- dateOfBirth (required, range 0–150 yrs)
- gender (optional: male / female / non-binary / other / prefer-not-to-say)
- licenseNumber (optional)
- specialization (optional)
- prcId (optional, PH-specific)
- avatar upload (optional)

**Onboarding step 2 (AddressForm, optional)** — 6 inputs (street1, street2, city, state, postalCode, country). Skippable. Country defaults via `detectCountry()`.

**Profile-edit form (`/my/profile` edit mode)** — superset including bio (max 2000), phone, timezone, language, full address block.

**Member bottom nav (mobile, no orgSlug)** — Home / Events / Credits / Profile. Bottom nav switches to org-context nav once `useParams.orgSlug` is present.
