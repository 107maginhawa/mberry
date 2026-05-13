# Extended booking endpoints not covered by booking-flow.hurl.
# Covers DELETE event, GET single booking, GET single slot.
# Creates an event + booking first to get IDs.

# ── 0. Create host ───────────────────────────────────────────

POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "book-ext-host-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "BookExt Host"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "BookExtHost",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# ── 1. Create event ─────────────────────────────────────────

POST {{api}}/booking/events
Content-Type: application/json
{
  "title": "Ext booking event {{suffix}}",
  "timezone": "America/New_York",
  "locationTypes": ["video"],
  "maxBookingDays": 60,
  "minBookingMinutes": 60,
  "status": "active",
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "dailyConfigs": {
    "mon": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "17:00", "slotDuration": 30 }] },
    "tue": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "17:00", "slotDuration": 30 }] }
  }
}
HTTP 201
[Captures]
event_id: jsonpath "$.id"


# ── 2. Get slots to capture a slot ID ────────────────────────

GET {{api}}/booking/events/{{event_id}}/slots?status=available
HTTP 200
[Captures]
slot_id: jsonpath "$[0].id"
[Asserts]
jsonpath "$" isCollection


# ── 3. Get single slot ──────────────────────────────────────

GET {{api}}/booking/slots/{{slot_id}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 4. Create a client and book ──────────────────────────────

POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "book-ext-client-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "BookExt Client"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "BookExtClient",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


POST {{api}}/booking/bookings
Content-Type: application/json
{
  "slot": "{{slot_id}}",
  "locationType": "video",
  "reason": "Extended contract test"
}
HTTP 201
[Captures]
booking_id: jsonpath "$.id"


# ── 5. Get single booking ───────────────────────────────────

GET {{api}}/booking/bookings/{{booking_id}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 6. Switch back to host and delete event ──────────────────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "book-ext-host-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


DELETE {{api}}/booking/events/{{event_id}}
HTTP *
[Asserts]
status >= 200
status < 300
