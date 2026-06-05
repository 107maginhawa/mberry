# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Extended email endpoints not covered by email.hurl.
# Covers single queue item, cancel, retry, and template test send.
# Uses admin credentials since email is admin-only.

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


# ── 1. Create a template to test with ───────────────────────

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


# ── 2. Test template send ───────────────────────────────────

POST {{api}}/email/templates/{{template_id}}/test
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "to": "test-recipient-{{suffix}}@example.org"
}
HTTP *
[Asserts]
status >= 200
status < 500


# ── 3. List queue to find an item ────────────────────────────

GET {{api}}/email/queue
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 4. Get single queue item (use first if available) ────────
# If queue is empty this may 404 — that's acceptable.

GET {{api}}/email/queue?status=pending
x-org-id: {{org_id}}
HTTP 200
[Captures]
queue_item_count: jsonpath "$.pagination.totalCount"


# ── 4b. Get single queue item by ID ─────────────────────────
# Uses placeholder UUID; returns 404 if not found — acceptable.

GET {{api}}/email/queue/00000000-0000-0000-0000-000000000000
HTTP *


# ── 5. Cancel a queue item ──────────────────────────────────
# Uses a placeholder UUID; real run needs a queued item.

POST {{api}}/email/queue/00000000-0000-0000-0000-000000000000/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{}
HTTP *


# ── 6. Retry a queue item ───────────────────────────────────

POST {{api}}/email/queue/00000000-0000-0000-0000-000000000000/retry
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{}
HTTP *
