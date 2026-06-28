# B5 Officer Connect-PayMongo UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** An officer Payment-settings screen in apps/org to connect a chapter's PayMongo account (public key + secret key + webhook secret), test it, and disconnect — replacing the `seed-paymongo-creds.ts` script. Works with test keys (no G2).

**Architecture:** The dues-gateway backend already exists (GET/PUT/DELETE/test under `/association/member/dues-gateway/{organizationId}`, admin + Treasurer/President). This adds the missing `webhookSecret` field to the request + handler, fixes a secret-leak in the read paths, regenerates the SDK, and builds the apps/org form over the (now complete) SDK fns.

**Tech Stack:** TypeSpec → OpenAPI → Hono, `@monobase/sdk-ts`, React + TanStack, `@monobase/ui`, sonner, vitest, bun.

## Global Constraints

- **Engine ADDITIVE + 1 security fix only.** Allowed files: `dues.tsp` (add `webhookSecret`), `upsertDuesGatewayConfig.ts`, `getDuesGatewayConfig.ts`, regenerated openapi/routes/validators/SDK, handler tests. No other engine logic.
- **Secret leak fix (security):** both `getDuesGatewayConfig` and `upsertDuesGatewayConfig` must strip **`encryptedSecret` AND `encryptedWebhookSecret`** from every response. `secretKey`/`webhookSecret` are write-only — never returned.
- **Encrypt** `webhookSecret` with `encryptCredential(body.webhookSecret, config.auth.secret)` → `encryptedWebhookSecret` (mirror the existing `secretKey` → `encryptedSecret` line). Never log plaintext.
- **`connected` unchanged:** upsert does NOT set `connected`; a successful `POST …/test` does. FE shows "saved — not yet verified" until tested.
- **Officer auth is server-enforced** (admin + Treasurer/President, 2FA in prod). FE shows the form; a 403 → friendly `role="alert"` (no crash).
- **FE secret discipline:** secret + webhook inputs are `type="password"`, never pre-filled from the server; the server never sends them back.
- **Regen + commit generated files** (CI git-diff gate). **No `/api` prefix** in routes; restart API after route changes (none new here — endpoints exist).
- **Confirm, don't invent:** SDK fn names (`getDuesGatewayConfig`, `upsertDuesGatewayConfig`, `disconnectDuesGateway`, `testDuesGatewayConnection`) + their option shapes + the `GatewayConfig`/response type — read `packages/sdk-ts/src/generated` before coding the FE.
- **Version:** v0.1.15.0 at ship.

---

### Task 1: Engine — `webhookSecret` field + leak fix + regen

**Files:**
- Modify: `specs/api/src/association/member/dues.tsp` (`GatewayConfigRequest` model)
- Modify: `services/api-ts/src/handlers/member/duesspecialassessments/upsertDuesGatewayConfig.ts`
- Modify: `services/api-ts/src/handlers/member/duesspecialassessments/getDuesGatewayConfig.ts`
- Generated: openapi/routes/validators + SDK (regen)
- Test: the existing handler tests for these two ops (find them — `*upsertDuesGateway*`/`*getDuesGateway*` test files), add the webhookSecret + no-leak assertions

- [ ] **Step 1: TypeSpec — add `webhookSecret`.** In `dues.tsp`, in `model GatewayConfigRequest`, after `secretKey`, add:
```tsp
  @doc("Webhook signing secret for the payment provider (write-only; never returned). Optional — keys can be set first, webhook later.")
  webhookSecret?: string;
```

- [ ] **Step 2: Build spec + generate.**
```bash
cd specs/api && bun run build
cd ../../services/api-ts && bun run generate
```
Confirm `UpsertDuesGatewayConfigBody` now includes optional `webhookSecret`.

- [ ] **Step 3: Handler — encrypt webhookSecret + strip both (upsert).** Edit `upsertDuesGatewayConfig.ts`:
  - After the existing `ciphertext` line, add (only when provided):
```ts
  const encryptedWebhookSecret = body.webhookSecret
    ? encryptCredential(body.webhookSecret, config.auth.secret)
    : undefined
```
  - In `insertRow`, add `...(encryptedWebhookSecret ? { encryptedWebhookSecret } : {})`.
  - In `onConflictDoUpdate.set`, add `...(encryptedWebhookSecret ? { encryptedWebhookSecret } : {})` (don't clobber an existing webhook secret with undefined when the officer updates only the keys).
  - Change the return strip to remove BOTH encrypted fields:
```ts
  const { encryptedSecret: _s, encryptedWebhookSecret: _w, ...safe } = result
  return ctx.json(safe, 200)
```

- [ ] **Step 4: Handler — strip both (GET, security fix).** Edit `getDuesGatewayConfig.ts` — change the strip:
```ts
  const body = config
    ? (() => {
        const { encryptedSecret: _s, encryptedWebhookSecret: _w, ...safe } = config
        return safe
      })()
    : {}
```

- [ ] **Step 5: Regen SDK.**
```bash
bun run --filter @monobase/sdk-ts generate
```
Confirm `UpsertDuesGatewayConfig` request type has optional `webhookSecret`.

- [ ] **Step 6: Tests (TDD-after for the existing handlers).** Find the existing tests for these handlers (grep `getDuesGatewayConfig`/`upsertDuesGatewayConfig` under `**/*.test.ts`). Add/extend cases:
  - upsert with `webhookSecret` → row has `encryptedWebhookSecret` set (decrypts back to the input via `decryptCredential`); response object has **neither** `encryptedSecret` nor `encryptedWebhookSecret`.
  - upsert WITHOUT `webhookSecret` (keys-only update) → does not clobber an existing `encryptedWebhookSecret`.
  - get → response has neither encrypted field (assert `encryptedWebhookSecret` is absent — the leak fix).
  Run:
```bash
cd services/api-ts && bun test duesGateway && bun run typecheck
```
Expected: green. (If no handler test files exist for these, create `upsertDuesGatewayConfig.test.ts` + `getDuesGatewayConfig.test.ts` mirroring a sibling handler test — the new-code-gate also wants `<handler>.test.ts` siblings if these handlers count as "new"; they're pre-existing, but adding the tests is correct regardless.)

- [ ] **Step 7: Commit.**
```bash
git add specs/ services/api-ts/src packages/sdk-ts/src/generated && git commit -m "feat(dues): gateway-config webhookSecret field + strip-both-secrets leak fix (B5)"
```

---

### Task 2: FE — Payment-settings screen

**Files:**
- Create: `apps/org/src/features/payment-settings/use-gateway-config.ts`
- Create: `apps/org/src/features/payment-settings/PaymentSettings.tsx`
- Create: `apps/org/src/routes/payment-settings.tsx`
- Modify: `apps/org/src/routeTree.gen.ts` (regen)
- Modify: the dashboard container that holds nav links (the events/announcements links live in `features/roster/Roster.tsx` per B3 — add a "Payment settings" link there)
- Test: `use-gateway-config.test.ts`, `PaymentSettings.test.tsx`

**Interfaces:**
- Consumes: `getDuesGatewayConfig`, `upsertDuesGatewayConfig`, `testDuesGatewayConnection`, `disconnectDuesGateway` from `@monobase/sdk-ts/generated`; `useSelectedOrg` from `@/features/org/use-org`; `@monobase/ui` (Card/Button/Input/Label); `toast` from sonner.

- [ ] **Step 1: Confirm SDK shapes.** Read `packages/sdk-ts/src/generated` for the four fns: their option shapes (`{ path: { organizationId } }`, upsert `body: { provider, publicKey, secretKey, webhookSecret? }`), and the GET response type (`GatewayConfig`-ish: `provider`, `publicKey`, `connected`, `lastTestAt?` — no secrets). Adjust the code below to the real names.

- [ ] **Step 2: Write failing hook test** — `use-gateway-config.test.ts`: mock the four SDK fns; assert `useGatewayConfig(orgId)` query calls `getDuesGatewayConfig({path:{organizationId:'org-1'}})`; `connect.mutate({publicKey,secretKey,webhookSecret})` calls `upsertDuesGatewayConfig` with `{path:{organizationId},body:{provider:'paymongo',publicKey,secretKey,webhookSecret}}`; `test`/`disconnect` call their fns; 403 → serverError thrown. Use `@/test-utils/mock-sdk` `ok()/err()`.

- [ ] **Step 3: Implement** — `use-gateway-config.ts`:

```ts
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import {
  getDuesGatewayConfig, upsertDuesGatewayConfig, testDuesGatewayConnection, disconnectDuesGateway,
} from '@monobase/sdk-ts/generated'
import { useSelectedOrg } from '@/features/org/use-org'

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

export interface GatewayStatus {
  provider?: string
  publicKey?: string
  connected?: boolean
  lastTestAt?: string | null
}

export function useGatewayConfig(orgId: string | null) {
  const qc = useQueryClient()
  const statusQuery: UseQueryResult<GatewayStatus> = useQuery({
    queryKey: ['gateway-config', orgId],
    enabled: !!orgId,
    retry: false,
    queryFn: async () => {
      const { data, response } = await getDuesGatewayConfig({ path: { organizationId: orgId! } })
      if (!response || !response.ok) throw new Error(`Gateway status failed: ${response?.status ?? '?'}`)
      return (data ?? {}) as GatewayStatus
    },
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['gateway-config', orgId] })

  const connect = useMutation({
    mutationFn: async (vars: { publicKey: string; secretKey: string; webhookSecret?: string }) => {
      if (!orgId) throw new Error('No organization selected.')
      const { data, error } = await upsertDuesGatewayConfig({
        path: { organizationId: orgId },
        body: { provider: 'paymongo', publicKey: vars.publicKey, secretKey: vars.secretKey, ...(vars.webhookSecret ? { webhookSecret: vars.webhookSecret } : {}) },
      })
      if (!data) throw new Error(serverError(error) ?? 'Could not save credentials.')
      return data
    },
    onSuccess: invalidate,
  })

  const test = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('No organization selected.')
      const { data, error } = await testDuesGatewayConnection({ path: { organizationId: orgId } })
      if (!data) throw new Error(serverError(error) ?? 'Connection test failed.')
      return data
    },
    onSuccess: invalidate,
  })

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('No organization selected.')
      const { data, error, response } = await disconnectDuesGateway({ path: { organizationId: orgId } })
      if (!response || !response.ok) throw new Error(serverError(error) ?? 'Could not disconnect.')
      return data
    },
    onSuccess: invalidate,
  })

  return { statusQuery, connect, test, disconnect }
}
```
> Confirm `upsertDuesGatewayConfig`'s `body.provider` type (a `GatewayProvider` enum — `'paymongo'` should be valid). If `disconnect` returns no body on 204, key off `response.ok` (above).

- [ ] **Step 4: Write failing component test** — `PaymentSettings.test.tsx`: mock `useGatewayConfig` + `useSelectedOrg` + sonner. Assert: not-connected state shows the form; connected state shows "Connected" + masked public key + lastTestAt; submitting the form calls `connect.mutate` with the entered values; secret + webhook inputs are `type="password"`; the webhook URL containing the orgId is rendered; Test + Disconnect call their mutations; a 403/error shows `role="alert"`; the server secret is never rendered (no `sk_` echoed).

- [ ] **Step 5: Implement** — `PaymentSettings.tsx` (mirror the B3 form house style; `Card`/`Input`/`Label`/`Button`, `role="alert"` on error, `min-h-[48px]`):
  - Read `statusQuery.data` → derive `connected`, masked `publicKey` (`pk_…` + last 4), `isTest = publicKey?.startsWith('pk_test_')`, `lastTestAt`.
  - 2FA/officer note up-front (mirror B3: "Requires a Treasurer or President with two-factor authentication enabled.").
  - Connect form: publicKey (`text`), secretKey (`password`), webhookSecret (`password`) → on submit `connect.mutate(...)` with `onSuccess` toast "Credentials saved — tap Test to verify" + clear the secret inputs; `onError` → alert.
  - Buttons: **Test connection** (`test.mutate`, toast result), **Disconnect** (confirm then `disconnect.mutate`).
  - **Webhook URL** block: compute the API host (reuse `API_BASE` from `@/lib/api`, strip a trailing `/api` if the host differs — prefer showing `${apiOrigin}/webhooks/paymongo/${orgId}`) + a copy button + the instruction line + the "test keys work without activation" note.
  - States: `statusQuery.isLoading` → skeleton; `isError` → ErrorState; no orgId → "Select an organization first."

- [ ] **Step 6: Route + nav.** Create `routes/payment-settings.tsx` (mirror `routes/events.tsx`: `createFileRoute('/payment-settings')`, back-to-dashboard Link, renders `<PaymentSettings/>`). Regen routeTree (`bun run build`, commit `routeTree.gen.ts`). Add a "Payment settings" `<Link to="/payment-settings">` in the dashboard nav (Roster.tsx, next to the events/announcements links).

- [ ] **Step 7: Run + typecheck.** `cd apps/org && bun run test -- "use-gateway-config|PaymentSettings" && bun run typecheck && bun run build 2>&1 | tail -5`. All green.

- [ ] **Step 8: Commit.** `git add -A apps/org && git commit -m "feat(org): Connect-PayMongo payment-settings screen (B5)"`

---

### Task 3: Contract + final verify

- [ ] **Step 1: Contract (Hurl).** Add/extend the dues-gateway contract: an officer PUTs gateway config **with a webhookSecret** → 200, and the response body contains **no** `encryptedSecret` / `encryptedWebhookSecret`; GET returns neither. Mirror the existing gateway/dues contract auth+seed (find it under `specs/api/tests/contract/`).

- [ ] **Step 2: Full verification.**
```bash
bun run typecheck
cd services/api-ts && bun test duesGateway      # the gateway handler tests green
cd apps/org && bun run test && bun run build     # org app + build green
bun run test:contract                            # contract suite (note any pre-existing unrelated fails)
```

- [ ] **Step 3: ADDITIVE check.** `git diff main -- services/api-ts/src specs/ packages/sdk-ts/src/generated --stat` — confirm only: `dues.tsp`, `upsertDuesGatewayConfig.ts`, `getDuesGatewayConfig.ts`, regenerated openapi/routes/validators/SDK, the handler tests. No other engine logic.

- [ ] **Step 4: Commit.** `git add -A && git commit -m "test(dues): gateway-config webhookSecret contract + final verify (B5)"`

---

## Self-Review

- **Spec coverage:** webhookSecret field + leak fix + regen (T1), FE settings screen (T2), contract + verify (T3). ✓
- **Security:** strip both encrypted fields in GET + upsert; secrets write-only + `type="password"`; encrypted at rest; officer + 2FA server-gated; `connected` = verified-by-test. All in T1/T2 + asserted in tests.
- **Placeholder scan:** none — full code/edits given; SDK-shape confirm steps are explicit read+adjust.
- **Type consistency:** `useGatewayConfig` (T2) returns `{statusQuery, connect, test, disconnect}` consumed by `PaymentSettings`; `GatewayStatus` is the stripped GET shape.
- **Risk notes:** (a) confirm `GatewayProvider` accepts `'paymongo'`; (b) `disconnect` may be 204 (key off `response.ok`); (c) the webhook URL host — use the API origin, not the SPA origin, if they differ; (d) don't clobber an existing webhook secret on a keys-only update (conditional set in upsert).
