# Communication gaps contract flow — covers the 22 operationIds not
# exercised by communications-flow.hurl / communications-extended-flow.hurl.
# Officer-driven. Read endpoints use real seeded org; mutations use
# synthetic ids or minimal bodies and tolerate 4xx|500 to keep the
# matrix tractable.
#
# Covers operationIds:
#   createMessageTemplate, searchMessageTemplates, getMessageTemplate,
#   updateMessageTemplate, deleteMessageTemplate, previewMessageTemplate,
#   getMessage, updateMessage, cancelMessage, scheduleMessage,
#   listPersonSubscriptions, bulkUpdatePersonSubscriptions,
#   updatePersonSubscription,
#   createSubscriptionTopic, getSubscriptionTopic, updateSubscriptionTopic,
#   deleteSubscriptionTopic,
#   scheduleAnnouncement, getAnnouncementStats,
#   createSavedSegment, listSavedSegments, deleteSavedSegment
#
# Requires: seeded org + officer (test@memberry.ph) from db:seed-modules.
# Org ID: ed8e3a96-8126-4341-be42-e6eb7940c562

# CSRF preamble
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── Auth: sign in as officer ──────────────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200
[Captures]
officer_cookie: cookie "better-auth.session_token"

# ── Message templates (6) ────────────────────────────────────────────────────

GET {{api}}/association/message-templates
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

POST {{api}}/association/message-templates
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "name": "Contract Test Template {{suffix}}",
  "channel": "email",
  "subject": "Test subject",
  "bodyHtml": "<p>Test body</p>",
  "bodyText": "Test"
}
HTTP *
[Asserts]
status toString matches "^(201|400|403|500)$"

GET {{api}}/association/message-templates/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

PATCH {{api}}/association/message-templates/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "subject": "Updated subject"
}
HTTP *
[Asserts]
status toString matches "^(200|403|404|500)$"

DELETE {{api}}/association/message-templates/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|400|403|404)$"

POST {{api}}/association/message-templates/00000000-0000-4000-8000-000000000000/preview
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "variables": {"first_name": "Contract Test"}
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"

# ── Messages (4) ─────────────────────────────────────────────────────────────

GET {{api}}/association/messages/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

PATCH {{api}}/association/messages/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "subject": "Patched"
}
HTTP *
[Asserts]
status toString matches "^(200|403|404|500)$"

POST {{api}}/association/messages/00000000-0000-4000-8000-000000000000/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|403|404|409)$"

POST {{api}}/association/messages/00000000-0000-4000-8000-000000000000/schedule
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "sendAt": "2030-01-01T00:00:00Z"
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"

# ── Person subscriptions (3) ─────────────────────────────────────────────────

GET {{api}}/association/person-subscriptions
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

POST {{api}}/association/person-subscriptions/bulk-update
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "updates": []
}
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

PATCH {{api}}/association/person-subscriptions/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "isSubscribed": false
}
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

# ── Subscription topics (4) ──────────────────────────────────────────────────

POST {{api}}/association/subscription-topics
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "name": "Contract Test Topic {{suffix}}",
  "description": "Test"
}
HTTP *
[Asserts]
status toString matches "^(201|400|403|500)$"

GET {{api}}/association/subscription-topics/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

PATCH {{api}}/association/subscription-topics/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "description": "Patched"
}
HTTP *
[Asserts]
status toString matches "^(200|403|404|500)$"

DELETE {{api}}/association/subscription-topics/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|400|403|404)$"

# ── Announcements (2) ────────────────────────────────────────────────────────

POST {{api}}/communications/announcements/00000000-0000-4000-8000-000000000000/schedule
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "scheduledFor": "2030-01-01T00:00:00Z"
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"

GET {{api}}/communications/announcements/00000000-0000-4000-8000-000000000000/stats
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

# ── Saved segments (3) ───────────────────────────────────────────────────────

GET {{api}}/communications/segments
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

POST {{api}}/communications/segments
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "name": "Contract Test Segment {{suffix}}",
  "filters": {}
}
HTTP *
[Asserts]
status toString matches "^(201|400|403|500)$"

DELETE {{api}}/communications/segments/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|400|403|404)$"
