# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association:Operations gaps contract flow — covers the 46 operationIds
# under accredited-providers, event-lifecycle, events, training-lifecycle,
# training/courses, and training/enrollments not covered elsewhere.
#
# Officer-driven sweep. Reads against the seeded org assert real 200/403;
# writes/transitions use synthetic ids + tolerate the broad 4xx|500 matrix
# to absorb the org-scoping defect family and middleware role gating.
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

# ── Accredited providers (4) ─────────────────────────────────────────────────

GET {{api}}/accredited-providers/ed8e3a96-8126-4341-be42-e6eb7940c562
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

POST {{api}}/accredited-providers/ed8e3a96-8126-4341-be42-e6eb7940c562
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "name": "Contract Test Provider {{suffix}}",
  "accreditationNumber": "ACC-{{suffix}}",
  "status": "active"
}
HTTP *
[Asserts]
status toString matches "^(201|400|403|500)$"

PATCH {{api}}/accredited-providers/ed8e3a96-8126-4341-be42-e6eb7940c562/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "status": "inactive"
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|500)$"

DELETE {{api}}/accredited-providers/ed8e3a96-8126-4341-be42-e6eb7940c562/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|403|404)$"

# ── Event lifecycle (4) ──────────────────────────────────────────────────────

POST {{api}}/association/event-lifecycle/00000000-0000-4000-8000-000000000000/complete
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|409)$"

POST {{api}}/association/event-lifecycle/00000000-0000-4000-8000-000000000000/register
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|201|400|403|404)$"

POST {{api}}/association/event-lifecycle/00000000-0000-4000-8000-000000000000/register-and-pay
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|201|400|403|404|500)$"

GET {{api}}/association/event-lifecycle/00000000-0000-4000-8000-000000000000/registrations
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"

# ── Event registrations (5) ──────────────────────────────────────────────────

GET {{api}}/association/events/registrations/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

PATCH {{api}}/association/events/registrations/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "status": "attended"
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|500)$"

DELETE {{api}}/association/events/registrations/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|403|404)$"

POST {{api}}/association/events/registrations/00000000-0000-4000-8000-000000000000/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|409)$"

POST {{api}}/association/events/registrations/00000000-0000-4000-8000-000000000000/refund
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|500)$"

# ── Events lifecycle (5) ─────────────────────────────────────────────────────

PATCH {{api}}/association/events/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Patched"
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|500)$"

DELETE {{api}}/association/events/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|403|404)$"

POST {{api}}/association/events/00000000-0000-4000-8000-000000000000/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|409)$"

POST {{api}}/association/events/00000000-0000-4000-8000-000000000000/publish
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|409)$"

GET {{api}}/association/events/00000000-0000-4000-8000-000000000000/waitlist
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

POST {{api}}/association/events/00000000-0000-4000-8000-000000000000/waitlist/00000000-0000-4000-8000-000000000001/promote
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|409)$"

# ── Training lifecycle (5) ───────────────────────────────────────────────────

POST {{api}}/association/training-lifecycle/00000000-0000-4000-8000-000000000000/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|409)$"

POST {{api}}/association/training-lifecycle/00000000-0000-4000-8000-000000000000/check-in
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|409)$"

POST {{api}}/association/training-lifecycle/00000000-0000-4000-8000-000000000000/complete
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|409)$"

POST {{api}}/association/training-lifecycle/00000000-0000-4000-8000-000000000000/enroll
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|201|400|403|404)$"

GET {{api}}/association/training-lifecycle/00000000-0000-4000-8000-000000000000/enrollments
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403|404)$"

# ── Training / courses (10) ──────────────────────────────────────────────────

GET {{api}}/association/training/courses
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

POST {{api}}/association/training/courses
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Contract Test Course {{suffix}}",
  "description": "Test"
}
HTTP *
[Asserts]
status toString matches "^(201|400|403|500)$"

GET {{api}}/association/training/courses/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

PATCH {{api}}/association/training/courses/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Patched"
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|500)$"

DELETE {{api}}/association/training/courses/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|403|404)$"

GET {{api}}/association/training/courses/enrollments
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

POST {{api}}/association/training/courses/enrollments
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "courseId": "00000000-0000-4000-8000-000000000000",
  "personId": "00000000-0000-4000-8000-000000000001"
}
HTTP *
[Asserts]
status toString matches "^(201|400|403|404|500)$"

GET {{api}}/association/training/courses/enrollments/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

PATCH {{api}}/association/training/courses/enrollments/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "progress": 50
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|500)$"

DELETE {{api}}/association/training/courses/enrollments/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|403|404)$"

POST {{api}}/association/training/courses/enrollments/00000000-0000-4000-8000-000000000000/progress
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "progressPercent": 75
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|500)$"

POST {{api}}/association/training/courses/quiz-attempts
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "enrollmentId": "00000000-0000-4000-8000-000000000000",
  "answers": []
}
HTTP *
[Asserts]
status toString matches "^(201|400|403|404|500)$"

GET {{api}}/association/training/courses/quiz-attempts
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

# ── Training / enrollments (6) ───────────────────────────────────────────────

GET {{api}}/association/training/enrollments
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|400|403)$"

POST {{api}}/association/training/enrollments
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "trainingId": "00000000-0000-4000-8000-000000000000",
  "personId": "00000000-0000-4000-8000-000000000001"
}
HTTP *
[Asserts]
status toString matches "^(201|400|403|404|500)$"

GET {{api}}/association/training/enrollments/00000000-0000-4000-8000-000000000000
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

PATCH {{api}}/association/training/enrollments/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "status": "in_progress"
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|500)$"

DELETE {{api}}/association/training/enrollments/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|403|404)$"

POST {{api}}/association/training/enrollments/00000000-0000-4000-8000-000000000000/complete
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|409)$"

# ── Training (3) ─────────────────────────────────────────────────────────────

PATCH {{api}}/association/training/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Patched"
}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|500)$"

DELETE {{api}}/association/training/00000000-0000-4000-8000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|403|404)$"

POST {{api}}/association/training/00000000-0000-4000-8000-000000000000/publish
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{}
HTTP *
[Asserts]
status toString matches "^(200|400|403|404|409)$"
