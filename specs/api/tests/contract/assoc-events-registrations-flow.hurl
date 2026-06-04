# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association event registrations CRUD flow: create, list, get, update,
# action endpoints (cancel, refund), then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-evt-reg-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "EvtReg Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "EvtReg",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 0b. Create an event to register against.
POST {{api}}/association/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "Reg Test Event {{suffix}}",
  "description": "Event for registration tests",
  "startDate": "2026-08-01T09:00:00Z",
  "endDate": "2026-08-01T17:00:00Z"
}
HTTP 201
[Captures]
event_id: jsonpath "$.id"


# 1. CREATE registration.
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


# 2. LIST registrations.
GET {{api}}/association/events/registrations
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET registration by ID.
GET {{api}}/association/events/registrations/{{registration_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE registration.
PATCH {{api}}/association/events/registrations/{{registration_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "notes": "Updated registration notes"
}
HTTP 200


# 5. Cancel registration.
POST {{api}}/association/events/registrations/{{registration_id}}/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 6. Refund registration.
POST {{api}}/association/events/registrations/{{registration_id}}/refund
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 7. DELETE registration.
DELETE {{api}}/association/events/registrations/{{registration_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 8. 401 — request without auth cookie.
GET {{api}}/association/events/registrations
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
