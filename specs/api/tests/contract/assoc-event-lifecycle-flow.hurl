# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association event lifecycle flow: my events, attendance, registrations,
# check-in, and register actions.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-evtlife-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "EvtLife Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "EvtLife",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 0b. Create an event for lifecycle tests.
POST {{api}}/association/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "Lifecycle Test Event {{suffix}}",
  "description": "Event for lifecycle tests",
  "startDate": "2026-09-01T09:00:00Z",
  "endDate": "2026-09-01T17:00:00Z"
}
HTTP 201
[Captures]
event_id: jsonpath "$.id"


# 1. My events (user-scoped, no x-org-id needed).
GET {{api}}/association/event-lifecycle/my
HTTP 200


# 2. Register for event.
POST {{api}}/association/event-lifecycle/{{event_id}}/register
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 3. List registrations for event.
GET {{api}}/association/event-lifecycle/{{event_id}}/registrations
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. Check in to event.
POST {{api}}/association/event-lifecycle/{{event_id}}/check-in
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 5. Attendance for event.
GET {{api}}/association/event-lifecycle/{{event_id}}/attendance
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. 401 — request without auth cookie.
GET {{api}}/association/event-lifecycle/my
HTTP 401
