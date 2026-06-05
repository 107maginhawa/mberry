# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association messages CRUD flow: create, send, delete.

# 0. Auth as seeded officer (has compose/send permission).
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"

# 1. CREATE message (draft).
POST {{api}}/association/messages
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "organizationId": "{{org_id}}",
  "subject": "Contract Test Msg {{suffix}}",
  "body": "Test body",
  "channel": "email",
  "status": "draft"
}
HTTP *
[Captures]
message_id: jsonpath "$.id"
[Asserts]
status >= 200
status < 300

# 2. SEND the message.
POST {{api}}/association/messages/{{message_id}}/send
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP *
[Asserts]
status < 500


# 3. DELETE message.
DELETE {{api}}/association/messages/{{message_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status < 500


# 4. Sign out and confirm 401.
POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/association/messages
x-org-id: {{org_id}}
HTTP 401
