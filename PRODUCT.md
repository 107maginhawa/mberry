# Product

## Register

product

## Users

Two primary humans, one operator:

- **Member** — an older, often non-technical dental professional, usually on a
  phone, already trained on **GCash**. Their job: see they're in good standing and
  **pay dues/renewals** with the least friction possible. Login-free where it counts.
- **Officer** (e.g. Dr. Olive's chapter staff) — runs a PH dental chapter. Their
  job: import the roster, send dues/renewal links, run events, get paid into the
  chapter's **own PayMongo account**. Not a power user; not in the money flow as a
  middleman.
- **Founder/platform operator** — lists and creates orgs, watches basic stats.
  Minimal surface (the `console` app).

Context of use: phone-first, intermittent, often the member's first time. The
moment that matters is collecting money over PH rails (GCash / bank via PayMongo).

## Product Purpose

**Memberry** is a deliberately small healthcare **Association Management System**
for PH dental chapters. The wedge is **money** — dues + renewals collection — sold
to one beachhead chapter first. Everything else stays deferred until a chapter is
paying.

Success = a chapter collects its first peso through the member→org dues flow
(org's own PayMongo connected account), then renews. Two money flows only:
member→org dues and org→founder subscription. The founder is never an escrow.

Three thin apps over one frozen, tested engine: `org` (officers), `member` (thin
dashboard + login-free pay-link), `console` (operator).

## Brand Personality

**Friendly Clarity** — warm, rounded, calm, trustworthy, professional. Three words:
**calm, trustworthy, familiar.** The feeling target: *"This just works, like the
apps I already use."* Voice is plain and human — "Membership Card", not "Credential
Vault"; English with Tagalog alongside where it helps. Confidence without jargon.

## Anti-references

Do NOT look like any of these:

- **Power-user density.** No Linear/Stripe-dense dashboards, multi-panel screens, or
  tiny text. We keep Stripe's *clarity* on money screens and drop Linear's *density*
  entirely.
- **Flat minimalism.** No flat, shadowless, ambiguous-tappable UI. Older eyes need
  depth — raised buttons, soft shadows separating cards.
- **Enterprise/clinical.** No cold healthcare-SaaS blue, no jargon labels, no
  multi-field password + CAPTCHA gauntlets.
- **Trendy / AI-slop.** No gradient-text, glassmorphism-by-default, eyebrow kickers,
  numbered-section scaffolding, or generic startup-landing tropes.

## Design Principles

1. **Accessibility-first is the product, not a checkbox.** WCAG 2.1 AA minimum,
   AAA on primary text. 18px base, ≥48px tap targets, text label on every icon. The
   older dentist on a phone is the design center, not an edge case.
2. **GCash familiarity = free onboarding.** Echo conventions 94M Filipinos already
   know — big readable amounts, rounded friendly cards, explicit confirm screens, QR.
   Familiarity is earned trust we don't have to build.
3. **Money clarity above all.** Every peso path is legible, confirmed at each step,
   and never double-charges (login-free, single-use, idempotent pay-links). The
   wedge is money; the money screens carry the most rigor.
4. **One primary task per screen.** Linear flows, step indicators on multi-step
   money flows, no dense dashboards. The member home is a "poster": good-standing
   status + one obvious action.
5. **Augment, don't dumb down.** Make the important things bigger and obvious; keep
   full capability underneath. Simple surface, no lost power.

## Accessibility & Inclusion

- **WCAG 2.1 AA minimum**, aim AAA on primary text.
- Text ≥18px base (never <16px); amounts large + tabular.
- Contrast ≥4.5:1 body. Tap targets ≥48px with generous spacing.
- Text label on every icon — no icon-only controls. Status = text + color, never
  color alone.
- Passwordless login (OTP/biometric); no password+CAPTCHA gauntlets.
- Touch-first, one-handed phone use; no hover-only interactions.
- Reduced-motion respected — motion is minimal-functional only.
- Plain language; Tagalog alongside English where it helps. Dark mode deferred
  (older users skew light-mode; revisit post-launch).
