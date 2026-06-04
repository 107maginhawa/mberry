# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association messages CRUD flow: create, list, get, update,
# action endpoints (send, schedule, cancel), then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-msgs-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Msgs Tester"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"

POST {{api}}/association/messages/{{send_message_id}}/send
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 8. DELETE message.
DELETE {{api}}/association/messages/{{message_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 9. 401 — request without auth cookie.
GET {{api}}/association/messages
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
