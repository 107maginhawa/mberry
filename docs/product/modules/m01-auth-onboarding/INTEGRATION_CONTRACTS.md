<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md M01, ARCHITECTURE.md -->
# Integration Contracts — Auth & Onboarding (M01)

## 1. Better-Auth (Authentication)

| Property | Value |
|----------|-------|
| Provider | Better-Auth |
| Version | Latest (npm `better-auth`) |
| Auth | Session-based (cookie + bearer token) |
| Test strategy | In-process test instance |
| Docs | https://www.better-auth.com/docs |

### Integration Pattern

Better-Auth is **not an external service** — it runs in-process as middleware in the Hono API. No network calls to external auth provider.

### Features Used

| Feature | Purpose | Configuration |
|---------|---------|--------------|
| Email/Password auth | Primary sign-in method | Default |
| Session management | Session tokens (cookie + bearer) | `session.maxAge: 7 days` |
| 2FA (TOTP) | Optional per-user | Enabled via `twoFactor` plugin |
| Magic links | Passwordless sign-in option | Email delivery via email queue |
| Account linking | Multiple auth methods per account | Planned |

### Session Configuration

| Parameter | Value |
|-----------|-------|
| Session token cookie | `better-auth.session_token` |
| Cookie flags | `httpOnly`, `secure` (production), `sameSite=lax` |
| Session max age | 7 days |
| Refresh strategy | Sliding window (refresh on activity) |
| Session storage | PostgreSQL (`session` table, managed by Better-Auth) |

### Error Handling

Better-Auth errors are caught in `authMiddleware` and mapped to standard error codes:

| Better-Auth Error | Maps To | User Message |
|-------------------|---------|--------------|
| Invalid credentials | `AUTH-003` | Invalid credentials |
| Session expired | `AUTH-002` | Session expired |
| Account not found | `AUTH-003` | Invalid credentials (no user enumeration) |
| 2FA required | `AUTH-005` | 2FA required |
| Invalid TOTP | `AUTH-006` | Invalid 2FA code |

### Secret Policy

| Secret | Env Var | Injection | Redaction |
|--------|---------|-----------|-----------|
| Auth secret (signing key) | `BETTER_AUTH_SECRET` | Environment variable | Never log |
| Database URL | `DATABASE_URL` | Environment variable | Mask password portion |
