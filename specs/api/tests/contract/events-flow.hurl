# Events module contract test: officer creates event, member registers,
# officer checks in member, lists attendance.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: sign in as officer ───────────────────────────────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 0. Unauth → 401 ───────────────────────────────────────

POST {{api}}/auth/sign-out
HTTP 200

GET {{api}}/events/list/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 1. List events ─────────────────────────────────────────

GET {{api}}/events/list/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 2. Create event ────────────────────────────────────────

POST {{api}}/events/create/ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Contract Test Event {{suffix}}",
  "description": "Test event",
  "location": "Test Venue",
  "startDate": "2026-12-01T09:00:00Z",
  "endDate": "2026-12-01T17:00:00Z",
  "capacity": 50
}
HTTP 201
[Captures]
event_id: jsonpath "$.data.id"


# ── 3. Get event ───────────────────────────────────────────

GET {{api}}/events/detail/{{event_id}}
HTTP 200


# ── 4. My events (member view) ─────────────────────────────

GET {{api}}/events/my
HTTP 200
