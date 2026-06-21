# Production environment checklist (API)

Pre-deploy go/no-go for the Memberry API. Source of truth: `services/api-ts/src/core/config.ts`
(boot validation) + the officer-2FA gates. **Do not deploy to production until every
boot-blocking item is set and every silent-outage item is verified.**

Deploy path (see `.github/workflows/deploy.yml`): API ships as a Docker image to **Railway**
(`railway up --service memberry-api --environment production`); frontends to **Cloudflare
Pages**. App env vars are **not** in the workflow — they are configured on the **Railway
`production` environment** (service variables). Production deploy is **manual**
(`workflow_dispatch` → environment: production); staging auto-deploys on push to `main`.
Both run a `/readyz` health check (db + storage + jobs) and a smoke test.

---

## 0. The single most important variable

| Var | Value | Why |
|---|---|---|
| `NODE_ENV` | `production` | **The only predicate that turns on every prod guard below** (`config.ts:250,332` + officer-2FA + secret accessors). It defaults to `development` (`config.ts:128`). If it is unset or misspelled, *all* "required in production" checks silently pass and the API boots with insecure dev defaults (forgeable invite/payment tokens, `minioadmin` storage, localhost CORS). There is no `APP_ENV`. **Confirm `NODE_ENV=production` is actually present in the Railway production environment first.** |

---

## 1. Boot-blocking (API crash-loops in prod without these)

Missing/invalid → `parseConfig()` throws `Invalid environment configuration: …` at startup →
container never serves → `/readyz` never returns 200 → deploy health check fails after 150s.
The deploy pipeline catches these, but a crash-loop is a bad way to find out — set them up front.

| Var | Rule | Breaks if wrong | config.ts |
|---|---|---|---|
| `AUTH_SECRET` | Required in **every** env (≥32 hex recommended: `openssl rand -hex 32`) | API won't boot; also the fallback key for WebRTC call signing | `:241-249` |
| `DATABASE_URL` | Required in prod | API won't boot (dev fallback `postgres://…localhost` only applies off-prod) | `:251-257` |
| `INTERNAL_SERVICE_TOKEN` | Required in prod (CSV supports zero-downtime rotation) | API won't boot; in dev a random per-process UUID is used, which breaks cross-instance expand calls | `:258-264` |
| `INVITE_TOKEN_SECRET` | Required in prod **and ≠** `dev-secret-change-in-production` | API won't boot; if it were the dev default, invite **and dues payment tokens** would be forgeable with a public constant | `:265-273` |
| `UNSUBSCRIBE_SECRET` | Required in prod **and ≠** `dev-unsub-secret-change-in-production` | API won't boot; forgeable unsubscribe links otherwise | `:274-282` |
| `STORAGE_ACCESS_KEY_ID` | Must **≠** `minioadmin` in prod | API won't boot — default MinIO cred must never reach prod | `:283-289` |
| `STORAGE_SECRET_ACCESS_KEY` | Must **≠** `minioadmin` in prod | API won't boot | `:291-296` |
| `CORS_ALLOW_TUNNELING` | Must be falsy/unset in prod | API won't boot — tunnel origins forbidden | `:299-304` |
| `CORS_ALLOW_LOCAL_NETWORK` | Must be falsy/unset in prod | API won't boot — local-network origins forbidden | `:306-311` |

> `PAYMENT_TOKEN_SECRET` is **optional** — `getPaymentTokenSecret()` falls back to
> `INVITE_TOKEN_SECRET` (`handlers/member/duesspecialassessments/utils/payment-token.ts:50`).
> Setting `INVITE_TOKEN_SECRET` covers one-tap dues pay links. Set `PAYMENT_TOKEN_SECRET`
> separately only if you want a distinct key.

---

## 2. Silent outages (boot succeeds, `/readyz` passes, but features are broken)

These are the dangerous ones — the health check will **not** catch them.

| Var / gate | Set to | If wrong | Source |
|---|---|---|---|
| `CORS_ORIGINS` | Exact prod frontend origins (CSV), e.g. `https://app.memberry.ph,https://admin.memberry.ph` | Unset → silently falls back to `localhost:3003/3004` (only a `console.warn`). This list is **also the CSRF allowlist** (`app.ts:255`), so wrong origins = every browser mutation rejected + CORS-blocked. | `config.ts:150,347` |
| `STORAGE_PUBLIC_ENDPOINT` | Browser-reachable storage URL; **must differ** from the internal `STORAGE_ENDPOINT` in containerized prod | Presigned upload/download URLs are signed with the public endpoint (`core/storage.ts:109,128`). If left at the internal host (e.g. `http://minio:9000`), **all browser uploads/downloads fail** — no error at boot. | `config.ts:185`, `storage.ts:62-80` |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Real live keys | Lazy-throw at first billing call / webhook verification (`core/billing.ts:64,466`) — not at boot. Online payments + webhooks dead. | `config.ts:210-211` |
| Stripe event metadata | Every PaymentIntent must carry `orgId` in metadata | Webhook resolves org to empty string → downstream rejects → **event dead-letters** (`handlers/member/duesspecialassessments/stripeWebhook.ts:31`). Known prior bug. | — |
| Officer 2FA | Privileged officers (President / Treasurer / Secretary) enroll 2FA **before** go-live | Hard-on in prod with **no env toggle** (`core/auth/officer-checks.ts:52-53`). Without 2FA those officers get **403** on every privileged route — roster CSV import, governance, dues. | `officer-checks.ts`, `middleware/require-position.ts:77` |
| Email provider | If `EMAIL_PROVIDER=postmark` → `POSTMARK_API_KEY`; if `onesignal` → `ONESIGNAL_APP_ID`+`ONESIGNAL_API_KEY` | Default `smtp` points at `127.0.0.1:1025` → **no real mail sent** in prod. Provider-specific keys lazy-throw. | `config.ts:194-207` |

---

## 3. Deploy pipeline secrets (GitHub, not the API container)

Set per-environment in GitHub repo settings (Secrets / Variables):

- Secrets: `RAILWAY_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Variables: `PRODUCTION_API_URL` (and `STAGING_API_URL`) — without these the health check / smoke steps skip silently.

---

## 4. Verification — prod boot smoke (reproducible)

The fail-fast surface is `parseConfig()`'s `superRefine`. Verified 2026-06-21 by driving
`parseConfig()` under controlled env (results below). To re-run: a throwaway script that
deletes the relevant keys, sets a profile, and calls `parseConfig()` (see this doc's git
history / the post-merge-backlog ledger).

```
[prod-missing]      THREW: Invalid environment configuration: DATABASE_URL (Required in production),
                    INTERNAL_SERVICE_TOKEN (Required in production), INVITE_TOKEN_SECRET (Required in
                    production), UNSUBSCRIBE_SECRET (Required in production), STORAGE_ACCESS_KEY_ID
                    (Must not be the default minioadmin credential in production),
                    STORAGE_SECRET_ACCESS_KEY (Must not be the default minioadmin credential in production)
[prod-dev-defaults] THREW: … INVITE_TOKEN_SECRET (Must not be the insecure dev default in production),
                    UNSUBSCRIBE_SECRET (…), STORAGE_ACCESS_KEY_ID (…), STORAGE_SECRET_ACCESS_KEY (…)
[prod-complete]     NO THROW          ← clean boot with a full prod env set
[dev-no-authsecret] THREW: … AUTH_SECRET (AUTH_SECRET environment variable is required …)
```

The deploy pipeline additionally proves a real container boot: `ci.yml` `build-api` runs the
prod Docker image and polls `/livez`; `deploy.yml` health-checks `/readyz?verbose` (db +
storage + jobs) and smoke-tests `/livez`, `/readyz`, `/api/auth/session` after each deploy.

## 5. Go / no-go

1. `NODE_ENV=production` present on the Railway production environment.
2. All §1 boot-blocking vars set (no dev defaults, no `minioadmin`, CORS prod flags off).
3. All §2 silent-outage items verified — especially `CORS_ORIGINS`, `STORAGE_PUBLIC_ENDPOINT`,
   real Stripe keys + `orgId` in PaymentIntent metadata, privileged officers' 2FA enrolled.
4. §3 GitHub secrets/vars present.
5. **Deploy to staging first** (auto on push to `main`); confirm staging `/readyz?verbose`
   `status:pass` + smoke green before the manual production `workflow_dispatch`.
