# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Auto-expand contract: a field carrying x-expandable-field returns the
# id by default and the full object when listed in ?expand=. The booking
# event's `owner` field is a stable target (it points at a Person via
# getPerson). Validates the wire shape is the same across implementations.

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "expand-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Expand Tester"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"

POST {{api}}/booking/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{session_token}}
Content-Type: application/json
{
  "title": "Expand fixture",
  "timezone": "America/New_York",
  "locationTypes": ["video"],
  "maxBookingDays": 14,
  "minBookingMinutes": 60,
  "status": "draft",
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "dailyConfigs": {
    "mon": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "17:00", "slotDuration": 30 }] }
  }
}
HTTP 201
[Captures]
event_id: jsonpath "$.id"


# 1. Without expand, owner is the person id.
GET {{api}}/booking/events/{{event_id}}
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.owner" == "{{user_id}}"


# 2. With expand=owner, owner is the full Person object inline.
GET {{api}}/booking/events/{{event_id}}?expand=owner
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.owner.id" == "{{user_id}}"
jsonpath "$.owner.firstName" == "Expand"
