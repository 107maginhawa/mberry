# Business Rules: [BR-34]
# Nomination eligibility contract test.
#
# NOTE: BR-34 eligibility logic is enforced in the createNominee handler
# (POST /association/elections/:id/nominees), not via a dedicated GET endpoint.
# Full coverage: 10 unit tests in br-34.nomination-eligibility.test.ts.
#
# This contract test validates auth middleware on the elections namespace.
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# Step 1: Unauthenticated access should fail
GET {{api}}/association/elections/nominations/eligibility?organizationId=ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
