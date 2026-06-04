<!-- oli-version: 1.0 -->
<!-- generated: 2026-06-03T20:30:00Z -->
<!-- pinned-by: phase-d-rebaseline-005 (Tier-E convergence) -->
<!-- baseline-pin: docs/audits/enforce/.baseline.json v56 -->
<!-- mode: LOCKED — these are the canonical detection patterns for the UI-consistency ratchet -->

# UI Consistency Pattern Lock

This file is the **single source of truth** for what counts as a UI-consistency violation.
The ratchet (pre-commit hook + `/oli-check --ui-consistency`) reads these patterns.
**Do not change a detector without bumping the baseline.**

## Exemption Annotation Syntax

Annotate a single line / next JSX element with:

```tsx
{/* ui-c-exempt: <category> — <one-line reason> */}
<Button className="bg-yellow-600 ..." />
```

Or inside-an-attribute style (above the component opener):

```tsx
// ui-c-exempt: <category> — <reason>
<Button ... />
```

Recognized categories:
- `auth-flow` — sign-in / sign-up / verify-email shells (no app chrome)
- `landing-page` — public marketing root
- `public-verify` — public credential/certificate verification, no auth
- `onboarding-step` — multi-step onboarding wizards (own shell)
- `full-height-layout` — officer/admin layouts with their own chrome (e.g. `officer.tsx`)
- `nav-icon` — sidebar/header navigation iconography (system convention)
- `empty-state-emphasis` — large icon in EmptyState (≥32px, by design)
- `interactive-emphasis` — large interactive glyphs (rating stars, etc.)
- `skeleton-placeholder` — placeholder shapes in `skeleton-loader.tsx`
- `brand-color-system` — admin chrome that uses brand hex (single source)
- `custom-component-prop` — size prop forwarded to non-Icon visual (e.g. `CreditRing`)
- `methodology-carry` — pre-existing pattern surfaced by a stricter detector, no new debt

## Floor (carries from baseline.json v56)

- `exemption_cap_pct: 2`  (annotated exemptions may not exceed 2% of detector matches)
- Total floor counts are tracked in `ui_consistency.history[*]` in `.baseline.json`.

---

## Detector 1: Button override

**Regex sketch (PCRE):**
```
<Button\b[\s\S]{0,400}?className=("[^"]*"|\{`[^`]*`\}|\{'[^']*'\})
```
Then split the className value into whitespace tokens and flag any token matching:

| Class of token | Examples |
|---|---|
| Non-semantic colored `bg-` | `bg-red-500`, `bg-green-600`, `bg-yellow-700`, `hover:bg-red-700`, `hover:bg-red-500/10` |
| Non-semantic colored `text-` | `text-red-700`, `text-green-700`, `text-amber-800` |
| Hard-coded sizing `h-N` / `w-N` (NOT `h-auto` / `h-full`) | `h-7`, `h-8`, `h-12`, `h-14`, `w-7`, `w-8` |
| Arbitrary px sizing | `h-[34px]`, `w-[120px]` |
| Padding overrides | `px-3`, `px-4`, `py-1.5`, `py-2`, `py-3` |
| Numeric rounded | `rounded-1`, `rounded-2` |
| Bracket hex | `bg-[#2D2635]` |

**Allowed (semantic) tokens** (never flag): `bg-{muted,background,card,popover,primary,secondary,destructive,accent,foreground,transparent}` and the matching `text-*-foreground` variants, plus all hover/focus/active variants of the same.

## Detector 2: Icon arbitrary size

**Pattern A — JSX `size` prop:**
```
<\w+\s+[^>]*\bsize=\{(18|22|26|28|30|32|36|40|44|48)\}
```
**Pattern B — className container sizing:**
```
className=(?:"|`)[^"`]*\bh-\[\d+(?:\.\d+)?px\]\s+w-\[\d+(?:\.\d+)?px\]
```

**Canonical icon scale (`size={N}` allowed without annotation):**
- 12, 14, 16, 20, 24

Anything outside the canonical scale **must** carry an `ui-c-exempt: <category>` annotation on the line above OR within 5 lines above (so JSX context comments work).

## Detector 3: Hex leakage in className

**Regex:**
```
className=(?:"[^"]*#[0-9a-fA-F]{3,8}[^"]*"|\{`[^`]*#[0-9a-fA-F]{3,8}[^`]*`\})
```

Anything matching must be annotated `ui-c-exempt: brand-color-system` and the hex must be the **single** source for that color (no duplicates).

## Detector 4: PageShell missing

Scope: `apps/*/src/routes/**/*.tsx` excluding layout files:
- `__root.tsx`
- `_authenticated.tsx`
- `*.layout.tsx`
- `route.tsx` (layout routes)

A route file is a violation if:
- it does not contain `<PageShell` or import `PageShell`, AND
- it is not in the INTENTIONAL-EXEMPT list below, AND
- it does not carry a `ui-c-exempt: <category>` annotation in the file header (first 20 lines).

## INTENTIONAL-EXEMPT routes (PageShell-missing OK by design)

This list is **closed** — any new route NOT in this list must use PageShell OR carry an inline annotation.

### Auth-flow
- `apps/memberry/src/routes/auth/$authView.tsx`
- `apps/memberry/src/routes/verify-email.tsx`

### Landing-page
- `apps/memberry/src/routes/index.tsx`

### Onboarding-step
- `apps/memberry/src/routes/onboarding.tsx`
- `apps/memberry/src/routes/join.tsx`
- `apps/memberry/src/routes/invite/$token.tsx`

### Public-verify
- `apps/memberry/src/routes/pay/$token.tsx`
- `apps/memberry/src/routes/verify/$token.tsx`
- `apps/memberry/src/routes/verify/$certificateNumber.tsx`
- `apps/memberry/src/routes/verify/$credentialNumber.tsx`
- `apps/memberry/src/routes/org/$slug.tsx`
- `apps/memberry/src/routes/events/$eventSlug.tsx`

### Full-height-layout (own chrome)
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dashboard.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/$memberId.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/communications.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/payments.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dues/assessments.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dues/member.$memberId.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/dues/treasurer.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/settings/funds.tsx`
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/settings/dues.tsx`
- `apps/memberry/src/routes/_authenticated/my/bookings/index.tsx`
- `apps/memberry/src/routes/_authenticated/my/bookings/$bookingId.tsx`
- `apps/memberry/src/routes/_authenticated/my/bookings/host.$personId.tsx`
- `apps/memberry/src/routes/_authenticated/my/bookings/host.$personId.$slotId.tsx`

**Total INTENTIONAL-EXEMPT:** 27

## Ratchet rules

1. NEW unannotated detector match → FAIL.
2. Annotated exemption count grows above `exemption_cap_pct (2%)` of detector matches → FAIL.
3. INTENTIONAL-EXEMPT list grows by more than 1 entry per rebaseline → REQUIRES baseline bump + review.
4. Removing a detector category requires bumping `version` and adding a `previous_baseline` pointer in `.baseline.json`.

## Out-of-scope (NOT enforced here)

- `services/api-ts/src/generated/**` (regenerated)
- `packages/sdk-ts/src/generated/**` (regenerated)
- `docs/audits/codebase-map/CODE_*.json` (engine artifacts)
- `packages/ui/src/components/**` (library — owns the variants)
- E2E/test files (`*.test.tsx`, `*.spec.tsx`, `tests/**`)
