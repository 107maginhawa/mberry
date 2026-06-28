# Wave C — Founder onboarding checklist (G1 · G2 · G3)

**Date:** 2026-06-28 · **Status of code:** Wave B complete — the member/officer/founder app trio and the full
first-peso engine path are CODE-COMPLETE. The only thing between here and real revenue is **founder external
paperwork (G1/G2/G3)** plus loading each chapter's live PayMongo credentials. None of this is code.

> **The two money flows (locked):** (1) member → org dues, settled into **each org's own PayMongo connected
> account** (the founder is never in this flow — no payouts/escrow/MTL). (2) org → founder subscription
> (founder's own Stripe — not part of these slices). This checklist is about flow (1) going live.

---

## TL;DR — what's LIVE-gated vs buildable-now

| Capability | Shipped | Works now (test/dev) | Needs to go LIVE |
|---|---|---|---|
| Create organization (console) | ✅ `POST /admin/organizations` | ✅ | G1 prod env |
| Roster CSV import (officer) | ✅ `importRosterMembers` | ✅ | officer **2FA in prod** |
| Member passwordless login (email-OTP) | ✅ `/auth/sign-in/email-otp` | ✅ | G1 prod env (email sender) |
| Member dashboard (membership / dues / receipts / **digital card** / **events**) | ✅ | ✅ | — |
| Officer send pay-link | ✅ `sendPaymentLink` | ✅ | officer **2FA**, G2 for settlement |
| **Member self-serve "Pay now"** | ✅ `mintMyPaymentLink` (B2) | ✅ (mints token) | **G2** for real checkout |
| Login-free checkout `/pay/:token` | ✅ `checkoutPaymentToken` | ✅ test keys | **G2** live keys |
| PayMongo webhook settlement | ✅ `paymongoWebhook` | ✅ test | **G2** webhook registration |
| Officer events + announcements | ✅ (B3) | ✅ | officer **2FA in prod** |
| Member event RSVP (free) | ✅ (B4) | ✅ | — |
| **Paid** event registration | ⛔ deferred (legacy Stripe rail) | partial | future PayMongo wiring + G2 |
| SMS pay-link delivery / phone-OTP | ⛔ not wired | email-only | **G3** (provider + sender ID) + better-auth phone plugin |

**Bottom line:** everything for first-peso DUES is built. **G2 (a live PayMongo connected account per
chapter) is the only hard blocker for real money.** G3 (SMS) is optional polish — the product works
email-only today. G1 is the legal/ops wrapper + production secrets.

---

## G1 — Business entity + production environment

**External (founder):**
- [ ] Register the PH business entity; obtain TIN. (No MTL/e-money license needed — the founder never holds
      member funds; dues settle directly into each chapter's own PayMongo account.)
- [ ] Stand up production Postgres + the deployment host (HTTPS domain — PayMongo webhooks require a public URL).

**Production secrets (the API FAIL-FASTS on these — `services/api-ts/src/core/config.ts`):**
- [ ] `AUTH_SECRET` — required in **all** envs; `openssl rand -hex 32`. (Also the encryption key for stored
      PayMongo secrets and the ID-card QR HMAC — keep it stable + backed up.)
- [ ] `DATABASE_URL` — production Postgres.
- [ ] `INTERNAL_SERVICE_TOKEN` — random UUID.
- [ ] `INVITE_TOKEN_SECRET` — real value (NOT the dev default).
- [ ] `UNSUBSCRIBE_SECRET` — real value (NOT the dev default).
- [ ] `STORAGE_ACCESS_KEY_ID` / `STORAGE_SECRET_ACCESS_KEY` — real (NOT `minioadmin`).
- [ ] `CORS_ALLOW_TUNNELING=false`, `CORS_ALLOW_LOCAL_NETWORK=false`.
- [ ] `ID_CARD_HMAC_SECRET` — optional; falls back to `AUTH_SECRET`. Set a dedicated one if you want to rotate
      ID-card signatures independently (B1 fail-closes if neither is set).
- [ ] Email sender configured (the member OTP login + pay-link delivery are email-based today).

The API refuses to boot in production if any required secret is missing or left at a dev default — that's by
design. PayMongo/Stripe/SMS keys are **not** boot-required: if absent, those endpoints return 503 rather than
crashing, so you can deploy before G2/G3 land.

---

## G2 — PayMongo connected account (the real first-peso blocker)

**How it works:** each chapter's live PayMongo keys live in the `dues_gateway_config` table, **per org**,
with the secret + webhook secret stored **AES-256-GCM encrypted** (key = `AUTH_SECRET`). The PayMongo adapter
(`handlers/association:member/utils/paymongo.adapter.ts`) supports GCash / Maya / card / bank transfer. Test
vs live is purely which key prefix you load (`pk_test_`/`sk_test_` vs `pk_live_`/`sk_live_`) — no separate env.

> ✅ **There is now an officer "Connect PayMongo" UI** (apps/org → **Payment settings**, shipped v0.1.15.0).
> A Treasurer/President pastes the keys + webhook secret, runs **Test connection**, and the screen shows the
> exact webhook URL to register. The `seed-paymongo-creds.ts` script remains as a scripted/CI alternative.
> Works with **test keys** (no live activation) so you can verify a chapter before G2.

**Per chapter (officer, once per org) — via the UI:**
- [ ] The chapter signs up for a PayMongo account and generates keys (`pk_test_*`/`sk_test_*` to dogfood, or
      `pk_live_*`/`sk_live_*` once activated).
- [ ] In the PayMongo dashboard → Webhooks, register the per-org webhook:
      **URL** `https://<your-API-domain>/webhooks/paymongo/<ORG_ID>` (shown on the Payment settings screen),
      **event** `payment.paid`. Copy the generated **webhook secret** (`whsec_*`).
- [ ] In apps/org → **Payment settings**: paste public key + secret key + webhook secret → Save → **Test
      connection** (a green "Connected" + a passed test means the keys are valid). The keys are stored
      AES-256-GCM encrypted; secrets are write-only (never shown back).
- [ ] *(Scripted alternative / CI)* instead of the UI, load creds with:
      ```bash
      cd services/api-ts
      ORG_ID=<org-uuid> PAYMONGO_PUBLIC_KEY=pk_xxx PAYMONGO_SECRET_KEY=sk_xxx \
      PAYMONGO_WEBHOOK_SECRET=whsec_xxx DATABASE_URL=<db> AUTH_SECRET=<same-as-API> \
      bun scripts/seed-paymongo-creds.ts
      ```
      (`AUTH_SECRET` MUST match the running API or the secret can't be decrypted.)
- [ ] Smoke test: run `bun scripts/seed-paylink.ts` against a non-prod copy, open the printed `/pay/:token`
      link, complete a small real checkout, and confirm the PayMongo dashboard shows the payment AND the
      invoice flips to `paid` (webhook settled).

**What test mode lacks:** real settlement. With test keys the checkout flow runs end-to-end but no money moves
and PayMongo won't deliver production webhooks. Loading live keys + registering the webhook is the whole of G2.

---

## G3 — PH SMS sender (optional; email works today)

**Current state:** SMS is **not wired**. Member login OTP and pay-link delivery are **email-only**
(`core/auth.ts` email-OTP; `core/notifs.ts` is OneSignal push, no SMS). Phone-first onboarding from the PRD
needs three things, none built:
- [ ] An SMS provider account + an approved **PH sender ID** (the actual G3 paperwork — sender-ID approval can
      take weeks).
- [ ] A `core/sms.ts` adapter (mirror `core/notifs.ts`) + env (`SMS_PROVIDER`, `SMS_SENDER_ID`, `SMS_API_KEY`).
- [ ] Wiring: SMS delivery of the pay-link (`sendPaymentLink` is email-only) and a phone-OTP login path
      (a better-auth phone plugin alongside the existing email-OTP).

G3 is deferred deliberately — it's polish, not a first-peso blocker. Start the sender-ID approval early
(long lead time) but ship dues on email first.

---

## Dev seed scripts (de-risk the click-through)

| Script | What it sets up |
|---|---|
| `services/api-ts/scripts/seed-console.ts` | Super platform-admin (`founder@memberry.ph`) + an association → lets you sign into the **console** and create orgs. |
| `services/api-ts/scripts/seed-paylink.ts` | Full test path: association → org → officer + member → tier → dues config → **dues invoice (₱3,000)** → `dues_gateway_config` (test keys) → a payment token; prints a ready `/pay/:token` link. The fastest way to exercise checkout end-to-end. |
| `services/api-ts/scripts/seed-paymongo-creds.ts` | Loads a chapter's live (or test) PayMongo keys into `dues_gateway_config` (encrypted, `connected=true`) — the scripted/CI alternative to the **Payment settings** UI (v0.1.15.0). |

**Recommended first-live dry run (once G2 keys exist):** create org in console → `seed-paymongo-creds.ts` with
the live keys → register the webhook in PayMongo → import a small roster (officer, with 2FA) → have a test
member email-OTP in, tap **Pay now**, complete a real small payment → confirm settlement + receipt.

---

## First-peso click-through (what's wired, end to end)

1. Founder creates the chapter — console → `POST /admin/organizations` (super-admin). *(no PayMongo needed)*
2. Officer loads the chapter's PayMongo keys — apps/org → **Payment settings** (or `seed-paymongo-creds.ts`) + register the webhook. **(G2)**
3. Officer imports the roster — `importRosterMembers` (CSV, client-parsed). *(officer 2FA in prod)*
4. Member logs in passwordless — email OTP (`/auth/sign-in/email-otp`); account-claim links them to their
   roster record by email.
5. A dues invoice exists for the member (dues config / generation).
6. Member taps **Pay now** on the dashboard dues tile — `mintMyPaymentLink` mints a single-use token → the
   member lands on the login-free `/pay/:token` page. *(or the officer sends a link via `sendPaymentLink`)*
7. Member checks out — `checkoutPaymentToken` opens the chapter's PayMongo session (GCash/card). **(G2 live)**
8. PayMongo webhook settles — `paymongoWebhook` (per-org, signature-verified, idempotent): payment completed,
   invoice paid, token used. **(G2 webhook registration)**
9. Member sees the receipt + updated dues; can open their **digital membership card** (QR) and **RSVP** to
   chapter events.

Every step except 7–8 (and the webhook) works without G2. Steps 7–8 are exactly what loading live keys +
registering the webhook unlocks.

---

## Known deferred items to revisit post-first-peso (engineering backlog)

- ~~Officer Connect-PayMongo UI~~ — **DONE** (v0.1.15.0, apps/org → Payment settings).
- Officer **publish-event / network-visibility** flow — B3 events are created `draft`+internal, so they don't
  yet appear in the B4 member events tile until published & network-visible.
- **Paid** event registration on the PayMongo rail (currently legacy Stripe + deferred).
- SMS (G3) wiring (above).
- Cross-source double-charge edge: an officer-sent link concurrent with a member self-mint can leave two
  active links for one invoice (the member self-mint path is guarded; the officer path is unchanged) — handled
  by the locked v1 manual-refund policy; tighten with a partial unique index if it ever bites.
- Member dues tile pays the first outstanding invoice only (fine for single annual dues; revisit for multi-invoice).
