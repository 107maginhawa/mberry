# Security Audit — Wave 1.5

Date: 2026-06-06T06:59:29Z  
Branch: feature/codebase-hardening  
HEAD at audit: 4a44e1e173ef91ec2254e84c84cfaa67235290cc

## Summary

| Severity | Count | In-wave action |
|---|---|---|
| P0 | 0 | — |
| P1 | 2 | Queued (F2-001, F6-001) |
| P2 | 3 | Queued (F3-001, F5-001, F6-002) |
| P3 | 4 | Informational |

**No P0 findings.** No exploitable vulnerabilities found in the current state of the codebase.

## Methodology

7 scan dimensions run via `bun run scripts/security-quickscan.ts`. Re-running produces fresh `docs/security/security-quickscan.json`.

| Dimension | Tool | Result |
|---|---|---|
| 1. Raw SQL | rg + manual line review | P3 — all parameterized |
| 2. Cookie flags | grep config + cors.ts | P1 — prod default risk |
| 3. JWT/Session TTL | grep config | P2 — 24h default |
| 4. Rate limiting | grep app.ts | P3 — global limiter present |
| 5. Secrets | gitleaks + rg | P2/P3 — gitleaks missing |
| 6. CORS | grep config + cors.ts | P1/P2 — tunneling default |
| 7. File uploads | grep uploadFile.ts | P3 — MIME+size+sanitize |

---

## P0 Findings (in-wave fixes)

None. Zero exploitable-now vectors found.

---

## P1 Queue

### F2-001 — Production cookie sameSite degraded by default CORS flags

- **File:** `services/api-ts/src/utils/cors.ts` (`determineCookieConfig`)
- **Description:** When `CORS_ALLOW_LOCAL_NETWORK=true` OR `CORS_ALLOW_TUNNELING=true`
  (both default `true` in config.ts), `determineCookieConfig()` sets `sameSite="none"` for
  Better-Auth session cookies. If production deployments do not explicitly set these flags to
  `false`, session cookies will be issued with `sameSite=none`, weakening CSRF protection.
  The impersonation cookie is unaffected (hardcoded `sameSite=Strict`).
- **Fix:** Add production guard in `services/api-ts/src/core/config.ts`: if
  `NODE_ENV=production` and `AUTH_COOKIE_SAMESITE` is not explicitly set, default to `"lax"`
  regardless of CORS flags and emit a startup warning. Add to production deployment checklist.
- **Status:** Not yet fixed — no P0 exploitation path (requires attacker to control a
  tunneling-hosted origin AND the user to have an active session).

---

### F6-001 — CORS tunneling origins accepted by default in production

- **File:** `services/api-ts/src/core/config.ts:133`
- **Description:** `CORS_STRICT` defaults to `false`, `CORS_ALLOW_TUNNELING` defaults to
  `true`. In production, if these env vars are not explicitly overridden, the API accepts
  `Origin` headers from `*.ngrok.io`, `*.trycloudflare.com`, `*.loca.lt`, `*.localhost.run`
  with `CORS_CREDENTIALS=true`. This means a malicious page hosted at a tunneling URL could
  make credentialed cross-origin requests to the API on behalf of a logged-in user.
- **Fix:** Add startup validation: if `NODE_ENV=production` and `CORS_STRICT` is false or
  `CORS_ALLOW_TUNNELING` is true, log a `WARN` (or refuse to start with `CORS_STRICT_MODE`
  env check). Required production env: `CORS_STRICT=true`, `CORS_ALLOW_TUNNELING=false`,
  `CORS_ALLOW_LOCAL_NETWORK=false`.
- **Status:** Not yet fixed. Mitigated in practice if production deployments follow ops
  runbook — but no code-level enforcement.

---

## P2 Queue

### F3-001 — Session TTL defaults to 24h with no role differentiation

- **File:** `services/api-ts/src/core/config.ts:143`
- **Description:** `AUTH_SESSION_EXPIRES_IN` defaults to `86400` seconds (24h). No
  role-based TTL differentiation — platform admins with elevated privileges use the same
  session lifetime as regular members. Stolen session tokens remain valid for up to 24h.
- **Recommendation:** Reduce default to ≤8h (`AUTH_SESSION_EXPIRES_IN=28800`). Document in
  `.env.example`. Consider separate shorter TTL for platform admin sessions.

---

### F5-001 — gitleaks not installed

- **Location:** Developer environment / CI pipeline
- **Description:** `gitleaks` binary not present locally. No automated secret scanning on
  commits or PRs. Grep-based fallback found no hardcoded secrets in TypeScript source.
  CI workflow contains test fixture credentials (`AUTH_SECRET=contract-test-secret-do-not-use-in-prod`,
  `minioadmin/minioadmin`) — acceptable for ephemeral environments.
- **Recommendation:** `brew install gitleaks`. Add pre-commit hook:
  `gitleaks protect --staged`. Add CI step in `contract.yml`. Set up `.gitleaks.toml`
  allowlist for known CI fixture values.

---

### F6-002 — Wildcard '*' accepted as valid CORS origin value

- **File:** `services/api-ts/src/utils/cors.ts` (createOriginValidator)
- **Description:** The origin validator checks `corsConfig.origins.includes('*')` and
  accepts the request if matched. If an operator accidentally sets `CORS_ORIGINS=*` in
  production alongside `CORS_CREDENTIALS=true`, all origins would be accepted with
  credentials — a critical misconfiguration.
- **Recommendation:** Add startup validation: if `origins` includes `'*'` and `credentials`
  is `true`, throw a config error. `Access-Control-Allow-Origin: *` + credentials is
  always invalid per the CORS spec and browsers reject it anyway, but defense-in-depth
  requires failing at startup rather than silently.

---

## P3 Queue (informational)

### F1-001 — Raw sql`` usage in handler repos (all parameterized)

- **Files:** `booking/repos/bookingEvent.repo.ts`, `comms/repos/chatRoom.repo.ts`,
  `email/repos/queue.repo.ts`, `email/repos/template.repo.ts`,
  `marketplace/repos/listing.repo.ts`, `membership/repos/membership.repo.ts`,
  `association:member/repos/directory.repo.ts`, `platformadmin/getOrganizationBySlug.ts`,
  `platformadmin/listPublicOrgs.ts`, `platformadmin/getRevenueAnalytics.ts`
- **Description:** All raw `sql\`\`` usages reviewed. Every `${}` interpolation is a Drizzle
  schema column reference, a bound literal, or a JS string that becomes a Drizzle bound
  parameter (e.g. `${'%' + searchTerm + '%'}` in bookingEvent full-text search — JS concat
  happens before Drizzle sees it as a param, so it's parameterized at the driver level).
  No string concatenation bypasses Drizzle parameterization.
- **Recommendation:** Add eslint-plugin-drizzle or a custom lint rule to CI that flags any
  `sql\`\`` usage where the interpolated expression contains `+` string concatenation with
  variables not coming from Drizzle schema columns.

### F4-002 — In-memory rate limiter (single-process only)

- **File:** `services/api-ts/src/middleware/rate-limit.ts`
- **Description:** Global rate limiter is in-memory (`Map`). Resets on process restart.
  Multi-instance production deployments would not share state.
- **Recommendation:** Replace with Redis sliding window before horizontal scaling.

### F5-003 — CI fixture credentials in workflow YAML

- **File:** `.github/workflows/contract.yml`
- **Description:** Known test fixture credentials present (`contract-test-secret-do-not-use-in-prod`,
  `minioadmin`). Labeled clearly as test-only. Not exploitable unless these values were
  reused in production.
- **Recommendation:** Confirm these values were never used in production. Add gitleaks
  allowlist entry to suppress CI noise.

### F7-001 — Presigned-URL upload: no server-side magic-byte verification

- **File:** `services/api-ts/src/handlers/storage/uploadFile.ts`
- **Description:** Upload uses presigned-URL pattern — server validates metadata (MIME type,
  size, filename) before issuing URL; client uploads directly to S3/MinIO. Server cannot
  inspect actual bytes. A determined attacker could declare `mimeType=image/png` but upload
  an executable to S3 directly, bypassing MIME validation.
- **Recommendation:** For document upload categories, consider a post-upload Lambda/job that
  verifies magic bytes match declared MIME type and quarantines mismatches. Acceptable risk
  for current phase (documents are not served as executable; S3 serves with declared
  Content-Type, not sniffed).

---

## Tools Status

| Tool | Status |
|---|---|
| gitleaks | MISSING — P2 to install (see F5-001) |
| rg (ripgrep) | Present |
| Built-in grep | Present |

---

## Re-run Instructions

```bash
bun run scripts/security-quickscan.ts
# Output: docs/security/security-quickscan.json
```

Machine-readable findings at `docs/security/security-quickscan.json`.
