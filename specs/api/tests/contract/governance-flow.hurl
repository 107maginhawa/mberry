# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Business Rules: [BR-09]
# Governance module contract test: list officer terms for the org.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: sign in as officer ───────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── 0. Unauth → 401 ───────────────────────────────────────

POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/association/member/officer-terms?organizationId=ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── 1. List officer terms ─────────────────────────────────
# Response shape: `{ items: [...], total, page, … }` — paginated list
# envelope used across listing endpoints. Spec previously asserted
# `$.data isCollection` from an earlier wire shape; updated to `$.items`.

GET {{api}}/association/member/officer-terms?organizationId={{org_id}}
HTTP 200
[Asserts]
jsonpath "$.items" isCollection
