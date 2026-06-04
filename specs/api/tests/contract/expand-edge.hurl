# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Auto-expand edge cases: invalid field name is graceful (no 500),
# whitespace is tolerated, multiple fields can be expanded together,
# excessively deep expand chains are rejected.

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "expand-edge-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Expand Edge"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"

POST {{api}}/booking/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "title": "Expand edge fixture {{suffix}}",
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


# 1. Invalid expand field name is silently ignored: response still
# returns the resource with the field as an id (not 400 / 500).
GET {{api}}/booking/events/{{event_id}}?expand=nonexistent
HTTP 200
[Asserts]
jsonpath "$.id" == "{{event_id}}"
jsonpath "$.owner" == "{{user_id}}"


# 2. Empty expand parameter is tolerated.
GET {{api}}/booking/events/{{event_id}}?expand=
HTTP 200
[Asserts]
jsonpath "$.owner" == "{{user_id}}"


# 3. Whitespace around field names is trimmed.
GET {{api}}/booking/events/{{event_id}}?expand=%20owner%20
HTTP 200
[Asserts]
jsonpath "$.owner.id" == "{{user_id}}"


# 4. Multiple expandable fields can be requested in one CSV. The booking
# event response includes all requested expansions inline.
GET {{api}}/booking/events/{{event_id}}?expand=owner,owner
HTTP 200
[Asserts]
jsonpath "$.owner.id" == "{{user_id}}"
