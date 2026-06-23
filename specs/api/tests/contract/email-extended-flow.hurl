# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Extended email endpoints not covered by email.hurl.
# Covers the REAL email-queue lifecycle (enqueue -> cancel -> guarded retry),
# template test send, suppressions, and RFC 8058 unsubscribe.
# Uses admin credentials since email is admin-only.
#
# FIX-010: the cancel/retry steps used to target a placeholder UUID with
# `HTTP *`, which proved nothing (the route 404'd before any transition logic
# ran). They now drive a real queue item through actual status transitions:
#   pending --cancel--> cancelled  (succeeds)
#   cancelled --cancel--> (rejected, invalid transition)
#   cancelled --retry--> (rejected, invalid transition)
# A *successful* retry (failed -> pending) is intentionally not asserted here:
# no public API path produces a `failed` item, and the only seeded failed item
# has attempts=3 (MAX_RETRIES_EXCEEDED), so a green retry is unreachable via the
# contract surface. The guard rejection below is the honest, real proof.

# ── Auth: sign in as admin ───────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200


# ── 1. Create an active template to test with ────────────────

POST {{api}}/email/templates
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "name": "Ext email template {{suffix}}",
  "description": "For extended contract tests",
  "subject": "Test subject {{suffix}}",
  "bodyHtml": "<p>Test body</p>",
  "bodyText": "Test body",
  "status": "active"
}
HTTP 201
[Captures]
template_id: jsonpath "$.id"


# ── 2. Test send → enqueues a REAL pending queue item ────────
# TestTemplateResult wraps the created EmailQueueItem under `queue`.

POST {{api}}/email/templates/{{template_id}}/test
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "recipientEmail": "lifecycle-{{suffix}}@example.org",
  "recipientName": "Lifecycle Tester"
}
HTTP 200
[Captures]
queue_id: jsonpath "$.queue.id"
[Asserts]
jsonpath "$.queue.id" exists
jsonpath "$.queue.status" == "pending"


# ── 3. Read the queued item back (real item, pending) ────────

GET {{api}}/email/queue/{{queue_id}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{queue_id}}"
jsonpath "$.status" == "pending"


# ── 4. Cancel the pending item → REAL transition succeeds ────

POST {{api}}/email/queue/{{queue_id}}/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "reason": "Contract lifecycle test {{suffix}}"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "cancelled"


# ── 5. Cancel again → invalid transition (cancelled→cancelled) ─
# Proves the transition guard actually runs against the real item's status.

POST {{api}}/email/queue/{{queue_id}}/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "reason": "Should be rejected"
}
HTTP 409


# ── 6. Retry the cancelled item → invalid transition ─────────
# Only `failed → pending` is a valid retry; cancelled cannot be retried.

POST {{api}}/email/queue/{{queue_id}}/retry
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP 409


# ── 7. List email suppressions (admin) ──────────────────────

GET {{api}}/email/suppressions
x-org-id: {{org_id}}
HTTP *
[Asserts]
status toString matches "^(200|403)$"


# ── 7b. [BR-53] Active template required — a DRAFT template cannot enqueue ───
# Create an INACTIVE (draft) template, then attempt a test send: the enqueue is
# rejected because no ACTIVE template matches (404 "not found or not active").
# This is the guard half of BR-53 (the active-template happy path is steps 1-2).

POST {{api}}/email/templates
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "name": "Draft template {{suffix}}",
  "description": "Inactive — must not enqueue",
  "subject": "Draft subject",
  "bodyHtml": "<p>Draft</p>",
  "bodyText": "Draft",
  "status": "draft"
}
HTTP 201
[Captures]
draft_template_id: jsonpath "$.id"

POST {{api}}/email/templates/{{draft_template_id}}/test
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "recipientEmail": "draft-{{suffix}}@example.org",
  "recipientName": "Draft Tester"
}
HTTP 404


# ── 8. RFC 8058 list-unsubscribe link click (public GET) ────

GET {{api}}/email/unsubscribe?token=synthetic-contract-test-token-{{suffix}}
HTTP *
[Asserts]
status toString matches "^(200|400|404)$"


# ── 9. RFC 8058 one-click unsubscribe POST (public) ─────────

POST {{api}}/email/unsubscribe
x-csrf-token: {{csrf_token}}
Origin: {{origin}}
Content-Type: application/json
{
  "token": "synthetic-contract-test-token-{{suffix}}"
}
HTTP *
[Asserts]
status toString matches "^(200|400|404|422)$"
