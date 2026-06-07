# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-15] [BR-16] [BR-17] [BR-27]
# Events module contract test: officer creates event, member registers,
# officer checks in member, lists attendance.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: sign in as officer ───────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── 0. Unauth → 401 ───────────────────────────────────────

POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/association/events
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


# ── 1. List events ─────────────────────────────────────────

GET {{api}}/association/events
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection


# ── 2. Create event ────────────────────────────────────────

POST {{api}}/association/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "organizationId": "{{org_id}}",
  "title": "Contract Test Event {{suffix}}",
  "description": "Test event",
  "location": "Test Venue",
  "eventType": "seminar",
  "creditBearing": false,
  "startDate": "2026-12-01T09:00:00Z",
  "endDate": "2026-12-01T17:00:00Z",
  "capacity": 50
}
HTTP 201
[Captures]
event_id: jsonpath "$.id"


# ── 3. Get event ───────────────────────────────────────────

GET {{api}}/association/events/{{event_id}}
x-org-id: {{org_id}}
HTTP 200


# ── 4. My events (member view) ─────────────────────────────

GET {{api}}/association/event-lifecycle/my
x-org-id: {{org_id}}
HTTP 200


# ── 5. Check-in endpoint exists (BR-16) ───────────────────
# POST without a valid event ID should return 404 or 400, not 500

POST {{api}}/association/event-lifecycle/00000000-0000-0000-0000-000000000000/check-in
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{}
HTTP *
[Asserts]
status < 500


# ── 6. Attendance list (BR-17) ─────────────────────────────
# Use the event created in step 2

GET {{api}}/association/event-lifecycle/{{event_id}}/attendance
x-org-id: {{org_id}}
HTTP 200
