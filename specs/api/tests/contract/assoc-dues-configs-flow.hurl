# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association dues configs CRUD flow: create, list, get, update, delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "dues-cfg-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "DuesConfig Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "DuesConfig",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. CREATE dues config.
POST {{api}}/association/member/dues-configs
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "name": "Annual Dues {{suffix}}",
  "amount": 15000,
  "currency": "PHP",
  "frequency": "annual"
}
HTTP 201
[Captures]
dues_config_id: jsonpath "$.id"


# 2. LIST dues configs.
GET {{api}}/association/member/dues-configs
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET dues config by ID.
GET {{api}}/association/member/dues-configs/{{dues_config_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE dues config.
PATCH {{api}}/association/member/dues-configs/{{dues_config_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "amount": 20000
}
HTTP 200


# 5. DELETE dues config.
DELETE {{api}}/association/member/dues-configs/{{dues_config_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. 401 — request without auth cookie.
GET {{api}}/association/member/dues-configs/{{dues_config_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 7. 404 — fake UUID.
GET {{api}}/association/member/dues-configs/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
