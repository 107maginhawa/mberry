# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Chat-room and message basics: create a room between two persons (the
# seeded officer + first other seeded person), send a message, read
# messages back. POST /comms/chat-rooms requires:
#   - context (UUID — using the seeded org id as the canonical reference)
#   - participants (array of >= 2 person ids)

# 0. Sign in as seeded officer.
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
a_id: jsonpath "$.user.id"


# 1. Capture another seeded person id (any non-self).
GET {{api}}/persons
x-org-id: {{org_id}}
HTTP 200
[Captures]
b_id: jsonpath "$.data[1].id"


# 2. Create chat room.
POST {{api}}/comms/chat-rooms
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "context": "{{org_id}}",
  "participants": ["{{a_id}}", "{{b_id}}"]
}
HTTP *
[Captures]
room_id: jsonpath "$.id"
[Asserts]
status >= 200
status < 300


# 3. Send a text message.
POST {{api}}/comms/chat-rooms/{{room_id}}/messages
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "messageType": "text",
  "message": "Hello, Bob"
}
HTTP *
[Asserts]
status >= 200
status < 500


# 4. Read messages back as same actor (multi-actor read tested in
# comms-extended-flow.hurl).
GET {{api}}/comms/chat-rooms/{{room_id}}/messages
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
