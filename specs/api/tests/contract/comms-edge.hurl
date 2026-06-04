# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Comms edge cases: duplicate room with upsert=false yields 409, message
# length cap, non-participant cannot read messages, non-participant
# cannot send.

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "comms-x-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Comms X"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "comms-y-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Comms Y"
}
HTTP 200

GET {{api}}/comms/chat-rooms/{{room_id}}/messages
HTTP *
[Asserts]
status >= 401
status <= 404


# 5. Outsider Z cannot send messages in this room either.
POST {{api}}/comms/chat-rooms/{{room_id}}/messages
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "messageType": "text",
  "message": "I'm an outsider"
}
HTTP *
[Asserts]
status >= 400
status < 500
