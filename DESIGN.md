# Memberry — Design System ("Friendly Clarity")

Source of truth for how the lean Memberry apps (`org`, `member`, `console`) look
and feel. All three consume the SAME tokens + components from `packages/ui` — one
design language, never per-app forks. New screens adopt these patterns; extend this
doc rather than one-off.

## Who this is for (read first — it drives every rule)

Primary user is an **older, non-technical dental professional**, often on a phone,
who already uses **GCash**. Design for that person, not a power user:
- **Legible, big, obvious** beats dense, clever, trendy.
- **Echo GCash conventions** (big readable amounts, rounded friendly cards, explicit
  confirm screens, QR) — 94M Filipinos are already trained on them. Familiarity = free onboarding.
- **Augment, don't dumb down** — make the important things bigger; keep full capability.

> This replaces the prior power-user system (Stripe/Linear density). We keep Stripe's
> *clarity* for money screens and drop Linear's *density* entirely.

## Aesthetic Direction
- **Direction:** Friendly Clarity — warm, rounded, calm, trustworthy, professional.
- **Decoration:** intentional, NOT flat. Buttons look raised and obviously tappable;
  soft shadows separate cards (depth aids older eyes). Flat minimalism hurts this user.
- **Mood:** "This just works, like the apps I already use." Calm and confident.

## Accessibility baseline (non-negotiable — WCAG 2.1 AA min)
- **Text ≥ 18px** base; never below 16px. Amounts large + tabular.
- **Contrast** ≥ 4.5:1 body (AA); aim AAA on primary text.
- **Tap targets ≥ 48px**; generous spacing between interactive elements.
- **Text label on every icon.** No icon-only controls.
- **One primary task per screen**; linear flows; no dense multi-panel dashboards.
- **Plain labels** ("Membership Card", not "Credential Vault"). Consider Tagalog alongside English.
- **Passwordless login** (OTP/biometric) — never multi-field password + CAPTCHA gauntlets.
- **Confirmation screen at every money step**; **step indicators** ("Step 2 of 3") on multi-step flows.
- **Touch-first**: no hover-only interactions. Works one-handed on a phone.

## Mobile-first & shells
- Design at **phone width first**, scale up. Member app especially is a phone app.
- Build as **responsive PWA**; **Capacitor-wrap** the same React app for App/Play Store
  later if needed. No separate native codebase. (Ladder: PWA → Capacitor → RN only if forced.)

## Typography
- **One family: Hanken Grotesk** (display, body, UI) — warm, humanist, exceptionally
  legible at large sizes. (Not Inter/Roboto.)
- **Money & data:** Hanken Grotesk with `font-variant-numeric: tabular-nums`, large.
  Balances/amounts must read at a glance (the GCash lesson).
- **Scale:** amount 44 · page-title 30 · section 26 · large/list 21 · body 18 · caption 15.
- **Loading:** Bunny Fonts (privacy-friendly) or self-host.

## Color (Memberry plum + cream — retained, WCAG-tuned)
Defined as CSS variables in **`packages/ui`** (NOT per-app). Never use raw Tailwind
colors (`bg-red-100`) in features.
- **Primary:** `#554B68` (muted plum) · press `#3F3850` · on-primary `#FFFFFF`
- **Background:** `#FAF7F2` warm cream (subtle four-radial cream gradient, fixed — keep it, don't flatten)
- **Surface:** `#FFFFFF` · warm surface `#FDF9F3` · cream accent `#F2DEB0` / `#F9F0D8`
- **Text:** `#2D2635` · secondary `#554B60` · muted `#73656D` (AA-tuned)
- **Border:** `#E4D8DC` / light `#EDE5E8`
- **Semantic (each with `-bg` pair):** success `#2E6043`/`#EDF5F0` · warning `#8A6800`/`#FDF8E8`
  · error `#8A2C2C`/`#FDF0F0` · info `#3D5A8C`/`#EDF2F8`
- **Dark mode:** deferred (older users skew light-mode; revisit post-launch).

## Spacing & radius
- **Base 8px, SPACIOUS density** (deliberate opposite of the old Linear-dense system).
  Generous vertical rhythm; let screens breathe.
- **Radius:** sm 8 · md 12 · lg 18 (friendly, not bubble).

## Layout
- **Single-column, mobile-first.** Big cards. Member home is a "poster": large
  good-standing status + one obvious primary action (Pay Dues).
- **No multi-panel dashboards.** The `console` (platform) app may use a simple table,
  but org/member stay single-column card flows.

## Motion
- **Minimal-functional only.** Gentle transitions, clear state + press feedback.
  No scroll-jacking, no decorative choreography. Clarity over delight for this user.

## Patterns kept from the prior system (still good, rendered spacious)
- **List-item pattern** for entity lists (members, payments, events): identity left,
  status right; one meta line of *present* facts (never render `—` for missing data);
  pills only when relevant. Reuse one component, don't fork.
- **Status = text + color, never color alone.** Shared `StatusBadge`
  (success | warning | error | info | muted | accent).
- **Responsive data:** wide → table; narrow → reflow to list-item card (container
  queries). Never horizontal-scroll a wide table on a phone.
- **UI states:** Loading → `Skeleton`; Empty → `EmptyState` (icon + headline + desc +
  optional action); Error → `role="alert"` + `ErrorState`; Success → `sonner` toast;
  consequential one-click mutations → `ConfirmDialog`.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-24 | Replaced power-user system with "Friendly Clarity" | Lean relaunch; primary user is an older dentist on a phone, not a power user. GCash-adjacent familiarity + accessibility-first. |
| 2026-06-24 | Kept Memberry plum+cream palette | Already WCAG-tuned + warm/distinctive; brand continuity. (Chose over trust-teal / healthcare-blue.) |
| 2026-06-24 | Hanken Grotesk (single family) | Warm, highly legible at large sizes; one family = consistency across org/member/console + simpler lean build. |
| 2026-06-24 | Tokens move to `packages/ui` | All 3 apps share one source; was `apps/memberry/globals.css`. |
