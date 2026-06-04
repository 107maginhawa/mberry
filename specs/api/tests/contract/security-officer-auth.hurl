# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Security: Officer API Authorization Tests
# Business Rules: [BR-09]
# Verifies that officer-only endpoints reject non-officer users
# and that cross-org data leakage is prevented.

# ── 1. Sign up a fresh non-officer user ─────────────────────

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "security-test-{{timestamp}}@example.com",
  "password": "SecureTest123!",
  "name": "Security Tester"
}
HTTP *
[Asserts]
status < 500


# ── 2. Sign in as the fresh user ────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "security-test-{{timestamp}}@example.com",
  "password": "SecureTest123!"
}
HTTP *
[Asserts]
status < 500


# ── 3. Officer endpoints should reject non-officer user ─────

# Dues configs (officer-only)
GET {{api}}/association/member/dues-configs
HTTP 403

# ORPHANED: /dues/funds/{orgId} has no spec equivalent
# GET {{api}}/dues/funds/ed8e3a96-8126-4341-be42-e6eb7940c562
# HTTP 403

# Financial dashboard (officer-only)
GET {{api}}/dues/dashboard/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 403

# Create event (officer-only)
POST {{api}}/association/events
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "title": "Unauthorized Event",
  "startDate": "2026-08-01T00:00:00Z",
  "endDate": "2026-08-01T23:59:59Z"
}
HTTP 403

# Member roster (officer-only)
GET {{api}}/membership/members/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 403

# Create training (officer-only)
POST {{api}}/association/training
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "title": "Unauthorized Training",
  "startDate": "2026-08-01T00:00:00Z",
  "endDate": "2026-08-01T23:59:59Z"
}
HTTP 403

# Create election (officer-only)
POST {{api}}/association/member/elections
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "title": "Unauthorized Election"
}
HTTP 403

# Create announcement (officer-only)
POST {{api}}/communications/announcements/ed8e3a96-8126-4341-be42-e6eb7940c562
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "title": "Unauthorized Announcement",
  "body": "Should not be created"
}
HTTP 403


# ── 4. Verify officer CAN access (sign in as officer) ───────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200

# Officer should get 200 on same endpoints
GET {{api}}/association/member/dues-configs
HTTP 200

GET {{api}}/dues/dashboard/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200

GET {{api}}/membership/members/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
