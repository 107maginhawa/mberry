# Wave B / B5 — Officer Connect-PayMongo UI

**Date:** 2026-06-28 · **Apps:** apps/org + engine (small additive) · **Version:** v0.1.15.0
**Engine status:** ADDITIVE + one security fix. The dues-gateway endpoints already exist; this adds a
`webhookSecret` field to the request and fixes a secret-leak in the read paths. No other engine logic changes.

## Goal

Replace the `seed-paymongo-creds.ts` script (no UI) with an officer-facing **Payment settings** screen in
apps/org: a Treasurer/President pastes their chapter's PayMongo public key + secret key + webhook secret,
sees connection status + the exact webhook URL to register, can **Test** the connection and **Disconnect**.
Works with **test keys** (no G2 / live activation needed) so the pilot can dogfood the full dues→checkout
flow immediately.

## What exists (recon, verified vs handler source)

The backend is already built (TypeSpec `DuesGatewayManagement` in `specs/api/src/association/member/dues.tsp`;
handlers in `handlers/member/duesspecialassessments/`):
- `GET /association/member/dues-gateway/{organizationId}` → `getDuesGatewayConfig` — returns the config with
  `encryptedSecret` stripped. Auth: `association:admin`.
- `PUT /association/member/dues-gateway/{organizationId}` → `upsertDuesGatewayConfig` — encrypts `secretKey` →
  `encryptedSecret`, upserts. Auth: `association:admin` + `x-require-position ["Treasurer","President"]`.
- `DELETE …` → `disconnectDuesGateway`. `POST …/test` → `testDuesGatewayConnection`.
- Schema `dues_gateway_config` already has `encryptedWebhookSecret` + `connected` + `lastTestAt`.
- Encryption: `encryptCredential(plaintext, config.auth.secret)` (AES-256-GCM) in `core/gateway.ts`.
- All four ops are already in the SDK (TypeSpec-sourced).

**Two real gaps:**
1. `GatewayConfigRequest` (TypeSpec) has `provider`, `publicKey`, `secretKey` but **no `webhookSecret`** —
   so the per-org webhook secret can't be set via the API today (only via the seed script). The webhook is
   required for settlement, so this field is needed.
2. **Secret leak:** `getDuesGatewayConfig` (and `upsertDuesGatewayConfig`'s return) strip only
   `encryptedSecret`, NOT `encryptedWebhookSecret`. Today that's harmless (the column is never populated via
   API), but the moment we let officers set it, the GET would echo the encrypted webhook secret. **Fix: strip
   both in both handlers.**

## Design

### Engine (additive + security fix)
- **TypeSpec:** add `@doc("...write-only; never returned") webhookSecret?: string;` to `GatewayConfigRequest`
  in `dues.tsp`. (Optional — an officer might set keys first, webhook later.)
- **`upsertDuesGatewayConfig.ts`:** if `body.webhookSecret` present, `encryptCredential` it →
  `encryptedWebhookSecret` (conditional, both insert + set). **Set `connected: true`** (insert + set) — this is
  the C1 fix: checkout requires `connected=true` (`resolve-gateway.ts:52`), and the working seed sets it on
  upsert. Strip **both** `encryptedSecret` AND `encryptedWebhookSecret` from the returned object.
- **`getDuesGatewayConfig.ts`:** strip **both** encrypted fields (security fix — currently leaks `encryptedWebhookSecret`).
- **`testDuesGatewayConnection.ts`:** make it a REAL check — decrypt the stored secret, hit a minimal
  authenticated PayMongo endpoint (add `verifyCredentials()` to the adapter if absent). Success → `connected:true`,
  `lastTestAt:now`, `{success:true, testedAt}`; auth failure → `connected:false`, `lastTestAt:now`,
  `{success:false, testedAt}`; no config → `{success:false}` (not a 500). (`GatewayTestResult` requires `testedAt`.)
- Regen openapi/routes/validators + SDK.
- **`connected` semantics:** upsert sets `connected: true` (creds present → usable immediately, matching the
  seed). The **Test connection** button is a real PayMongo validation that downgrades `connected` to false if
  the keys are invalid. So the dues→checkout flow works right after connecting (test keys included), and Test
  catches bad keys.

### FE (apps/org)
- New authed route `routes/payment-settings.tsx` (officer; server enforces admin + Treasurer/President + 2FA
  in prod → 403 surfaces as a friendly `role="alert"`, same class as B3).
- `features/payment-settings/use-gateway-config.ts`: `useQuery` (getDuesGatewayConfig) + mutations for
  upsert / test / disconnect (the generated SDK fns).
- `features/payment-settings/PaymentSettings.tsx`:
  - **Status:** "Connected ✓" / "Not connected"; the public key shown **plain** (non-secret); `lastTestAt`
    if present; whether the keys are **test or live** (derive from the `pk_test_` / `pk_live_` prefix).
  - **Connect form:** provider fixed to `paymongo`; inputs for public key, secret key, webhook secret
    (secret + webhook are `type="password"`, write-only — never pre-filled from the server). Submit → PUT.
  - **Test connection** button → POST …/test → toast result + refetch status.
  - **Disconnect** button (confirm) → DELETE → refetch.
  - **Webhook URL to register** shown prominently with a copy affordance: `<API-host>/webhooks/paymongo/<orgId>`
    + a one-line instruction ("Add this in PayMongo → Developers → Webhooks, event `payment.paid`"). Use the
    configured API base, not `window.origin` blindly.
  - A note that **test keys (`pk_test_`/`sk_test_`) work end-to-end with no live activation** — so the pilot
    can verify before G2.
- Dashboard nav link "Payment settings".

## Security invariants (opus review MUST verify)

1. `secretKey` + `webhookSecret` are **write-only** — never returned by GET or the upsert response (strip both
   encrypted columns). The FE never renders them back; secret inputs are `type="password"`, never pre-filled.
2. Both are stored **encrypted** (`encryptCredential` / `config.auth.secret`) — never plaintext, never logged.
3. Officer-gated server-side (admin + Treasurer/President; 2FA in prod). FE shows the form but the engine is
   the gate; 403 → friendly alert (no crash).
4. `connected=true` is set on upsert (creds present → usable, matches the seed); the **Test** button validates
   the keys against PayMongo and downgrades `connected` to false on auth failure, so a green "Connected" that
   passed Test is genuinely verified. (`test` must not 500 on a missing config.)
5. The webhook URL shown is informational; registering it in PayMongo is a manual founder step (documented).

## Money / a11y

- No money math on this screen. Public key shown plain (non-secret; no masking).
- a11y (DESIGN.md): 18px, ≥48px tap, labeled inputs, `type="password"` for secrets, errors `role="alert"`,
  copy-webhook-URL button labeled, one primary task (connect) per screen, sonner toasts.

## Testing (anti-false-green)

- **Engine handler tests:** `upsertDuesGatewayConfig` encrypts `webhookSecret` → `encryptedWebhookSecret` and
  the response contains **neither** `encryptedSecret` nor `encryptedWebhookSecret`; `getDuesGatewayConfig`
  response contains neither encrypted field (the security fix — assert `encryptedWebhookSecret` absent). Use
  the createScratch real-PG harness or the existing handler-test pattern for these endpoints.
- **FE:** `use-gateway-config` calls the right SDK fns with `{path:{organizationId}}` + body; `PaymentSettings`
  shows connected/not-connected/saved-not-verified states, submits the form (secret inputs are password type),
  Test + Disconnect call their fns, 403 → role=alert, webhook URL rendered with the org id, no secret echoed.
  Mocks anchored via `@/test-utils/mock-sdk` `ok()/err()`.
- Typecheck includes tests. Regenerated SDK committed (CI git-diff gate). Contract: a Hurl case for PUT with a
  webhookSecret → 200, response has no encrypted fields.

## Engine ADDITIVE invariant

`git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated` contains ONLY: `dues.tsp`
(`webhookSecret` field), `upsertDuesGatewayConfig.ts` (encrypt webhookSecret + `connected:true` + strip both),
`getDuesGatewayConfig.ts` (strip both), `testDuesGatewayConnection.ts` (real verify + set connected/lastTestAt),
`paymongo.adapter.ts` (add `verifyCredentials` if absent), regenerated openapi/routes/validators/SDK, and the
handler tests. No other handler/schema change.

## Out of scope (flagged)

- Editing the webhook in PayMongo (manual dashboard step — we show the URL).
- A "connected" badge driven by live polling (we rely on the explicit Test button).
- Multi-provider (Stripe etc.) — provider fixed to `paymongo` for v1.
