---
oli-version: "1.0"
based-on: [apps/memberry/src/**, apps/admin/src/**, packages/ui/src/**, apps/memberry/tailwind.config.ts, apps/admin/tailwind.config.ts, apps/memberry/src/styles/globals.css, apps/admin/src/styles/globals.css]
last-modified: 2026-06-02T11:27:29Z
last-modified-by: ai-slop-auditor
---

# UI Slop Audit — Memberry

## 1. VERDICT

**SLOP SCORE: 3/10** (lower is better)

The memberry app is mostly intentional — custom mauve/cream palette, DM Sans + Plus Jakarta Sans, custom radii (8/12/18), illustrated brand asset, glass surface tokens — but it is dragged down by (a) the admin app shipping with **default shadcn neutral-gray + purple-270 sidebar tokens**, (b) two public-facing verify pages (`/verify/$credentialNumber`, `/verify/$certificateNumber`) using the textbook **icon-in-colored-circle status pattern** with raw Tailwind `bg-green-100 / bg-red-100`, and (c) scattered `bg-purple-100` category badges in dues / surveys / elections that ignore the design tokens.

## 2. PASS / FAIL PER SLOP PATTERN

| # | Pattern | Verdict | Worst Offender |
|---|---|---|---|
| 1 | Purple/violet/indigo as primary brand | PASS (memberry) / FAIL (admin) | `apps/admin/src/styles/globals.css:30` `--sidebar-primary: 270 60% 65%;` (raw violet) and `apps/admin/src/routes/__root.tsx:153` `bg-purple-500` logo tile. Memberry primary `#554B68` is mauve-grey, intentional. |
| 2 | 3-col feature grid with icon-circle + title + 2-line description | PASS | No marketing-style 3-feature grid exists. The closest case (`survey-templates.tsx:123`) uses 5x5 icons, no circle, left-aligned, functional copy. Officer dashboard `ModuleSummaryCard` uses small status dot, not circle icon. |
| 3 | Icons in decorative colored circles | FAIL (public verify pages) | `apps/memberry/src/routes/verify/$credentialNumber.tsx:103-119` — three `h-20 w-20 rounded-full bg-green-100/bg-yellow-100/bg-red-100` blocks wrapping raw inline SVGs. Same in `verify/$certificateNumber.tsx:65,71`. Six total instances across the two verify pages. |
| 4 | Center-aligned stacked content blocks | PARTIAL FAIL | `text-center` appears 219 times. Most are legitimate (empty states, page-titles, status confirmations). But `/onboarding.tsx:226-232` stacks logo + h1 + h2 + p all centered, and the verify pages center-align the entire card body (icon → badge → name → details → footer) — pure marketing rhythm on a transactional page. |
| 5 | Uniform large border-radius (rounded-2xl/3xl) | PASS | Zero occurrences of `rounded-2xl` or `rounded-3xl` in the entire codebase. Tailwind config caps `lg: 18px`. Intentional. |
| 6 | Decorative blobs / wavy SVG dividers | PASS | Zero `blur-3xl rounded-full absolute`, zero `viewBox="0 0 1440`, zero floating blobs. The body has tasteful radial gradients in `globals.css:228-232` instead of blobs — restrained. |
| 7 | Emoji as design elements | MOSTLY PASS | Two micro-instances: `verify/$token.tsx:55,67` (`❌`, `✓` as 4xl glyphs replacing icons — should be lucide icons) and `pay/$token.tsx:89` (`✅`). Inline check-glyphs in `officer/finances/members/$memberId.tsx:145` (`✓` / `○` for paid status — utility, acceptable). `message-reactions.tsx:5` quick-reactions array is a user-facing reaction picker, not design decoration. |
| 8 | Colored left-border on cards | PASS (intentional usage) | `border-l-[3px]` is used as nav-active-state in `member-sidebar.tsx`, `officer-sidebar.tsx`, `officer-mobile-nav.tsx`, and for unread notification rows (`notification-inbox.tsx:201`, `member-dashboard.tsx:204`). Single semantic purpose, primary token, not generic SaaS slop. |
| 9 | Generic hero copy ("Welcome to X", "Unlock the power…") | FAIL (minor) | "Welcome to Memberry" in `routes/onboarding.tsx:230` and `routes/invite/$token.tsx:107`; `officer-dashboard.tsx:149` zero-state subtitle "Welcome to your association dashboard". No "Unlock the power", no "all-in-one solution", no "Take control of your" — only the mild "Welcome to" cliché. |
| 10 | Cookie-cutter section rhythm (hero → 3 features → testimonials → pricing → CTA) | PASS | There is no public marketing page at all. `routes/index.tsx` is a pure redirect (`/dashboard` or `/auth/sign-in`). `/join` is a search-driven org directory. The app deliberately ships zero landing-page surface. |
| 11 | `system-ui` / `-apple-system` as primary display font | PASS | Memberry: `font-display: 'DM Sans Variable'`, `font-body: 'Plus Jakarta Sans Variable'` — intentional pick, variable axes imported via `@fontsource-variable/*`. Admin: no font family override (falls back to browser default) — **FAIL for admin** but the admin is internal ops only. |
| 12 | Default font stacks (Inter/Roboto/Arial) | PASS (memberry) / FAIL (admin) | Memberry: DM Sans + Plus Jakarta Sans + JetBrains Mono — none of the AI-default trio. Admin: `tailwind.config.ts` has no `fontFamily`; `globals.css` ships only shadcn HSL tokens. Inherits browser default sans-serif. |
| 13 | Stock-photo feel / unsplash/pexels URLs | PASS | Zero unsplash/pexels references. `apps/memberry/public/memberry-bg.png` is a custom illustrated mauve landscape on-brand with the palette. Used as ambient background at `officer.tsx:79` with `opacity-30`. Logo PNGs are custom. |
| 14 | Generic SaaS card-grid as first impression | PASS | First impression is the auth sign-in screen (Better-Auth UI) → onboarding form → dashboard. No "feature card grid welcome page" surface. |
| 15 | Beautiful image with weak brand | PASS | Brand presence in every viewport: `memberry-logo.png` / `memberry-logo-white.png` in member-sidebar, member-header, officer-sidebar, officer-mobile-nav. |

**Summary: 9 PASS, 1 partial fail, 3 clear fails (#1 admin, #3 verify pages, #9 generic welcome copy), 1 minor fail (#7 emoji glyphs on verify/pay tokens), 1 split (#11/12 admin lacks typography intent).**

## 3. TOP 10 SLOP HOTSPOTS (ranked, worst first)

1. **Admin app sidebar token + purple-500 logo** — `apps/admin/src/styles/globals.css:30`, `apps/admin/src/routes/__root.tsx:153`. The cliché violet rail. Quick fix: align admin tokens to memberry's `--color-primary` family; replace `bg-purple-500` with `bg-[var(--color-primary)]`.
2. **Verify credential page colored-circle status icons** — `apps/memberry/src/routes/verify/$credentialNumber.tsx:103-120`, three `rounded-full bg-{green|yellow|red}-100` decorative blocks with inline SVGs. This is the iconic AI slop pattern shipped on a *public-facing* trust surface. Quick fix: swap to a single lucide `CheckCircle2 / AlertCircle / XCircle` icon at `text-[var(--color-success/warning/error)]`, no circle wrapping.
3. **Verify certificate page same pattern, duplicated** — `apps/memberry/src/routes/verify/$certificateNumber.tsx:42,65,71`. Copy-paste of the same slop. Refactor both verify pages onto a shared `<VerificationResultLayout>` that uses tokenized icons.
4. **Admin app shipping shadcn defaults** — `apps/admin/src/styles/globals.css:1-77`. Raw `--background: 0 0% 100%; --primary: 240 5.9% 10%`, no fonts. The "I forgot to brand this" signature. Quick fix: copy memberry tokens or import a shared `@monobase/ui` theme.
5. **`bg-purple-100 text-purple-700` category badges** — `apps/memberry/src/features/dues/components/dues-status-badge.tsx:91,96`, `surveys/survey-list.tsx:47`, `elections/election-list.tsx:34`, `elections/member-election-list.tsx:22`. Each module reaches for raw purple-100 instead of `--color-primary-subtle` / `--color-info-bg`. Quick fix: replace with token-driven variant on the existing `<StatusBadge>` pattern.
6. **`bg-purple-500` induction-ceremony calendar color** — `apps/memberry/src/features/events/components/event-calendar.tsx:22`. Raw saturated purple in a calendar legend that otherwise reads as restrained. Quick fix: define a token `--color-event-induction` or reuse `--color-primary-lighter`.
7. **Admin member-detail avatar uses purple-500/20 + purple-400 text** — `apps/admin/src/routes/members/$personId.tsx:72`. Generic AI-template member-detail header circle. Quick fix: use `<AvatarInitials>` pattern from memberry instead.
8. **"Welcome to Memberry" generic hero copy** — `routes/onboarding.tsx:230`, `routes/invite/$token.tsx:107`. The exact phrase that screams "starter template". Quick fix: replace with task-anchored copy: "Let's set up your member profile" / "You're invited to join {orgName}".
9. **Emoji glyphs replacing icons** — `routes/verify/$token.tsx:55,67` (`❌`, `✓` at `text-4xl`), `routes/pay/$token.tsx:89` (`✅`). These are *public* token-redemption pages where emoji-as-icon reads as unfinished. Quick fix: lucide `CheckCircle / XCircle` with brand tokens.
10. **Officer-dashboard "Welcome to your association dashboard" zero-state copy** — `apps/memberry/src/features/admin/components/officer-dashboard.tsx:149`. Generic. Quick fix: "Start by importing your member roster — we'll guide you through the rest."

## 4. CSS VARIABLE / TOKEN AUDIT

### Memberry — INTENTIONAL

`apps/memberry/src/styles/globals.css:17-103`:

- `--color-primary: #554B68` — desaturated mauve (HSL ~268, 17%, 35%). Reads as warm purple-grey, NOT the cheesy violet-500. Cluster: `primary-mid #675D78`, `primary-light #9E8890`, `primary-lighter #C8B4BC`, `primary-subtle #F0E8EC`.
- `--color-cream: #F2DEB0` + `cream-light #F9F0D8` + `cream-dark #D4BA82` — warm secondary axis. Genuine palette pairing, not a copy-paste from shadcn.
- `--color-bg: #FAF7F2` — warm off-white, not cold neutral.
- `--color-surface-warm: #FDF9F3`, glass tokens `--color-surface-elevated: rgba(255,255,255,0.45)` + `--surface-blur: 20px` — custom glass-morphism direction.
- Border-radius: `sm 8px`, `md 12px`, `lg 18px`, `full 9999px` — three-tier rhythm, NOT one rounded-2xl-for-everything.
- Fonts: `font-display: DM Sans Variable`, `font-body: Plus Jakarta Sans Variable`, `font-mono: JetBrains Mono` — three deliberate axes.
- Body background: four-layer radial gradient in mauve/cream tones (`globals.css:228-232`) — replaces the SaaS-template solid bg.
- 13-style typography utility scale: `.text-hero / .text-h1 / … / .text-mono-label` (`globals.css:245-258`) — far past template defaults.

**Verdict: 9/10 intentional.** Only criticism: the `dark` mode tokens are mechanical inversions, not separately designed.

### Admin — DEFAULT-TEMPLATE

`apps/admin/src/styles/globals.css:6-58`:

- `--primary: 240 5.9% 10%` — almost-black. Generic neutral.
- `--sidebar-primary: 270 60% 65%` — saturated violet. The AI-default sidebar tint.
- No `fontFamily` override anywhere.
- No `--radius` per memberry's scale; only the shadcn default `0.625rem`.
- No semantic tokens (no success/warning/info/error families).

**Verdict: 2/10. Admin app is a default shadcn theme with a violet sidebar.**

## 5. MARKETING SURFACE AUDIT

There is **no public marketing surface**. The repo intentionally ships zero landing page. This is itself a design statement (B2B AMS for known associations — not consumer SaaS).

Public surfaces that exist:

| Path | Verdict | What would make it intentional |
|---|---|---|
| `/` (index.tsx) | PASS — pure redirect, no visual surface | n/a |
| `/auth/$authView` (Better-Auth UI) | NOT-AUDITED — vendored third-party UI | Theme the better-auth UI via its own CSS variable bridge so the auth screen matches the mauve/cream palette. |
| `/join` | PASS-with-caveats — clean search + card grid, brand-light | Add the `memberry-logo.png` header band + tagline anchored to "find your dental/medical association". Currently reads as a generic org search. |
| `/onboarding` | FAIL — "Welcome to Memberry", centered stack, generic `text-h2` greeting | Replace headline with progress-anchored copy: "Step 1 of 2 — who are you?". Drop the logo+h1+h2 triple-stack. |
| `/invite/$token` | FAIL — "Welcome to Memberry" | Replace with "{orgName} invited you to join" + show org logo/name above the fold. |
| `/verify/$credentialNumber` | FAIL — colored-circle status icons, centered marketing rhythm on a trust surface | This page is a credential verification result that someone reaches by scanning a QR. It needs to feel like a government cert. Replace the colored-circle status with a single tokenized icon + heavier typographic hierarchy (large name, mono credential number, status badge). |
| `/verify/$certificateNumber` | FAIL — same as above | Same fix. Share a `<VerificationResultLayout>`. |
| `/verify/$token` | FAIL — `text-4xl ❌` / `✓` emoji | Replace emoji with lucide icons; tokenize. |
| `/pay/$token` | FAIL — `text-4xl ✅` emoji | Same. |
| `/verify-email` | PASS — uses `bg-[var(--color-info-bg)]` tokenized circle. The right way. |

## 6. APP UI SURFACE AUDIT

### Member surfaces — STRONG

- `_authenticated/dashboard.tsx`, `org/$orgSlug/home.tsx`, `_authenticated/my/*` — ops density, `GlassCard` surface, `StaggerGrid` motion, small icons (16-18px), tokenized status colors, no decorative slop.
- `quick-actions.tsx` (6 utility tiles, 3-or-6 column grid, small icon + label) — borderline pattern but uses primary text-color icon + small label, no circle wrapping, no descriptions. Functional, not marketing.
- `member-dashboard.tsx` — three-column upcoming-events / trainings / notifications layout with divided rows, no decorations. This is the right pattern.
- `member-sidebar.tsx` / `officer-sidebar.tsx` — branded mauve sidebar with `border-l-[3px]` cream-accent active state. Distinctive.

### Officer surfaces — STRONG

- `officer-dashboard.tsx` — KPI strip (6 cards), action queue, module summary cards with health dot. No icon-circle slop. Healthy.
- `ModuleSummaryCard` — small icon + title + 2x2 status dot + metric. Clean.
- Officer route uses `memberry-bg.png` as ambient `opacity-30` background — gives the officer surface a distinct atmosphere from member surface.

### Admin surfaces — WEAK

- `apps/admin/src/routes/index.tsx` — generic shadcn cards, default text-3xl numbers, `text-green-600/text-red-600` status colors. Functionally fine but visually undifferentiated.
- `apps/admin/src/routes/__root.tsx:149-159` — `bg-[#2D2635]` sidebar with `bg-purple-500` logo tile and `border-l-2 border-white` active state. Reads as "we wired up shadcn admin example".
- `apps/admin/src/routes/members/$personId.tsx:72` — generic purple-500/20 avatar circle.

**Verdict: memberry app surfaces are calm-dense and intentional. Admin app surfaces are template-default.**

## 7. DESIGN INTENTIONALITY SCORE PER MODULE

| Module | Score | Notes |
|---|---|---|
| Design system (memberry globals.css + tailwind.config.ts) | **9/10** | Custom palette, 3-axis typography, 3-tier radius, glass tokens, custom utility classes |
| Layout / navigation (member-sidebar, officer-sidebar, member-header, officer-mobile-nav) | **9/10** | Branded mauve rail, cream-accent active state, logo present in every viewport |
| Dashboard (member + officer) | **8/10** | Calm density, status dots not circles, StaggerGrid motion. Loses a point for "Welcome to your association dashboard" generic copy |
| Person / profile / address forms | **8/10** | Token-driven, no slop. Loses a point for some `text-center` block stacks on form headers |
| Dues / payments / finances | **7/10** | Mostly tokenized but ships `bg-purple-50/700` raw in dues-status-badge |
| Events | **7/10** | Calendar legend uses raw `bg-purple-500` for induction ceremony |
| Training / certificates / CPD | **8/10** | Token-driven, `bg-amber-100 text-amber-700` for "Expiring" is acceptable since it's a real status indicator |
| Elections / surveys | **6/10** | Both ship `bg-purple-100 text-purple-800` category badges that ignore the design system |
| Comms / chat / video | **8/10** | Functional density. `bg-emerald-500` connection dots are appropriate |
| Directory / member-profile | **8/10** | `AvatarInitials` pattern, surface-warm token, no decoration slop |
| Documents | **8/10** | Card grid for documents is functional file-browser, not feature grid |
| Public verify pages (credential / certificate / token) | **3/10** | The slop concentration. Colored-circle status icons, centered marketing rhythm, generic copy on the most public surfaces |
| Public /join page | **6/10** | Clean but brand-light — could anchor on memberry brand harder |
| Public /pay/$token | **4/10** | `text-4xl ✅` emoji as confirmation icon |
| Onboarding / invite | **5/10** | "Welcome to Memberry" generic copy, centered logo+h1+h2 stack |
| Admin app (apps/admin) | **3/10** | Default shadcn neutral + violet sidebar + no fonts + raw `bg-purple-500` logo |
| `packages/ui` (shadcn primitives) | **7/10** | Standard shadcn primitives are intentionally generic; consumers theme them. Acceptable for shared lib |

**Average across modules: 6.8/10. Pulled down primarily by the public verify pages and the admin app.**

## 8. 30-DAY DE-SLOPPING ROADMAP

Ranked by visual impact ÷ effort.

1. **Replace verify-page colored-circle status icons with tokenized lucide icons.** Files: `apps/memberry/src/routes/verify/$credentialNumber.tsx`, `verify/$certificateNumber.tsx`. Effort: 1 hour. Impact: Eliminates the highest-visibility slop on the most public surface — credential QR scans are how non-members first see Memberry. Extract `<VerificationResultLayout>` to share.
2. **Theme the admin app with memberry tokens.** Files: `apps/admin/src/styles/globals.css`, `apps/admin/tailwind.config.ts`, `apps/admin/src/routes/__root.tsx:153` (purple-500 logo). Effort: 2-4 hours. Impact: Removes the default-template signal across the entire ops surface. Replace `--sidebar-primary: 270 60% 65%` with the memberry primary cluster, add `font-display: DM Sans Variable` / `font-body: Plus Jakarta Sans Variable`, replace the `bg-purple-500` logo tile.
3. **Replace `bg-purple-100 text-purple-700` category badges with token-driven `<StatusBadge>` variants.** Files: `apps/memberry/src/features/dues/components/dues-status-badge.tsx`, `surveys/survey-list.tsx`, `elections/election-list.tsx`, `elections/member-election-list.tsx`, `events/event-calendar.tsx`. Effort: 2 hours. Impact: Removes the last cluster of raw-Tailwind-color escapes. Use `--color-primary-subtle` + `--color-primary` as the "informational/category" variant; reserve raw color palette only for true semantic states.
4. **Replace `text-4xl ❌/✓/✅` emoji confirmations on public token pages with lucide icons at token colors.** Files: `routes/verify/$token.tsx:55,67`, `routes/pay/$token.tsx:89`. Effort: 30 minutes. Impact: Public-surface polish.
5. **Rewrite "Welcome to Memberry" copy on onboarding + invite + officer-dashboard-zero-state.** Files: `routes/onboarding.tsx:230-231`, `routes/invite/$token.tsx:107`, `features/admin/components/officer-dashboard.tsx:149`. Effort: 30 minutes. Impact: Replaces the most cliché AI-template phrase with task-anchored copy. "Welcome to Memberry" → "Set up your member profile" / "{orgName} invited you to join". On the officer zero-state, anchor to the next action: "Start by importing your member roster".

---

**Final answer to "does this read as intentional or AI-generated?":** The memberry product app reads as **intentional** — custom palette, three deliberate fonts, glass surfaces, branded illustrated background, no rounded-2xl/3xl, no blobs, no feature-card grid. The slop is concentrated in three places: (a) the public verify pages reach for the colored-circle status pattern, (b) raw `bg-purple-*` badge escapes appear in 6 feature files, (c) the admin app ships shadcn defaults. Fix those three buckets and Memberry is a 9/10 intentional product.
