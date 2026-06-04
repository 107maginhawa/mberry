# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association membership categories flow: list and update.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-cat-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Categories Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Categories",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. LIST membership categories.
GET {{api}}/association/member/membership-categories
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 2. UPDATE membership categories for org.
PUT {{api}}/association/member/membership-categories/ed8e3a96-8126-4341-be42-e6eb7940c562
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "categories": ["Regular", "Associate", "Fellow"]
}
HTTP 200


# 3. 401 — request without auth cookie.
GET {{api}}/association/member/membership-categories
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
