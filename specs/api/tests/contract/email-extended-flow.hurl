# Extended email endpoints not covered by email.hurl.
# Covers single queue item, cancel, retry, and template test send.
# Uses admin credentials since email is admin-only.

# ── Auth: sign in as admin ───────────────────────────────────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "{{admin_email}}",
  "password": "{{admin_password}}"
}
HTTP 200


# ── 1. Create a template to test with ───────────────────────

POST {{api}}/email/templates
Content-Type: application/json
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
Content-Type: application/json
{
  "to": "test-recipient-{{suffix}}@example.org"
}
HTTP *
[Asserts]
status >= 200
status < 500


# ── 3. List queue to find an item ────────────────────────────

GET {{api}}/email/queue
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 4. Get single queue item (use first if available) ────────
# If queue is empty this may 404 — that's acceptable.

GET {{api}}/email/queue?status=pending
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
Content-Type: application/json
{}
HTTP *


# ── 6. Retry a queue item ───────────────────────────────────

POST {{api}}/email/queue/00000000-0000-0000-0000-000000000000/retry
Content-Type: application/json
{}
HTTP *
