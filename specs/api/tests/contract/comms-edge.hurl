# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Comms edge cases: non-participant can't read or send. Spec was a
# stub referencing undefined {{room_id}}. Rewrote to:
#   - sign in as seeded officer to create a room (the officer + one
#     other seeded person)
#   - then sign up a fresh "outsider" who is NOT a participant
#   - assert outsider can't read or send messages

# 1. Sign in as seeded officer.
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

# 2. Capture another seeded person id.
GET {{api}}/persons
x-org-id: {{org_id}}
HTTP 200
[Captures]
b_id: jsonpath "$.data[1].id"

# 3. Create room as officer (or capture existing on 409 re-run).
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
[Asserts]
status >= 200
status < 500

GET {{api}}/comms/chat-rooms
x-org-id: {{org_id}}
HTTP 200
[Captures]
room_id: jsonpath "$.data[0].id"

# 4. Sign out, sign up outsider.
POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "outsider-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Outsider"
}
HTTP 200

# 5. Outsider can't read messages in this room.
GET {{api}}/comms/chat-rooms/{{room_id}}/messages
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 401
status <= 404

# 6. Outsider can't send messages either.
POST {{api}}/comms/chat-rooms/{{room_id}}/messages
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{
  "messageType": "text",
  "message": "I'm an outsider"
}
HTTP *
[Asserts]
status >= 400
status < 500
