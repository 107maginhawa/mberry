# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-15]
# Training module contract test: officer creates training,
# member enrolls, officer marks complete.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── Unauth → 401 ──────────────────────────────────────────

POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/association/training
x-org-id: {{org_id}}
HTTP 401

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── List trainings ────────────────────────────────────────

GET {{api}}/association/training
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── Create training ────────────────────────────────────────

POST {{api}}/association/training
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "organizationId": "{{org_id}}",
  "title": "Contract Test Training {{suffix}}",
  "description": "Test training session",
  "location": "Online",
  "type": "seminar",
  "startDate": "2026-12-15T09:00:00Z",
  "endDate": "2026-12-15T17:00:00Z",
  "capacity": 30,
  "creditBearing": true,
  "creditAmount": 8
}
HTTP 201
[Captures]
training_id: jsonpath "$.id"


# ── Get training ──────────────────────────────────────────

GET {{api}}/association/training/{{training_id}}
x-org-id: {{org_id}}
HTTP 200


# ── My trainings ──────────────────────────────────────────

GET {{api}}/association/training-lifecycle/my
x-org-id: {{org_id}}
HTTP 200
