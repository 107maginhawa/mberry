# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association dues payments flow: list, create, get, submit proof,
# pending proofs, confirm, refund, reject.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "dues-pay-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Payment Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Payment",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE payment.
POST {{api}}/association/member/dues-payments
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "amount": 15000,
  "currency": "PHP",
  "method": "bank_transfer"
}
HTTP 201
[Captures]
payment_id: jsonpath "$.id"


# 2. LIST payments.
GET {{api}}/association/member/dues-payments
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET payment by ID.
GET {{api}}/association/member/dues-payments/{{payment_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. Submit proof of payment.
POST {{api}}/association/member/dues-payments/submit-proof
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "paymentId": "{{payment_id}}",
  "proofUrl": "https://example.org/receipt-{{suffix}}.png"
}
HTTP 200


# 5. LIST pending proofs.
GET {{api}}/association/member/dues-payments/pending-proofs
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. Confirm payment.
POST {{api}}/association/member/dues-payments/{{payment_id}}/confirm
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 7. Create another payment to test refund.
POST {{api}}/association/member/dues-payments
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "amount": 5000,
  "currency": "PHP",
  "method": "cash"
}
HTTP 201
[Captures]
payment_id_2: jsonpath "$.id"


# 8. Refund payment.
POST {{api}}/association/member/dues-payments/{{payment_id_2}}/refund
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 9. Create another payment to test reject.
POST {{api}}/association/member/dues-payments
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "amount": 3000,
  "currency": "PHP",
  "method": "cash"
}
HTTP 201
[Captures]
payment_id_3: jsonpath "$.id"


# 10. Reject payment.
POST {{api}}/association/member/dues-payments/{{payment_id_3}}/reject
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 11. 401 — request without auth cookie.
GET {{api}}/association/member/dues-payments/{{payment_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 12. 404 — fake UUID.
GET {{api}}/association/member/dues-payments/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
