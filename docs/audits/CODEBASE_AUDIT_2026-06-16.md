# Memberry Codebase Audit — Security, Quality, Test Coverage

**Date:** 2026-06-16
**Scope:** `services/api-ts` (840 src / 615 test files), `apps/memberry` (355 src / 143 e2e specs), `specs/api` Hurl contracts (157 files)
**Method:** 3 parallel auditor agents (security / quality / tests), grep+read confirmation, headline findings manually re-verified against source.

---

## Overall Grade: **B−**

Strong structural foundations and real engineering discipline (clean typecheck, zero `@ts-ignore`, zero TODO debt, meaningful auth-gate tests after a prior fake-green remediation). Pulled down by a cluster of **cross-tenant IDOR gaps in the storage module**, **secret-handling that bypasses validated config**, **permissive CORS defaults**, an **800-occurrence `any` debt**, and **two zero-coverage high-risk areas** (`dues`, `association:operations` handlers).

| Dimension | Grade | One-line |
|---|---|---|
| Security | **C+** | No live-exploitable CRITICAL, but multiple confirmed cross-tenant IDOR + secret/config drift. |
| Code Quality | **B−** | Disciplined (clean typecheck, no suppressions) but heavy `any` debt + 6,712 lint warnings + a dead stub. |
| Test Coverage | **B** | Good density overall; two zero/low-coverage high-risk modules. |

---

## 1. Security — Grade C+

**Posture:** Good primitives (Drizzle parameterization, double-submit CSRF, timing-safe HMAC, Stripe webhook signature verification, TypeSpec-generated validators). No SQL injection found. The weak spots are **authorization (cross-tenant IDOR in storage)** and **secret/config hygiene** — handlers reading `process.env` directly with public fallback defaults instead of going through validated config.

### Must-fix

| # | Sev | Finding | Location |
|---|---|---|---|
| 1 | **HIGH** | Storage IDOR: `completeFileUpload` / `getFileDownload` / `deleteFile` check `owner`/`admin` but **never check `file.organizationId === ctx.organizationId`**. An admin in Org A can download/delete/finalize Org B files by UUID. | `handlers/storage/{completeFileUpload,getFileDownload,deleteFile}.ts` |
| 2 | **HIGH** | `completeFileUpload` guard is `if (user && file.owner !== user.id && user.role !== 'admin')` — a **falsy `user` skips the check entirely**. Latent unauth bypass if route middleware ever drops. Use `if (!user) throw Unauthorized` at top. | `handlers/storage/completeFileUpload.ts:46` |
| 3 | **HIGH** | Invite-token HMAC secret read as `process.env['INVITE_TOKEN_SECRET'] \|\| 'dev-secret-change-in-production'` in 4 handlers, bypassing validated config. **Mitigated** by `config.ts:235` rejecting the default at prod startup — so risk is dev-prod parity / config drift, not a live forgery vector. Still: thread `config.invite.tokenSecret`, drop the literal fallback. | `handlers/invite/{createInvite,validateInvite,claimInvite,bulkImportMembers}.ts` |
| 4 | **HIGH** | Permissive CORS schema defaults: `CORS_ALLOW_TUNNELING=true`, `CORS_ALLOW_LOCAL_NETWORK=true`, `CORS_STRICT=false`. With `credentials:true`, tunnel/localhost origins accepted (warn-only, no startup fail). Flip defaults to `false`; fail-fast in prod. | `core/config.ts:142` |
| 5 | **MED** | `UNSUBSCRIBE_SECRET` same `?? 'dev-unsub-secret-change-in-production'` fallback — forgeable unsubscribe tokens could suppress compliance comms (renewal/dues). | `handlers/email/utils/unsub-token.ts:22` |
| 6 | **MED** | PayMongo webhook secrets (`PAYMONGO_SECRET_KEY/_WEBHOOK_SECRET`) read from `process.env`, **not in config schema** → no prod validation, silent 503 webhook death. | `handlers/member/duesspecialassessments/handlePaymentWebhook.ts:14` |
| 7 | **MED** | Presigned-upload MIME is client-supplied; allowlist on request only — client can PUT HTML as `image/png`. Serve user files via `Content-Disposition: attachment` proxy. | `handlers/storage/uploadFile.ts`, `core/storage.ts:105` |
| 8 | **MED** | Default credentials ship in source and only warn (non-fatal) in prod: `STORAGE_*=minioadmin`, `DATABASE_URL=…:password@…`. Fail-fast instead. | `core/config.ts:174,317` |
| 9 | **LOW** | PayMongo webhook does not validate `event.amount >= invoice.amount` before `markPaid` (underpayment defense-in-depth). | `handlePaymentWebhook.ts` |

---

## 2. Code Quality — Grade B−

| Metric | Value |
|---|---|
| Typecheck | ✅ **PASS** (5/5 workspaces) |
| `@ts-ignore` | **0** |
| `@ts-expect-error` | **1** (legit) |
| TODO / FIXME / HACK | **0 / 0 / 0** |
| `any` (non-test) | **~689** across 209 files (246 api-ts, 443 frontend) |
| Lint | 0 errors / **6,712 warnings** (all in `@monobase/api-ts`) |
| `console.log` (api-ts, non-test/seed) | **~38** (bypass Pino, lose trace IDs) |
| Files > 500 lines | 17 backend + 5 frontend |

### Top issues
1. **Dead stub — silent correctness bug.** `utils/identity-matching.ts:44-80` `findIdentityMatches` returns `[]` unconditionally; real DB query commented out. Callers silently get no matches. **Fix first.**
2. **`any` saturation** — 246 api-ts + 443 frontend. Highest-risk: `middleware/validation.ts:13` accepts `any` Zod result (malformed validation output passes through). Defeats Drizzle's typed query builder in `booking` repos + much of `core/`.
3. **6,712 lint warnings** bury real signal (`no-unused-vars` on the dead stub, `no-explicit-any` in `utils/expand.ts`, `utils/query.ts`). Triage to zero-warning baseline.
4. **God files:** `handleStripeWebhook.ts` (1,007 lines, all event types in one fn — billing blast radius), `core/domain-event-consumers.ts` (1,782 lines), `app.ts` (689).
5. **~38 `console.log`** in handler/core code → route through Pino.
6. **Verb-convention drift** (11 files): `set*` → `update*`, `download*` → `get*`, etc.
7. **Inconsistent error shapes** — several handlers return ad-hoc `c.json({error},4xx)` bypassing the OpenAPI error schema (`updateScheduleException.ts`, `stripeWebhook.ts`, `listEmailSuppressions.ts`).

---

## 3. Test Coverage — Grade B

Solid unit density in high-risk modules (billing 1.28, platformadmin 0.93, person 0.90, documents 1.33). Auth-gate tests were **meaningfully fixed** (FIX-007) to bind real enforcement primitives. Deletion-cascade + Stripe webhook covered. 157 Hurl contract files. `.only`: **0**. `.skip`: 14 backend / 21 e2e (mostly conditional seed guards).

### Worst gaps by risk
| # | Gap | Risk |
|---|---|---|
| 1 | **`handlers/dues/` — 0 test files.** `payment-token.repo`, `dues-payments.repo` untested. | HIGH (money) |
| 2 | **`association:operations` — 32 tests for 83 src.** ~20 top-level handlers untested: `createEvent`, `createCheckIn`, `createTrainingEnrollment`, `createCommittee`, `createQuizAttempt`, registration cancels. | HIGH (state-mutating) |
| 3 | E2E: officer settings sub-routes (CPD config, gateway, membership-categories, chapters, providers) — **no e2e**. Officers configure payments here. | HIGH |
| 4 | E2E: `/settings/account`, `/settings/security` (PII pages) — no e2e. | MED |
| 5 | E2E: `/messages`, `/messages/dm` (WebSocket UI) — no e2e. | MED |
| 6 | 21 e2e conditional skips hide real flows (member transfer ×5, event-registration cancel ×4) when seed missing in CI. | MED |
| 7 | `association:member` ratio 0.52 (23/44) on memberships/elections/credentials. | MED |

E2E reach: **40 unique routes** via `page.goto` vs ~50+ route files.

---

## Prioritized Remediation

**P0 — security (this week)**
1. Add `organizationId` scoping to all 3 storage handlers (#1).
2. Replace `if (user && …)` → `if (!user) throw Unauthorized` in `completeFileUpload` (#2).
3. Flip CORS tunneling/local-network defaults to `false`, fail-fast in prod (#4).

**P1 — correctness + config**
4. Fix the dead `findIdentityMatches` stub (quality #1).
5. Thread invite + unsubscribe + PayMongo secrets through validated config; drop literal fallbacks; fail-fast on default creds (#3,5,6,8).
6. Add `dues` repo unit tests + `association:operations` handler tests (tests #1,2).

**P2 — quality hygiene**
7. Drive lint warnings to a zero baseline; replace `console.log` with Pino.
8. Burn down `any` in `middleware/validation.ts` and booking repos.
9. Split `handleStripeWebhook.ts` per-event; add officer-settings + account-settings e2e.

**Net:** ship-capable codebase with disciplined fundamentals. Close the storage IDOR cluster and the dues/operations test gaps and this moves to a solid **B+**.
