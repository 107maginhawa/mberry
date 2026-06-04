# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association dues invoices CRUD flow: create, list, generate batch,
# get, update, mark-paid, then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "dues-inv-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Invoice Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Invoice",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE dues invoice.
POST {{api}}/association/member/dues-invoices
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "amount": 15000,
  "currency": "PHP",
  "dueDate": "2026-12-31",
  "description": "Annual dues {{suffix}}"
}
HTTP 201
[Captures]
invoice_id: jsonpath "$.id"


# 2. LIST dues invoices.
GET {{api}}/association/member/dues-invoices
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. Generate batch invoices.
POST {{api}}/association/member/dues-invoices/generate
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "dueDate": "2026-12-31",
  "description": "Batch generation test {{suffix}}"
}
HTTP 200


# 4. GET invoice by ID.
GET {{api}}/association/member/dues-invoices/{{invoice_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 5. UPDATE invoice.
PATCH {{api}}/association/member/dues-invoices/{{invoice_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "description": "Updated dues {{suffix}}"
}
HTTP 200


# 6. Mark invoice as paid.
POST {{api}}/association/member/dues-invoices/{{invoice_id}}/mark-paid
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 7. DELETE invoice.
DELETE {{api}}/association/member/dues-invoices/{{invoice_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 8. 401 — request without auth cookie.
GET {{api}}/association/member/dues-invoices/{{invoice_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 9. 404 — fake UUID.
GET {{api}}/association/member/dues-invoices/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
