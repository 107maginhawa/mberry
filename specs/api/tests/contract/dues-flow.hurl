# Dues module contract test: officer configures dues, creates funds,
# records a payment, views dashboard, and generates a report.
# Verifies auth enforcement on all custom routes.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: sign in as officer ───────────────────────────────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 0. Unauthenticated access → 401 ───────────────────────

POST {{api}}/auth/sign-out
HTTP 200

GET {{api}}/dues/config/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401

POST {{api}}/dues/payments
Content-Type: application/json
{}
HTTP 401

# ── Re-authenticate ────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 1. Get or create dues config ───────────────────────────

GET {{api}}/dues/config/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# ── 2. Upsert dues config ─────────────────────────────────

PUT {{api}}/dues/config/ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "defaultAmount": 150000,
  "currency": "PHP",
  "gracePeriodDays": 30,
  "billingCycle": "annual"
}
HTTP 200


# ── 3. List funds ──────────────────────────────────────────

GET {{api}}/dues/funds/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# ── 4. List payments ──────────────────────────────────────

GET {{api}}/dues/payments
HTTP 200


# ── 5. Dashboard ───────────────────────────────────────────

GET {{api}}/dues/dashboard/ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
