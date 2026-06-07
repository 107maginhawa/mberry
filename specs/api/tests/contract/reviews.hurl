# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Reviews lifecycle: a reviewer creates a review of another person,
# lists their own reviews, fetches the review back, and deletes it.
# Also asserts that self-reviews are rejected.
#
# Note: relies on Hurl's automatic cookie jar to track session state.
# To switch which user is "logged in", sign in / sign up again — Cookie
# headers and the jar can disagree if you mix the two.

# 0. Create reviewer (latest cookie in jar = reviewer).
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "reviewer-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Reviewer"
}
HTTP 200
