# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-35]
# Feed content moderation contract test: verify endpoint auth and stub response.
#
# FULLY ORPHANED: /association/feed/moderation has no spec equivalent.
# BR-35 is deferred. All steps commented out until a spec path is defined.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# Step 1: Unauthenticated access should fail
# ORPHANED: no spec equivalent
# GET {{api}}/association/feed/moderation?organizationId=ed8e3a96-8126-4341-be42-e6eb7940c562
# HTTP 401

# Step 2: Authenticate
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"

# Step 3: Authenticated request to unimplemented endpoint
# ORPHANED: no spec equivalent
# GET {{api}}/association/feed/moderation?organizationId=ed8e3a96-8126-4341-be42-e6eb7940c562
# Cookie: better-auth.session_token={{session_token}}
# HTTP 404
