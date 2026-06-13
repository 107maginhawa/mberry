<!-- oli:api-contracts v0.1 | generated 2026-05-30 | source: TypeSpec → OpenAPI -->
# API Contracts — Email (M22)

> Source: TypeSpec at `specs/api/src/modules/email.tsp` → OpenAPI at `specs/api/dist/openapi/openapi.json`
> Conventions: `API_CONVENTIONS.md` | Errors: `ERROR_TAXONOMY.md`
> Audit-grade scaffold (Wave G6). Promote to v1.0 with per-endpoint detail when the module reaches full coverage parity with m05.

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/email` |
| Auth default | GA (session cookie or Bearer token) for queue/templates/suppressions; **public** for `/email/unsubscribe` (RFC 8058 signed token in query) |
| Rate limit tier | Authenticated (120 req/min); unsubscribe public route bypasses |
| Tenant scoping | Session orgContext middleware on `/email/*` (`app.ts:393-394`) **except `/email/unsubscribe`** which registers BEFORE auth (`app.ts:388-389`) |
| External integration | Email provider via `core/email` service; suppression list synced |

---

## 2. Endpoints

### 2.1 Email queue (officer/admin)

| Method | Path | Operation | Auth |
|--------|------|-----------|------|
| GET | `/email/queue` | listEmailQueueItems | officer / admin |
| GET | `/email/queue/{queue}` | getEmailQueueItem | officer / admin |
| POST | `/email/queue/{queue}/retry` | retryEmailQueueItem | officer / admin |
| POST | `/email/queue/{queue}/cancel` | cancelEmailQueueItem | officer / admin |

### 2.2 Email templates (officer-managed)

| Method | Path | Operation | Auth |
|--------|------|-----------|------|
| GET | `/email/templates` | listEmailTemplates | officer |
| POST | `/email/templates` | createEmailTemplate | officer |
| GET | `/email/templates/{template}` | getEmailTemplate | officer |
| PATCH | `/email/templates/{template}` | updateEmailTemplate | officer |
| POST | `/email/templates/{template}/test` | testEmailTemplate | officer |

### 2.3 Suppressions (officer/admin)

| Method | Path | Operation | Auth |
|--------|------|-----------|------|
| GET | `/email/suppressions` | listEmailSuppressions | officer / admin (hand-wired after auth) |

### 2.4 Unsubscribe (public, RFC 8058)

| Method | Path | Operation | Auth |
|--------|------|-----------|------|
| GET | `/email/unsubscribe` | unsubscribeEmailGet | none (signed query token) |
| POST | `/email/unsubscribe` | unsubscribeEmailPost | none (signed query token) |

Hand-wired (by design): both registered at `app.ts:388-389` BEFORE `/email/*` auth middleware so the public List-Unsubscribe header can be honoured without a session.

---

## 3. Domain Events Published

Audit-grade stub.

- `email_queue.enqueued`, `email_queue.sent`, `email_queue.failed`, `email_queue.cancelled`, `email_queue.retried`
- `email_template.created`, `email_template.updated`
- `email.suppressed`, `email.unsubscribed`

## 4. Domain Events Consumed

- `communication.announcement.scheduled` → enqueues per-recipient email
- `dues.invoice.due` → reminder template
- `event.confirmation` → confirmation template

## 5. Shared Types

- `EmailQueueItem`, `EmailTemplate`, `EmailSuppression`, `EmailStatus` — see OpenAPI `#/components/schemas/`
- Unsubscribe token: HMAC-SHA256 over `(personId, organizationId, exp)` per `handlers/email/utils/unsub-token.ts`
- BulkRateLimiter: see `handlers/email/utils/bulk-rate-limiter.ts` (per-org cap)
