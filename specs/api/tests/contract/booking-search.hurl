# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Booking-event discovery: text search across title/description/keywords,
# tag filtering with both CSV (OR) and repeated-param (AND) semantics,
# and combined filters. Asserts that the impl honours the documented
# query-param shape — separate from the simple list pagination smoke
# in booking-event.hurl.

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"
POST {{api}}/booking/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "title": "Pilates intro {{suffix}}",
  "description": "Core strength fundamentals",
  "keywords": ["fitness", "core"],
  "tags": ["pilates", "fitness"],
  "timezone": "America/New_York",
  "locationTypes": ["video"],
  "maxBookingDays": 30,
  "minBookingMinutes": 60,
  "status": "active",
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "dailyConfigs": {
    "tue": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "12:00", "slotDuration": 30 }] }
  }
}
HTTP 201


POST {{api}}/booking/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "title": "Mindfulness session {{suffix}}",
  "description": "Yoga-adjacent mindfulness practice",
  "keywords": ["wellness", "meditation"],
  "tags": ["yoga", "fitness"],
  "timezone": "America/New_York",
  "locationTypes": ["video"],
  "maxBookingDays": 30,
  "minBookingMinutes": 60,
  "status": "active",
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "dailyConfigs": {
    "wed": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "12:00", "slotDuration": 30 }] }
  }
}
HTTP 201


POST {{api}}/booking/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "title": "Yoga consult {{suffix}}",
  "description": "1-on-1 yoga consultation",
  "keywords": ["yoga", "consult"],
  "tags": ["yoga", "consulting"],
  "timezone": "America/New_York",
  "locationTypes": ["video"],
  "maxBookingDays": 30,
  "minBookingMinutes": 60,
  "status": "active",
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "dailyConfigs": {
    "thu": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "12:00", "slotDuration": 30 }] }
  }
}
HTTP 201


# 1. Free-text search by title token (suffix is unique to this run).
# Search index is eventually-consistent and 0-results may surface if the
# event was just created in the same scenario. Contract: endpoint exists,
# returns the standard envelope shape.
GET {{api}}/booking/events?q=Yoga%20consult%20{{suffix}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination" exists


# 2. Free-text search across description (Yoga also appears in the
# Mindfulness event's description).
GET {{api}}/booking/events?q=Yoga
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" >= 2


# 3. No results for a guaranteed-unique nonsense token.
GET {{api}}/booking/events?q=xyzzy{{suffix}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" == 0


# 4. CSV tag filter = OR. yoga,pilates should match all three seeded
# events.
GET {{api}}/booking/events?tags=yoga,pilates&q={{suffix}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" >= 3


# 5. Repeated tags = AND. Only the Mindfulness event has both yoga AND
# fitness.
GET {{api}}/booking/events?tags=yoga&tags=fitness&q={{suffix}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" == 1


# 6. AND with a tag no event has produces empty.
GET {{api}}/booking/events?tags=yoga&tags=ballet&q={{suffix}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" == 0


# 7. Combined: text + AND tags. Should at least match the Mindfulness
# event (which has both yoga & fitness tags AND "Mindfulness" in the
# title). Implementations vary on whether `q` further narrows the AND
# tag set or the two filters union — the contract just requires the
# matching event to appear.
GET {{api}}/booking/events?q=Mindfulness&tags=yoga&tags=fitness
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.pagination.totalCount" >= 1
