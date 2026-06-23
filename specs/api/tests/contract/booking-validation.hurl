# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# [BR-75][BR-76][BR-77] Booking event config validation — wire boundary.
# Create-time validation rules were backend-only. This asserts each is rejected
# with a clean 400 at the wire (not a DB-CHECK 500): the effective-date ordering
# (BR-75 — previously a raw 500 SQL leak, fixed here), the maxBookingDays 0–365
# range (BR-76), and the minBookingMinutes 0–4320 range (BR-77).

# 0. Sign in as the seed officer (association:admin for {{org_id}}).
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200


# 1. Baseline — a valid config is accepted (201).
POST {{api}}/booking/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "title": "Validation baseline {{suffix}}",
  "timezone": "America/New_York",
  "locationTypes": ["video"],
  "maxBookingDays": 60,
  "minBookingMinutes": 60,
  "effectiveFrom": "2026-01-01T00:00:00Z",
  "effectiveTo": "2026-12-31T00:00:00Z",
  "dailyConfigs": { "mon": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "17:00", "slotDuration": 30 }] } }
}
HTTP 201


# 2. [BR-75] effectiveTo on/before effectiveFrom → 400 (was a 500 SQL leak).
POST {{api}}/booking/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "title": "Bad dates {{suffix}}",
  "timezone": "America/New_York",
  "locationTypes": ["video"],
  "maxBookingDays": 60,
  "minBookingMinutes": 60,
  "effectiveFrom": "2026-12-31T00:00:00Z",
  "effectiveTo": "2026-01-01T00:00:00Z",
  "dailyConfigs": { "mon": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "17:00", "slotDuration": 30 }] } }
}
HTTP 400


# 3. [BR-76] maxBookingDays > 365 → 400.
POST {{api}}/booking/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "title": "Bad maxDays {{suffix}}",
  "timezone": "America/New_York",
  "locationTypes": ["video"],
  "maxBookingDays": 366,
  "minBookingMinutes": 60,
  "dailyConfigs": { "mon": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "17:00", "slotDuration": 30 }] } }
}
HTTP 400


# 4. [BR-77] minBookingMinutes > 4320 (72h) → 400.
POST {{api}}/booking/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "title": "Bad minMinutes {{suffix}}",
  "timezone": "America/New_York",
  "locationTypes": ["video"],
  "maxBookingDays": 60,
  "minBookingMinutes": 4321,
  "dailyConfigs": { "mon": { "enabled": true, "timeBlocks": [{ "startTime": "09:00", "endTime": "17:00", "slotDuration": 30 }] } }
}
HTTP 400
