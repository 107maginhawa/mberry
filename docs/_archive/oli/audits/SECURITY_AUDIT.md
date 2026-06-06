# Security Posture Report -- Memberry AMS

**Date:** 2026-05-26
**Mode:** Daily (8/10 confidence gate)
**Scope:** Full audit (Phases 0-14)
**Branch:** `audit/codebase-improvements`
**Auditor:** /cso v2 (AI-assisted, not a substitute for professional penetration testing)

---

## Architecture Mental Model

**Stack:** Bun + TypeScript monorepo
**Framework:** Hono (API), Vite + TanStack Router (frontend)
**ORM:** Drizzle (PostgreSQL)
**Auth:** Better-Auth with email OTP, passkeys, magic link, 2FA, API keys, bearer tokens
**Payments:** Stripe Connect (billing module) + PayMongo (dues/membership payments)
**Storage:** S3/MinIO via @aws-sdk/client-s3
**Notifications:** OneSignal (push, email)
**Deploy:** Railway (API Docker), Cloudflare Pages (frontends), GitHub Actions CI/CD

**Trust boundaries:**
1. Internet -> Cloudflare Pages (static frontends) -> API (Hono on Railway)
2. API -> PostgreSQL (Drizzle ORM, parameterized queries)
3. API -> S3/MinIO (presigned URLs)
4. API -> Stripe / PayMongo (server-to-server with secrets)
5. API -> OneSignal (server-to-server with API key)
6. Public webhook endpoints: PayMongo payment webhooks, Stripe webhooks (planned)
7. Public endpoints: certificate verification, credential lookup, event OG meta, payment tokens

**Data sensitivity:** Healthcare association PII (names, DOB, addresses, phone, email), payment data (Stripe/PayMongo), medical credential/CPD records, election ballots.

---

## Attack Surface Map

```
ATTACK SURFACE MAP
==================
CODE SURFACE
  Public endpoints:      ~8 (unauthenticated: health, OG meta, cert verify, credential lookup, payment tokens, public orgs)
  Authenticated:         ~200+ (require login via Better-Auth)
  Admin-only:            ~25 (platform admin + officer auth middleware)
  API endpoints:         ~300+ (across 25 handler directories)
  File upload points:    6 (S3/MinIO presigned URL flow)
  External integrations: 4 (Stripe, PayMongo, OneSignal, SMTP/Postmark)
  Background jobs:       Yes (pg-boss for booking, webhook retry)
  WebSocket channels:    11 (comms module -- video, chat)

INFRASTRUCTURE SURFACE
  CI/CD workflows:       4 (ci.yml, contract.yml, deploy.yml, monitor.yml)
  Webhook receivers:     2 (PayMongo payment, Stripe billing -- planned)
  Container configs:     2 (Dockerfile, docker-compose.deps.yml for local dev)
  IaC configs:           0 (Railway managed)
  Deploy targets:        2 (Railway API, Cloudflare Pages frontends)
  Secret management:     Environment variables (Railway secrets + GitHub Actions secrets)
```

---

## Security Findings

```
SECURITY FINDINGS
=================
#   Sev    Conf   Status      Category         Finding                                    Phase  OWASP
--  ----   ----   ------      --------         -------                                    -----  -----
1   HIGH   9/10   VERIFIED    Crypto           PayMongo webhook uses non-constant-time    P6     A02
                                                string comparison
2   HIGH   9/10   VERIFIED    Config           CORS defaults to wildcard ['*'] origins    P9     A05
3   HIGH   8/10   VERIFIED    Config           Auth secret fallback to hardcoded          P2     A02
                                                'development-secret-change-in-production'
4   HIGH   8/10   VERIFIED    CI/CD            All GitHub Actions use tag refs, not        P4     A08
                                                SHA-pinned versions
5   HIGH   8/10   VERIFIED    Container        Dockerfile runs as root (no USER           P5     A05
                                                directive)
6   MEDIUM 8/10   VERIFIED    Config           Rate limiter disabled in dev/test           P9     A04
                                                environments
7   MEDIUM 8/10   VERIFIED    Data             PII stored in plaintext (no application-   P11    A02
                                                layer encryption)
```

### Finding 1: PayMongo Webhook Signature Uses Non-Constant-Time Comparison

* **Severity:** HIGH
* **Confidence:** 9/10
* **Status:** VERIFIED
* **Phase:** 6 -- Webhook & Integration Audit
* **Category:** Cryptographic Failures (OWASP A02)
* **File:** `services/api-ts/src/handlers/association:member/utils/paymongo.adapter.ts`

**Description:**
The `verifyWebhook` method compares the HMAC signature using `sig !== expected` (JavaScript string equality). This is vulnerable to timing attacks -- an attacker can determine the correct HMAC one character at a time by measuring response times.

**Motivating code:**
```typescript
const expected = createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
if (sig !== expected) return null;
```

**Exploit scenario:**
1. Attacker sends crafted webhook payloads to the public `/association/member/webhooks/payment` endpoint
2. Attacker measures response time differences as they guess each byte of the HMAC
3. After sufficient samples, attacker reconstructs the valid HMAC
4. Attacker forges payment confirmation webhooks to mark invoices as paid without actual payment

**Impact:** Forged payment confirmations. Members could appear paid without actual payment processing.

**Recommendation:**
```typescript
import { timingSafeEqual } from 'crypto';

const expected = createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
const sigBuf = Buffer.from(sig, 'hex');
const expectedBuf = Buffer.from(expected, 'hex');
if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
```

Note: The internal service token comparison in `auth.ts` already uses `timingSafeEqual` correctly. Apply the same pattern here.

---

### Finding 2: CORS Defaults to Wildcard Origins

* **Severity:** HIGH
* **Confidence:** 9/10
* **Status:** VERIFIED
* **Phase:** 9 -- OWASP A05 (Security Misconfiguration)
* **Category:** Security Misconfiguration
* **File:** `services/api-ts/src/core/config.ts:189`

**Description:**
When `CORS_ORIGINS` is not set, the default is `['*']` (wildcard). Combined with `credentials: true`, this allows any origin to make authenticated requests. The config also logs a warning when wildcard is used in production, but does not block it.

**Motivating code:**
```typescript
origins: parseList(process.env['CORS_ORIGINS'], ['*']),
```

And at line 131:
```typescript
if (process.env['CORS_ORIGINS'] === '*' || !process.env['CORS_ORIGINS']) {
  // logs warning but does not throw
}
```

**Exploit scenario:**
1. Attacker hosts malicious page at `evil.com`
2. If CORS_ORIGINS is unset in production, the API allows cross-origin requests with credentials from `evil.com`
3. Victim visits `evil.com` while logged into Memberry
4. Attacker's JS makes authenticated API calls on behalf of the victim, exfiltrating PII or modifying data

**Impact:** Cross-origin data theft, unauthorized API actions on behalf of authenticated users.

**Recommendation:**
Change the production guard to fail-fast when CORS_ORIGINS is wildcard or unset:
```typescript
if (isProduction && (!process.env['CORS_ORIGINS'] || process.env['CORS_ORIGINS'] === '*')) {
  missing.push('CORS_ORIGINS (must not be wildcard in production)');
}
```

---

### Finding 3: Auth Secret Fallback to Hardcoded Development Value

* **Severity:** HIGH
* **Confidence:** 8/10
* **Status:** VERIFIED
* **Phase:** 2 -- Secrets Archaeology
* **Category:** Cryptographic Failures (OWASP A02)
* **File:** `services/api-ts/src/core/config.ts:205`

**Description:**
When `AUTH_SECRET` is not set, the code falls back to `'development-secret-change-in-production'`. The production guard does check for `AUTH_SECRET` and fails if missing, so this only affects dev/test. However, if `NODE_ENV` is misconfigured (e.g., left as default), sessions would be signed with a known secret.

**Motivating code:**
```typescript
secret: authSecret || 'development-secret-change-in-production',
```

The production guard at line 119-120 does check:
```typescript
if (isProduction) {
  if (!authSecret) missing.push('AUTH_SECRET');
}
```

**Exploit scenario:**
1. Server deployed without `NODE_ENV=production` set (defaults to `'development'`)
2. `AUTH_SECRET` not configured
3. Attacker knows the default secret and forges valid session tokens
4. Attacker impersonates any user, including admins

**Impact:** Full authentication bypass if production guard is circumvented by missing NODE_ENV.

**Recommendation:**
Add a secondary guard: if `AUTH_SECRET` equals the hardcoded default and any production-like indicator is present (DATABASE_URL points to non-localhost, SERVER_PUBLIC_URL is set), throw immediately:
```typescript
if (authSecret === 'development-secret-change-in-production' && process.env['DATABASE_URL']?.includes('railway')) {
  throw new Error('AUTH_SECRET is set to the development default on what appears to be a production database');
}
```

---

### Finding 4: GitHub Actions Not SHA-Pinned

* **Severity:** HIGH
* **Confidence:** 8/10
* **Status:** VERIFIED
* **Phase:** 4 -- CI/CD Pipeline Security
* **Category:** Software and Data Integrity (OWASP A08)
* **Files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/contract.yml`, `.github/workflows/monitor.yml`

**Description:**
All 40+ GitHub Action `uses:` references use mutable tag refs (`@v4`, `@v3`, `@v7`) instead of SHA-pinned versions. This includes security-sensitive actions that handle credentials (`docker/login-action`, `docker/build-push-action`).

**Motivating code examples:**
```yaml
uses: actions/checkout@v4
uses: docker/login-action@v3       # handles GITHUB_TOKEN
uses: docker/build-push-action@v6  # pushes container images
uses: oven-sh/setup-bun@v2
uses: actions/github-script@v7     # executes arbitrary JS with GITHUB_TOKEN
```

**Exploit scenario:**
1. Attacker compromises a third-party action's GitHub account (or a tag is force-pushed)
2. Malicious code executes in CI with access to `GITHUB_TOKEN`, `RAILWAY_TOKEN`, `CLOUDFLARE_API_TOKEN`
3. Attacker exfiltrates secrets, injects backdoors into deployed artifacts, or deploys malicious code

**Impact:** Supply chain compromise of CI/CD pipeline, credential theft, code injection into production deployments.

**Recommendation:**
Pin all actions to full commit SHAs. Use Dependabot or Renovate to keep them updated:
```yaml
# Before
uses: actions/checkout@v4
# After
uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.7
```

Add to `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

---

### Finding 5: Docker Container Runs as Root

* **Severity:** HIGH
* **Confidence:** 8/10
* **Status:** VERIFIED
* **Phase:** 5 -- Infrastructure Shadow Surface
* **Category:** Security Misconfiguration (OWASP A05)
* **File:** `services/api-ts/Dockerfile`

**Description:**
The production Dockerfile uses `oven/bun:1.2.21-alpine` as its final stage but never sets a `USER` directive. The application runs as root inside the container.

**Motivating code:** The entire Dockerfile has no `USER` directive after `FROM oven/bun:1.2.21-alpine`.

**Exploit scenario:**
1. Attacker exploits a vulnerability in the Bun runtime or application code to achieve RCE
2. Because the process runs as root, the attacker has full container access
3. Attacker can modify the filesystem, access mounted secrets, or attempt container escape

**Impact:** Elevated privilege upon container compromise. Root access enables broader lateral movement.

**Recommendation:**
```dockerfile
# After COPY and before EXPOSE
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 7213
```

Ensure the `bun` user can write to any necessary directories (e.g., temp files).

---

### Finding 6: Rate Limiter Disabled in Development/Test

* **Severity:** MEDIUM
* **Confidence:** 8/10
* **Status:** VERIFIED
* **Phase:** 9 -- OWASP A04 (Insecure Design)
* **Category:** Insecure Design
* **File:** `services/api-ts/src/middleware/rate-limit.ts:63`

**Description:**
The global rate limiter is completely bypassed when `NODE_ENV` is `test`, `development`, or unset. While reasonable for local dev, if a staging or pre-production environment also runs without `NODE_ENV=production`, it has zero rate limiting protection.

**Motivating code:**
```typescript
const env = process.env['NODE_ENV'];
if (!env || env === 'test' || env === 'development') {
  return next();
}
```

**Exploit scenario:**
1. Staging environment deployed without `NODE_ENV=production`
2. Attacker discovers staging URL and brute-forces auth endpoints or floods API
3. No rate limiting is applied

**Impact:** Staging environments exposed to brute force and API abuse.

**Recommendation:**
Consider enabling rate limiting by default and only disabling for `test`:
```typescript
if (env === 'test') {
  return next();
}
```

---

### Finding 7: PII Stored Without Application-Layer Encryption

* **Severity:** MEDIUM
* **Confidence:** 8/10
* **Status:** VERIFIED
* **Phase:** 11 -- Data Classification
* **Category:** Cryptographic Failures (OWASP A02)
* **File:** `services/api-ts/src/handlers/person/repos/person.schema.ts`

**Description:**
The Person table stores healthcare PII (first name, last name, date of birth, address, phone, email) as plaintext `varchar`/`jsonb` columns. No application-layer encryption is applied. Security relies entirely on database-level encryption-at-rest (which Railway PostgreSQL provides by default).

**Motivating code:**
```typescript
firstName: varchar('first_name', { length: 50 }).notNull(),
lastName: varchar('last_name', { length: 50 }),
dateOfBirth: date('date_of_birth'),
primaryAddress: jsonb('primary_address').$type<Address>(),
contactInfo: jsonb('contact_info').$type<ContactInfo>(), // Contains email, phone
```

**Impact:** If database access is compromised (SQL injection elsewhere, backup theft, admin credential leak), all PII is immediately readable. For healthcare data subject to privacy regulations, this may not meet compliance requirements.

**Recommendation:**
For healthcare-grade PII protection, consider:
1. **Short-term:** Ensure PostgreSQL TDE (transparent data encryption) is enabled on Railway
2. **Medium-term:** Add application-layer encryption for sensitive fields (DOB, address, phone) using a key management service
3. **Document** the current encryption posture for compliance audits

---

## OWASP Top 10 Assessment Summary

| Category | Status | Notes |
|---|---|---|
| A01: Broken Access Control | GOOD | Auth middleware with role-based access, officer auth, platform admin auth. Ownership validation delegated to handlers. |
| A02: Cryptographic Failures | FINDINGS | Finding 1 (timing attack), Finding 3 (default secret), Finding 7 (PII plaintext) |
| A03: Injection | GOOD | Drizzle ORM (parameterized queries), no raw SQL found, Zod validation on inputs |
| A04: Insecure Design | FINDING | Finding 6 (rate limiter disabled). Auth rate limiting and account lockout are solid. |
| A05: Security Misconfiguration | FINDINGS | Finding 2 (CORS wildcard), Finding 5 (root container) |
| A06: Vulnerable Components | OK | Lockfile tracked. No critical CVEs found in direct scan. Recommend running `bun audit`. |
| A07: Auth Failures | GOOD | Account lockout (5 attempts/15min), session limits (5 concurrent), OTP, passkeys, 2FA, magic link, session invalidation on role change |
| A08: Integrity Failures | FINDING | Finding 4 (unpinned CI actions) |
| A09: Logging Failures | GOOD | HIPAA-compliant audit logging, Pino structured logging, security event audit trails |
| A10: SSRF | GOOD | No user-controlled URL construction found in server code |

## STRIDE Threat Model (Key Components)

| Component | S | T | R | I | D | E |
|---|---|---|---|---|---|---|
| Better-Auth | Mitigated (OTP, passkeys, 2FA) | Mitigated (signed sessions) | Mitigated (audit logging) | Finding 3 | N/A | Mitigated (role checks) |
| PayMongo Webhook | Finding 1 | Mitigated (HMAC) | Mitigated (audit log) | Low risk | N/A | Mitigated (no auth context) |
| Person API | Mitigated (auth middleware) | Mitigated (Drizzle ORM) | Mitigated (audit trail) | Finding 7 | N/A | Mitigated (role-based) |
| CI/CD Pipeline | Finding 4 | Finding 4 | OK (GitHub audit log) | OK | N/A | Managed (GitHub environments) |

## Data Classification

```
DATA CLASSIFICATION
===================
RESTRICTED (breach = legal liability):
  - PII: firstName, lastName, DOB, address, phone, email (plaintext in PostgreSQL)
  - Payment data: Stripe tokens (Stripe-managed), PayMongo sessions (gateway-managed)
  - Auth credentials: passwords (hashed by Better-Auth), session tokens (signed)
  - Medical credentials: CPD credits, certification records

CONFIDENTIAL (breach = business damage):
  - API keys: AUTH_SECRET, INTERNAL_SERVICE_TOKEN, STRIPE_SECRET_KEY,
    PAYMONGO_SECRET_KEY, ONESIGNAL_API_KEY (all via env vars, not hardcoded)
  - Election ballots: cast votes

INTERNAL (breach = embarrassment):
  - System logs: Pino structured logs (PII masked via maskEmail)
  - Configuration: feature flags, org settings

PUBLIC:
  - Certificate verification, credential lookup, event OG meta, public org list
```

## Supply Chain Summary

- **Lockfile:** `bun.lock` present and tracked by git
- **Package manager:** Bun (no `npm audit` equivalent built-in; recommend `bunx audit`)
- **Docker base images:** `oven/bun:1.2.21-alpine` (pinned to specific version, good)
- **GitHub Actions:** 7 distinct third-party actions, all unpinned (Finding 4)
- **No `.gitleaks.toml`** or `.secretlintrc` found -- recommend adding secret scanning

## Positive Security Controls (What's Working Well)

1. **Production guards:** Fail-fast on missing AUTH_SECRET, DATABASE_URL, INTERNAL_SERVICE_TOKEN
2. **Internal service token:** Uses `timingSafeEqual` for verification (correct pattern)
3. **Account lockout:** 5 attempts / 15-minute lockout with audit logging
4. **Session limits:** Max 5 concurrent sessions per user, oldest auto-revoked
5. **Structured audit logging:** HIPAA-oriented audit repository with integrity hashing
6. **PII masking in logs:** `maskEmail` utility used throughout
7. **Drizzle ORM:** Parameterized queries by default, no raw SQL found
8. **Webhook signature verification:** PayMongo HMAC verification present (just needs timing-safe compare)
9. **Security headers:** Hono's `secureHeaders()` middleware (CSP, HSTS, X-Frame-Options)
10. **CORS:** Dynamic origin validator with strict mode option
11. **Impersonation guard:** Write-blocking middleware prevents data modification during impersonation
12. **Versioned secrets:** Support for non-destructive key rotation on auth secrets
13. **No `dangerouslySetInnerHTML`** found in any frontend code (React's default XSS protection)
14. **No `pull_request_target`** in CI workflows (avoids the most dangerous CI attack vector)

## Filter Statistics

```
FILTER STATS
=============
Candidates scanned:     23
Hard exclusion filtered: 11 (DoS/rate-limit theoretical, test-only patterns, dev docker-compose)
Confidence gate (<8):    5 (speculative, pattern-only matches)
Reported:                7 findings (4 HIGH, 3 MEDIUM -- actual CRITICAL: 0)
```

## Remediation Roadmap

| Priority | Finding | Effort | Action |
|---|---|---|---|
| P1 | #1 PayMongo timing attack | 15 min | Replace `!==` with `timingSafeEqual` in `paymongo.adapter.ts` |
| P1 | #2 CORS wildcard default | 15 min | Add production fail-fast guard for wildcard CORS |
| P1 | #3 Auth secret fallback | 15 min | Add secondary guard for default secret on production-like DBs |
| P2 | #4 Unpinned CI actions | 30 min | SHA-pin all `uses:` refs, add Dependabot for github-actions |
| P2 | #5 Root container | 15 min | Add `USER app` directive to Dockerfile |
| P3 | #6 Rate limiter scope | 10 min | Enable rate limiting for non-test environments |
| P3 | #7 PII encryption | Multi-day | Evaluate application-layer encryption for sensitive Person fields |

**Quick wins (< 1 hour total):** Findings 1, 2, 3, 5, 6 can all be fixed in a single session.

---

## Disclaimer

**This tool is not a substitute for a professional security audit.** /cso is an AI-assisted scan that catches common vulnerability patterns -- it is not comprehensive, not guaranteed, and not a replacement for hiring a qualified security firm. LLMs can miss subtle vulnerabilities, misunderstand complex auth flows, and produce false negatives. For production systems handling sensitive data, payments, or PII, engage a professional penetration testing firm. Use /cso as a first pass to catch low-hanging fruit and improve your security posture between professional audits -- not as your only line of defense.
