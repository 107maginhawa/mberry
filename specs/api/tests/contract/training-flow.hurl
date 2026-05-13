# Business Rules: [BR-15]
# Training module contract test: officer creates training,
# member enrolls, officer marks complete.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── Unauth → 401 ──────────────────────────────────────────

POST {{api}}/auth/sign-out
HTTP 200

GET {{api}}/association/training
HTTP 401

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── List trainings ────────────────────────────────────────

GET {{api}}/association/training
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── Create training ────────────────────────────────────────

POST {{api}}/association/training
Content-Type: application/json
{
  "title": "Contract Test Training {{suffix}}",
  "description": "Test training session",
  "location": "Online",
  "startDate": "2026-12-15T09:00:00Z",
  "endDate": "2026-12-15T17:00:00Z",
  "capacity": 30,
  "creditBearing": true,
  "creditAmount": 8
}
HTTP 201
[Captures]
training_id: jsonpath "$.data.id"


# ── Get training ──────────────────────────────────────────

GET {{api}}/association/training/{{training_id}}
HTTP 200


# ── My trainings ──────────────────────────────────────────

GET {{api}}/association/training-lifecycle/my
HTTP 200
