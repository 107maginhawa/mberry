# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association event check-ins flow: list and create check-ins.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-checkin-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Checkin Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Checkin",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 0b. Create event + registration for check-in.
POST {{api}}/association/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "Checkin Test Event {{suffix}}",
  "description": "Event for check-in tests",
  "startDate": "2026-08-15T09:00:00Z",
  "endDate": "2026-08-15T17:00:00Z"
}
HTTP 201
[Captures]
event_id: jsonpath "$.id"


POST {{api}}/association/events/registrations
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "eventId": "{{event_id}}",
  "personId": "{{person_id}}"
}
HTTP 201
[Captures]
registration_id: jsonpath "$.id"


# 1. LIST check-ins.
GET {{api}}/association/events/checkins
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 2. CREATE check-in.
POST {{api}}/association/events/checkins
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "eventId": "{{event_id}}",
  "registrationId": "{{registration_id}}",
  "personId": "{{person_id}}"
}
HTTP 201


# 3. 401 — request without auth cookie.
GET {{api}}/association/events/checkins
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
