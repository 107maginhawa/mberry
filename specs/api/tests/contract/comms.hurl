# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Chat-room and message basics. Requires `user:participant`, so the
# scenario covers list (empty), authentication, and creation of a
# direct chat room between two persons followed by a message round-trip.
# Switches active user via sign-in (Hurl's cookie jar tracks state).

# 0. User A signs up and creates a person profile.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "comms-a-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Comms A"
}
HTTP 200

POST {{api}}/comms/chat-rooms
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "participants": ["{{a_id}}", "{{b_id}}"],
  "context": "{{a_id}}"
}
HTTP *
[Captures]
room_id: jsonpath "$.id"
[Asserts]
status >= 200
status < 300


# 3. A sends a text message.
POST {{api}}/comms/chat-rooms/{{room_id}}/messages
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "messageType": "text",
  "message": "Hello, Bob"
}
HTTP 201


# 4. Switch to B and read the messages.
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "comms-b-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


GET {{api}}/comms/chat-rooms/{{room_id}}/messages
HTTP 200
[Asserts]
jsonpath "$.data" isCollection
jsonpath "$.pagination.totalCount" >= 1
