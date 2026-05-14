# Phase 25: Email/Notif Guards + Handler Tests - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Email infrastructure hardened with rate limiting, bounce suppression, and deceased/departed guard. Remaining untested handlers get unit test coverage. Backend only — no frontend changes.

</domain>

<decisions>
## Implementation Decisions

### Rate Limiting (EML-01)
- Apply rate limiting to bulk email sends only (mass announcements, newsletters)
- Transactional emails (password reset, receipt, deletion confirmation) bypass rate limits
- Use existing rate-limit middleware pattern from `middleware/rate-limit.ts`
- Distinguish bulk vs transactional via email type/category flag

### Bounce Suppression (EML-02)
- Hard bounce on any address → add to suppression list
- Suppression list stored in DB (new table or extend email schema)
- Check suppression list before every send
- Officers can query the suppression list

### Deceased/Departed Guard (EML-03)
- Block email and push notification sends to deceased or departed members
- Check membership status at send layer (not queue layer — prevents silently queued messages)
- Consume the `resigned`/`deceased`/`expelled`/`lapsed` statuses from Phase 23

### Unsubscribe (EML-04)
- One-click unsubscribe header (RFC 8058 List-Unsubscribe-Post)
- Visible unsubscribe link in email body
- Clicking either suppresses the address (adds to suppression list)

### Handler Test Coverage (EML-05)
- Find all previously untested API handlers
- Write unit tests with standard mock patterns
- Target: every handler has at least basic happy-path + auth-check coverage

### Claude's Discretion
All implementation details at Claude's discretion. Follow existing email/notification handler patterns.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Email handlers under `services/api-ts/src/handlers/email/`
- Email queue repo at `email/repos/queue.repo.ts`
- Notification handlers under `handlers/notifs/`
- Rate limit middleware at `middleware/rate-limit.ts`
- Membership status enum with resigned/deceased/expelled/lapsed (from Phase 23)

### Integration Points
- Email send pipeline
- Notification send pipeline
- Membership status check (for deceased/departed guard)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user defers to best practices.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
