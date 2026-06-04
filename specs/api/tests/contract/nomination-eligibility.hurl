# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-34]
# Nomination eligibility contract test.
#
# FULLY ORPHANED: /association/elections/nominations/eligibility has no spec equivalent.
# BR-34 eligibility logic is enforced in the createNominee handler
# (POST /association/elections/:id/nominees), not via a dedicated GET endpoint.
# Full coverage: 10 unit tests in br-34.nomination-eligibility.test.ts.
#
# Elections spec paths are under /association/member/elections/*.
# No dedicated eligibility query endpoint exists in the spec.
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# Step 1: Unauthenticated access should fail
# ORPHANED: no spec equivalent
# GET {{api}}/association/elections/nominations/eligibility?organizationId=ed8e3a96-8126-4341-be42-e6eb7940c562
# HTTP 401

# Validate auth on the elections list endpoint instead
GET {{api}}/association/member/elections
HTTP 401
