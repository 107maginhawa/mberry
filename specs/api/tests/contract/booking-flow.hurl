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

# 0. Sign in as the seeded officer (acts as the host with org access).
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200


# 1. Create a booking event.
POST {{api}}/booking/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "title": "Flow Event {{suffix}}",
  "timezone": "America/New_York",
  "locationTypes": ["video"],
  "maxBookingDays": 60,
  "minBookingMinutes": 60,
  "status": "active",
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "dailyConfigs": {
    "mon": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "17:00", "slotDuration": 30 }] }
  }
}
HTTP 201
[Captures]
event_id: jsonpath "$.id"


# 2. List slots for that event.
GET {{api}}/booking/events/{{event_id}}/slots?status=available
x-org-id: {{org_id}}
HTTP 200
[Captures]
slot_id: jsonpath "$[0].id"


# 3. Create a booking against the first slot.
POST {{api}}/booking/bookings
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "slot": "{{slot_id}}",
  "locationType": "video",
  "reason": "Flow test"
}
HTTP 201
[Captures]
booking_id: jsonpath "$.id"


# 4. Confirm the booking (officer).
POST {{api}}/booking/bookings/{{booking_id}}/confirm
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{ "reason": "Confirmed by host" }
HTTP 200
[Asserts]
jsonpath "$.status" == "confirmed"


# 5. Cancel the booking (same officer — keeps the flow single-actor;
# multi-actor coverage lives in booking-edge.hurl).
POST {{api}}/booking/bookings/{{booking_id}}/cancel
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{ "reason": "Schedule conflict" }
HTTP 200
[Asserts]
jsonpath "$.status" == "cancelled"
