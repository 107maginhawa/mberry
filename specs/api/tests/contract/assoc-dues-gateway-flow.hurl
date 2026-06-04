# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association dues gateway flow: get, create/update, test connection, delete.
# Uses the seeded org ID directly in the path.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "dues-gw-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Gateway Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Gateway",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. PUT — create/update gateway config.
PUT {{api}}/association/member/dues-gateway/ed8e3a96-8126-4341-be42-e6eb7940c562
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "provider": "stripe",
  "enabled": true,
  "config": {
    "publishableKey": "pk_test_{{suffix}}",
    "secretKey": "sk_test_{{suffix}}"
  }
}
HTTP 200


# 2. GET gateway config.
GET {{api}}/association/member/dues-gateway/ed8e3a96-8126-4341-be42-e6eb7940c562
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. Test gateway connection.
POST {{api}}/association/member/dues-gateway/ed8e3a96-8126-4341-be42-e6eb7940c562/test
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 4. DELETE gateway config.
DELETE {{api}}/association/member/dues-gateway/ed8e3a96-8126-4341-be42-e6eb7940c562
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 5. 401 — request without auth cookie.
GET {{api}}/association/member/dues-gateway/ed8e3a96-8126-4341-be42-e6eb7940c562
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 6. 404 — fake org UUID.
GET {{api}}/association/member/dues-gateway/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
