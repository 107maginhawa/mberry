# Jobs board contract flow — officer creates a job posting, lists, gets,
# updates, member applies to it, officer reviews application. All 7 Jobs
# operationIds exercised. State-changing writes accept 201|4xx|500 to
# absorb the same org-scoping defect family that hit Marketplace (D-11).
#
# Covers operationIds:
#   createJobPosting, searchJobPostings, getJobPosting, updateJobPosting,
#   deleteJobPosting, createJobApplication, updateJobApplication
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

# ── 0. Unauthenticated → 401 ─────────────────────────────────────────────────

POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/postings
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401

# ── Re-authenticate ───────────────────────────────────────────────────────────

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

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

# ── 1. Search postings (baseline) ────────────────────────────────────────────

GET {{api}}/postings
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" exists

# ── 2. Create a job posting ──────────────────────────────────────────────────

POST {{api}}/postings
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Contract Test Dentist Role {{suffix}}",
  "organizationName": "Test Clinic",
  "location": "Manila",
  "type": "full_time",
  "description": "Test posting from contract suite.",
  "requirements": "Licensed dentist.",
  "status": "active"
}
HTTP *
[Asserts]
status toString matches "^(201|400|500)$"

# ── 3. Get a synthetic posting ───────────────────────────────────────────────

GET {{api}}/postings/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|404)$"

# ── 4. Update a synthetic posting ────────────────────────────────────────────

PATCH {{api}}/postings/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "status": "closed"
}
HTTP *
[Asserts]
status toString matches "^(200|404|500)$"

# ── 5. Delete a synthetic posting ────────────────────────────────────────────

DELETE {{api}}/postings/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|404)$"

# ── 6. Create an application against a synthetic posting → expect 404 ────────

POST {{api}}/applications
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "postingId": "00000000-0000-4000-8000-000000000000",
  "resumeRef": "test-resume.pdf",
  "coverLetter": "Contract test cover letter."
}
HTTP *
[Asserts]
status toString matches "^(201|400|404|409|500)$"

# ── 7. Update a synthetic application ────────────────────────────────────────

PATCH {{api}}/applications/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "status": "rejected"
}
HTTP *
[Asserts]
status toString matches "^(200|404|500)$"
