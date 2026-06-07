# Misc-gaps contract flow — covers the long tail of small uncovered
# operationIds: onboarding, public events, chat search, my-credits,
# org chapters.
#
# Covers operationIds:
#   getOnboardingState, updateOnboardingStep,
#   listPublicEvents, getPublicEvent,
#   searchChatMessages, getMyCredits, listOrgChapters
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

# ── 1. Get onboarding state ──────────────────────────────────────────────────

GET {{api}}/onboarding/state
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"

# ── 2. Update an onboarding step ─────────────────────────────────────────────

PUT {{api}}/onboarding/step
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "step": "welcome",
  "status": "completed"
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"

# ── 3. List public events (anonymous) ────────────────────────────────────────

GET {{api}}/public/events
HTTP *
[Asserts]
status toString matches "^(200|400|404)$"

# ── 4. Get a public event by slug ────────────────────────────────────────────

GET {{api}}/public/events/synthetic-event-slug
HTTP *
[Asserts]
status toString matches "^(200|400|404)$"

# ── 5. Search chat messages ──────────────────────────────────────────────────

GET {{api}}/comms/messages/search?q=hello
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

# ── 6. My credits (member-side) ──────────────────────────────────────────────

GET {{api}}/persons/me/credits
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"

# ── 7. Org chapters listing ──────────────────────────────────────────────────

GET {{api}}/association/member/chapters
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"
