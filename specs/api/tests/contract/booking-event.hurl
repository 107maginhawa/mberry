# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# BookingEvent host-side lifecycle: a logged-in person creates a booking
# event, lists their own events, updates the title, and archives it.

# 0. Sign up + create person profile
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "host-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Booking Host"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"
