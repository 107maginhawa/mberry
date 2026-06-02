# UI Review — Batch 1 (Retroactive 6-Pillar Audit)

**Audited:** 2026-06-02
**Baseline:** Abstract 6-pillar standards + Memberry codebase conventions (no UI-SPEC.md present)
**Screenshots:** Not captured (code-only audit; dev server not invoked)
**Scope:** 4 modules — m01-auth-onboarding, m02-member-profile, m04-org-admin, m05-membership
**Scale:** 1-10 per pillar; module overall = weighted mean (pillars 1-3,5,6 ×1, pillar 4 ×0.7 since AI-slop scoring is partial signal)

---

## Module Summary Table

| Module | Pillar 1 (Hierarchy) | P2 (States) | P3 (DS) | P4 (AI Slop) | P5 (Resp/A11y) | P6 (Trust/Polish) | **Overall** |
|--------|---------------------:|------------:|--------:|-------------:|---------------:|------------------:|------------:|
| m01-auth-onboarding | 6 | 6 | 7 | 7 | 6 | 5 | **6.2** |
| m02-member-profile  | 6 | 7 | 6 | 5 | 5 | 6 | **5.9** |
| m04-org-admin       | 7 | 8 | 8 | 6 | 6 | 7 | **7.1** |
| m05-membership      | 7 | 8 | 7 | 6 | 6 | 7 | **6.9** |

**Batch mean: 6.5 / 10** — competent baseline, leaks at polish + a11y + slop tells.

---

## m01-auth-onboarding

**Primary user / task:** First-time member completes sign-up → email verification → entry to dashboard. Also: third-party (employer, regulator) opens public `/verify/:token` to validate a member's credential.

| Pillar | Score | Evidence |
|--------|------:|---------|
| 1. Hierarchy | 6 | Header "Memberry" + title + subtitle stack reads cleanly (`auth/$authView.tsx:42-54`). But verify-email card has 4 stacked sections (icon, alert, list, 2 buttons, footer) with no priority gradient — primary CTA ranks visually equal to "Sign Out" (`verify-email.tsx:86-104`). Public verify page leads with "❌" emoji as the H1 anchor (`verify/$token.tsx:55-56`). |
| 2. States | 6 | Loading + error + success branches exist on `/verify/:token` (`verify/$token.tsx:40-93`). Resend button has pending state (`verify-email.tsx:91-92`). Missing: rate-limit / "already verified" / cooldown states for resend; no error boundary if `AuthView` (3rd-party) throws; no partial state when user is signed-in but email unverified AND has no `user.email` (non-null assertion at `verify-email.tsx:18` will crash). |
| 3. Design system | 7 | Consistent use of `@monobase/ui` Button/Card/Alert + CSS vars (`--color-primary`, `--color-info`). Mixes raw `bg-gray-50` (`verify/$token.tsx:42,53`) and raw `bg-green-600` (`verify/$token.tsx:66`) with token-based palette — drift from system. |
| 4. AI Slop | 7 | Clean structure, no `whitespace-pre-wrap` debris. Slop tells: emoji-as-icon (❌, ✓) in `verify/$token.tsx:55,67` (should be lucide icons used elsewhere); generic body copy "Need help? Contact support" with no link (`verify-email.tsx:109`); inline-styled spinner instead of `Skeleton`/spinner primitive (`verify/$token.tsx:44`). |
| 5. Resp / a11y | 6 | Container responsive (`max-w-md`, `sm:px-6 lg:px-8`). Issues: emoji icons not decorative-marked (no `aria-hidden`); `❌` and `✓` carry semantic meaning but no text alternative beyond heading; loading state has no `role="status"`/`aria-live`; "QR Code" placeholder text would never reach AT users meaningfully (not in this module but ties to verify trust). Color-only differentiation on the green/red status panels. |
| 6. Trust / Polish | 5 | Copy "Verified by Memberry • memberry.ph" hard-codes a domain — brittle for white-label/dev (`verify/$token.tsx:89`). `result?.verifiedAt \|\| 'now'` is a string fallback that lies if the API returned null (`verify/$token.tsx:69`). `<any>` type holes throughout `verify/$token.tsx:17,21,37` reflect rushed contract. "Verified as of {date}" with no timezone is ambiguous for international audits. |

**Top 3 findings**
1. **P0 — Non-null user.email assertion will crash verify-email page.** `verify-email.tsx:18` does `auth.user!` and reads `.email`; if guard chain misfires the SPA hard-crashes. Wrap with `if (!user?.email) return <ErrorState/>`.
2. **P1 — `/verify/:token` typed as `any` everywhere.** `verify/$token.tsx:17,21,37` lose all schema guarantees on a public trust surface. Add a zod parse / generate the response type from OpenAPI.
3. **P1 — Emoji icons + hardcoded "memberry.ph" branding on public verify page.** `verify/$token.tsx:55,67,89`. Replace with `XCircle`/`CheckCircle2` from lucide and pull org domain from config; restores trust signal.

---

## m02-member-profile

**Primary user / task:** Active member views/edits their professional profile, manages directory visibility, accesses ID card, configures notification + privacy + security settings.

| Pillar | Score | Evidence |
|--------|------:|---------|
| 1. Hierarchy | 6 | `profile.tsx` uses a 1/3-2/3 grid with avatar+identity left, content cards right — sensible. But the page packs 7 vertical cards (`StandingMeter`, About, Contact, Address, Memberships, Directory, Licenses) followed by a 2x2 quick-link grid — no fold/priority, no anchor nav, and identical card chrome flattens hierarchy (`profile.tsx:196-382`). Settings page uses tabs cleanly (`settings.tsx:40-59`). |
| 2. States | 7 | Profile has loading skeleton, error+empty fallback, edit mode (`profile.tsx:131-150`). ID card has skeleton + error + empty (`id-card.tsx:98-110`). Settings has per-section loading + error + optimistic toggle with rollback (`settings.tsx:217-229, 232-237`). Gaps: profile silently auto-`createPerson` mutation has no user-visible feedback (`profile.tsx:53-64`); `publishMutation` errors via toast but no inline rollback of the displayed visibility. |
| 3. Design system | 6 | Heavy use of `GlassCard` + CSS-var palette is consistent. Drift: inline border classes repeated 4× verbatim on quick links (`profile.tsx:370-381`) — should be a `<QuickLink>` component; raw `bg-gray-100` mixed with tokens in `id-card.tsx:71`; raw `bg-white` in dialog overlay (`id-card.tsx:134`); StatusBadge variant in `id-card.tsx:67-74` redefines a status color map that already exists in `features/membership/lib/membership-status.ts`. |
| 4. AI Slop | 5 | Multiple slop tells: (a) duplicated 4-line quick-link className (`profile.tsx:370,373,376,379`) is the classic LLM copy-paste pattern; (b) `'QR Code'` literal text inside the QR placeholder div (`id-card.tsx:134`) — placeholder leaked to production; (c) `formatPersonName(p?.firstName \|\| '?', ...)` with `'?'` fallback as displayed string (`profile.tsx:168,286`); (d) `creditCount: 0, ceCreditsEarned: 0` hardcoded zero (`profile.tsx:189-190`) — TrustBadges receives synthetic data; (e) `'memberOnly'` enum value rendered as raw camelCase string to users (`profile.tsx:300`). |
| 5. Resp / a11y | 5 | Some `md:` breakpoints (`profile.tsx:164,165`). Problems: edit form is single-column on mobile but `md:grid-cols-3` on address (`profile.tsx:558`) gives a cramped layout at narrow tablet; QR placeholder is purely visual; `Switch` toggles have `Label` but `cursor-pointer` is on outer div without keyboard handler (`settings.tsx:412-420`); no `<main>` landmark on profile route; emoji-style `→` rendered as `&rarr;` text (`settings.tsx:126`) — not focusable, not labeled. Avatar color contrast on `bg-[var(--color-primary)]` white text is OK but unverified. |
| 6. Trust / Polish | 6 | Good: `formatLicenseDisplay`, 30-day deletion grace + `DELETE` typed confirmation (`settings.tsx:84,156-180`), preview-public mode for directory (`profile.tsx:281-295`). Bad: "Licenses can be added by your organization's officers" tells users their org is responsible but no contact path (`profile.tsx:362-364`); raw `visibility: 'memberOnly'` shown in UI; "Email is managed through your account settings" (`profile.tsx:544`) but the form IS in account settings — recursive guidance; `prefs ?? prefsQuery.data` rollback on catch swallows specific error (`settings.tsx:225-229`). |

**Top 3 findings**
1. **P0 — `'QR Code'` literal placeholder in production digital ID card.** `id-card.tsx:134` ships a `<div>QR Code</div>` greybox to members. This breaks the entire trust premise of a "verified" ID. Generate the QR (or hide the panel) before shipping.
2. **P1 — TrustBadges fed synthetic zeros + raw visibility enum exposed.** `profile.tsx:189-190` passes `credentialCount: 0, ceCreditsEarned: 0` regardless of real data, and `profile.tsx:300` prints `memberOnly` to the user. Wire real signals and add a label map (`memberOnly` → "Members only").
3. **P1 — Duplicated quick-link className paste + edit-form responsiveness.** `profile.tsx:370-381` (slop tell + maintenance debt) and `profile.tsx:558` (`md:grid-cols-3` cramps at iPad portrait). Extract `<QuickLink>` and add `sm:grid-cols-2 lg:grid-cols-3` ladder.

---

## m04-org-admin

**Primary user / task:** Officer/admin configures org settings (CPD config, providers, funds, chapters, dues, gateway, categories), reviews governance hub (elections, documents).

| Pillar | Score | Evidence |
|--------|------:|---------|
| 1. Hierarchy | 7 | `PageHeader` with breadcrumbs + subtitle + action button is consistent across `officer/settings/*` and `governance/index.tsx` (`providers.tsx:152-166`, `governance/index.tsx:43-51`, `settings/org.tsx:15-23`). Governance hub leads with stat cards then sections — clear F-pattern. Providers table has clean column order but the action cell is "Edit / Delete" both as ghost buttons — destructive parity reduces hierarchy (`providers.tsx:218-235`). |
| 2. States | 8 | Strong: providers page has full skeleton (`providers.tsx:114-128`), error state (`providers.tsx:130-149`), empty state inside table (`providers.tsx:180-188`), toast on every mutation outcome (`providers.tsx:82-110`). Governance has per-section skeletons + per-section empty + page-level error (`governance/index.tsx:53-57, 99-107, 140-148`). Gap: no optimistic UI on provider create/edit. |
| 3. Design system | 8 | Most consistent of the four modules. Uses `Table`/`TableHeader` from `@monobase/ui` (`providers.tsx:15`), `STATUS_BADGE` map token-aligned (`providers.tsx:26-30`), `GlassCard` wraps tables for the Apple-glass look. Minor: hand-rolled modal overlay `fixed inset-0 ... bg-black/40` (`providers.tsx:247, 281`) instead of `Dialog` primitive that other routes use (`my/settings.tsx`, `roster/index.tsx`). |
| 4. AI Slop | 6 | Decent, but: dynamic-href escape hatch `to={... as any /* eslint-disable-line ... */}` appears twice with identical justification comment (`governance/index.tsx:114, 154`) — classic Claude copy-paste artifact; `STATUS_BADGE_COLORS` map redefined across modules (id-card, member-table, providers) instead of shared util; hand-wired modal exists alongside `Dialog` usage elsewhere — inconsistent. |
| 5. Resp / a11y | 6 | Table has no responsive collapse/card mode — at 375px the 5-column providers table overflows or word-wraps. Modal is centered but no scroll-lock and no `Escape` close handler (`providers.tsx:247-277`). Delete confirmation uses a generic name interpolation, no `aria-modal`. Stat cards: `grid-cols-2` always — fine. Good: `role="alert"` on form errors (`providers.tsx:345,360`), `aria-describedby` on inputs. |
| 6. Trust / Polish | 7 | "Expiring in {days}d" badge is a nice micro-trust signal (`providers.tsx:211-214`). `toast.success('Provider updated')` is terse but clear. Empty-state copy "Add your first PRC-accredited CPD provider" is specific (`providers.tsx:185`). Governance subtitle "Your governance hub" (`governance/index.tsx:46`) is filler — the page title already says Governance. Delete modal warns "This cannot be undone" but doesn't say "removes from CPD attribution history" or similar — under-warns. |

**Top 3 findings**
1. **P1 — Hand-rolled modal replaces shadcn `Dialog` primitive.** `providers.tsx:247-304` uses `fixed inset-0` divs while every other dialog in the codebase uses `<Dialog>` (`my/settings.tsx`, `roster/index.tsx:126`). No Escape close, no focus trap, no `aria-modal`. Replace with `Dialog` from `@monobase/ui`.
2. **P1 — Provider table not responsive.** `providers.tsx:168-243` renders 5-column `Table` with no card-layout fallback. Below ~640px the action cell overflows or wraps badly. Add `hidden md:table-cell` to non-essential columns and a stacked `<Card>` view for mobile.
3. **P2 — Duplicated `as any` href escape hatches on governance Links.** `governance/index.tsx:114, 154` — both have the identical disable comment. Build a typed `orgLink()` helper or generate dynamic route types so all org-scoped routes stop bypassing the registry.

---

## m05-membership

**Primary user / task:** Officer manages roster (search/filter/bulk select), reviews + approves/denies applications, adds new members, edits membership categories.

| Pillar | Score | Evidence |
|--------|------:|---------|
| 1. Hierarchy | 7 | `MemberTable` has a clean filter row → status tabs → bulk-action bar → table → pagination flow (`member-table.tsx:151-356`). 9 columns is dense but each headed and grouped. `application-list.tsx` uses status filter + sort dropdown + bulk approve — also clear. Add-member dialog is well-prioritized (`roster/index.tsx:131-187`). Weakness: 4 filter selects + tab row competes visually at viewport widths < 1280px. |
| 2. States | 8 | Best states coverage in batch. `MemberTable` covers: skeleton (`member-table.tsx:221-226`), error with `aria-live` (`member-table.tsx:228`), empty with search-aware copy `No members found for "{q}"` (`member-table.tsx:230-233`), bulk-action banner (`member-table.tsx:210-217`). `MembershipList` has loading+error+empty (`membership-list.tsx:29-45`). Application list has approve/deny mutations with toast (`application-list.tsx:89-109`). Gap: no optimistic remove of approved app from list; `MembershipList` empty copy mentions "creating tiers" but action button absent. |
| 3. Design system | 7 | Consistent table chrome, `STATUS_BADGE` + `DUES_STATUS_BADGE` token-aligned (`member-table.tsx:40-55`). Drift: `bg-orange-100 text-orange-800` hardcoded in `membership-list.tsx:88` (escapes the token system); `bg-gray-100 text-gray-800` for `suspended`/`removed` (`member-table.tsx:44,46`); zebra striping `idx % 2 === 1 ? 'bg-[var(--color-surface-warm)]'` hand-rolled (`member-table.tsx:264`); `MembershipList` `<StatusBadge>` is yet another redefinition of the status-color contract. |
| 4. AI Slop | 6 | Tells: `oli-execute: error-handled-inline` comment artifact in source (`member-table.tsx:1`) — leaked tooling annotation; `oli-ui: exempt(...)` justification comment buried in className (`member-table.tsx:203`) — config in source; `window.location.reload()` after add-member instead of TanStack Query invalidation (`roster/index.tsx:119`); `MembershipList.tsx` Tier column displays raw `tierId` string (`membership-list.tsx:67`); `personId` shown as raw uuid if no name resolved (`member-table.tsx:285`, `membership-list.tsx:63`). |
| 5. Resp / a11y | 6 | Filter row is `sm:flex-row sm:flex-wrap` but 4 selects + search + tabs = horizontal scroll at iPad portrait (`member-table.tsx:152`). Table has no horizontal scroll affordance. Checkboxes have `aria-label="Select all"` and per-row labels (`member-table.tsx:241-243, 267-270`) — good. Status tabs include explicit contrast-exemption comment indicating prior audit flagged a contrast issue (`member-table.tsx:203-205`) — exemption is asserted, not fixed at token level. AddMember dialog uses `Dialog` primitive — good. |
| 6. Trust / Polish | 7 | Good: bulk approve writes notes per application; search debounced 300ms (`member-table.tsx:71-77`); Compliant/non-compliant credit badge with current/required ratio (`member-table.tsx:310-314`). Bad: `window.location.reload()` after add (`roster/index.tsx:119`) is a hard nav and loses table state; `MembershipList` empty copy is generic "No members yet. Start by creating membership tiers and inviting members." (`membership-list.tsx:42`) with no CTA buttons; raw `personId` UUID shown when name missing (`membership-list.tsx:63`) erodes trust. |

**Top 3 findings**
1. **P1 — `window.location.reload()` after add-member.** `roster/index.tsx:119`. Discards filter state, scroll position, and selected rows. Replace with `queryClient.invalidateQueries({ queryKey: listRosterMembersQueryKey(...) })`.
2. **P1 — Raw enum/UUID values rendered to users.** `membership-list.tsx:63,67` (raw `personId`, raw `tierId`); `member-table.tsx:285` falls back to `personId`/`id`. Resolve names via SDK includes or show "Unnamed member" + member-number.
3. **P2 — Hardcoded color escapes + duplicated `StatusBadge` definitions.** `membership-list.tsx:88` (orange-100), `member-table.tsx:44,46` (gray-100). Centralize in `features/membership/lib/membership-status.ts` and have all three tables consume one badge component.

---

## Cross-Batch Observations

**1. Status-color contract is fragmented across 4+ definitions.**
`member-table.tsx:40-47`, `application-list.tsx:46-52`, `providers.tsx:26-30`, `id-card.tsx:67-74`, `membership-list.tsx:85-92`, plus `features/profile/components/trust-badges.tsx`. Each route redefines its own `STATUS_BADGE` map — most are token-based but some leak `gray-100`/`orange-100`. One shared `StatusBadge` component + status-token map in `features/shared/` would eliminate ~150 LOC and a class of contrast bugs.

**2. Dialog/modal pattern inconsistency.**
`@monobase/ui`'s `Dialog` is used in `roster/index.tsx` and `my/settings.tsx`, but `providers.tsx` and parts of profile reach for hand-rolled `fixed inset-0 bg-black/40` overlays — no focus trap, no Escape close, no `aria-modal`. Pick one (the primitive) and migrate.

**3. AI-slop fingerprints in 3 of 4 modules.**
Duplicated className blocks (`profile.tsx:370-381`), `as any` + identical disable comment paste-twice (`governance/index.tsx:114,154`), leaked `'QR Code'` literal placeholder (`id-card.tsx:134`), `oli-execute` tooling annotations leaked into source (`member-table.tsx:1`), `formatPersonName(..., '?')` displayed literal "?", `creditCount: 0` synthetic zero data. Run a quick `grep` pass for these tells before each ship.

**4. Public surfaces (`/verify/:token`, ID card) under-typed and visually inconsistent.**
Both render with raw `bg-gray-50`/`bg-white`/emoji icons while the rest of the app uses tokenized `GlassCard` + lucide icons. These are the highest-trust surfaces (external parties, regulators). Hold them to the same standard as authenticated routes.

**5. Optimistic-update + invalidation discipline is uneven.**
`settings.tsx` and `MemberTable` debounce + rollback correctly; `roster/index.tsx` hard-reloads; `governance/index.tsx` relies on default react-query refetch. Establish a project convention: mutate → optimistic update → on error rollback + invalidate; never hard-reload from a feature route.

**6. A11y baseline acceptable but missing landmarks + focus management.**
Most pages have `role="alert"` on errors and `aria-label` on bulk checkboxes, but no `<main>` landmark, no skip-links, no focus management on modal open/close, and the public verify page uses emoji icons without `aria-hidden`. A one-pass a11y sweep would lift every module by 1+ pillar point.

---

## Files Audited

- `apps/memberry/src/routes/auth/$authView.tsx`
- `apps/memberry/src/routes/verify-email.tsx`
- `apps/memberry/src/routes/verify/$token.tsx`
- `apps/memberry/src/routes/_authenticated/my/profile.tsx`
- `apps/memberry/src/routes/_authenticated/my/id-card.tsx`
- `apps/memberry/src/routes/_authenticated/my/settings.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/governance/index.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/settings/providers.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/settings/org.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/applications.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/index.tsx`
- `apps/memberry/src/features/membership/components/member-table.tsx`
- `apps/memberry/src/features/membership/components/application-list.tsx`
- `apps/memberry/src/features/membership/components/membership-list.tsx`

**Word count check:** ~2,420 words (under 2,500 cap).
