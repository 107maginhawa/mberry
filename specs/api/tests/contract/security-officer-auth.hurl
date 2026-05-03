# Security: Officer API Authorization Tests
# Business Rules: [BR-09]
# Verifies that officer-only endpoints reject non-officer users
# and that cross-org data leakage is prevented.

# ── 1. Sign up a fresh non-officer user ─────────────────────

POST {{api}}/auth/sign-up/email
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
Content-Type: application/json
{
  "email": "security-test-{{timestamp}}@example.com",
  "password": "SecureTest123!"
}
HTTP *
[Asserts]
status < 500


# ── 3. Officer endpoints should reject non-officer user ─────

# Dues config (officer-only, has :orgId)
GET {{api}}/dues/config/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 403

# Dues funds (officer-only)
GET {{api}}/dues/funds/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 403

# Financial dashboard (officer-only)
GET {{api}}/dues/dashboard/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 403

# Create event (officer-only)
POST {{api}}/events/create/ed8e3a96-8126-4341-be42-e6eb7940c562
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
POST {{api}}/training/create/ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Unauthorized Training",
  "startDate": "2026-08-01T00:00:00Z",
  "endDate": "2026-08-01T23:59:59Z"
}
HTTP 403

# Create election (officer-only)
POST {{api}}/elections/create/ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Unauthorized Election"
}
HTTP 403

# Create announcement (officer-only)
POST {{api}}/communications/announcements/ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Unauthorized Announcement",
  "body": "Should not be created"
}
HTTP 403


# ── 4. Verify officer CAN access (sign in as officer) ───────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200

# Officer should get 200 on same endpoints
GET {{api}}/dues/config/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200

GET {{api}}/dues/dashboard/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200

GET {{api}}/membership/members/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
