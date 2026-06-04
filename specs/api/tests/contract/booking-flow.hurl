# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# End-to-end booking flow: a host publishes an active event, a client
# books an open slot, the host confirms, then the client cancels. Slots
# are auto-generated from the event's dailyConfigs as soon as it goes
# active. Relies on Hurl's cookie jar; sign in / sign up to switch
# whichever user is "active".

# 0. Create the host.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "flow-host-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Booking Host"
}
HTTP 200

POST {{api}}/booking/bookings/{{booking_id}}/confirm
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{ "reason": "Confirmed by host" }
HTTP 200
[Asserts]
jsonpath "$.status" == "confirmed"


# 7. Switch back to client to cancel.
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "flow-client-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


POST {{api}}/booking/bookings/{{booking_id}}/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{ "reason": "Schedule conflict" }
HTTP 200
[Asserts]
jsonpath "$.status" == "cancelled"
