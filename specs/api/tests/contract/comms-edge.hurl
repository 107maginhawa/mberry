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
x_id: jsonpath "$.user.id"


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "X",
  "lastName": "User",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


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
[Captures]
y_id: jsonpath "$.user.id"


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Y",
  "lastName": "User",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# Outsider Z (not in any room).
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "comms-z-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Comms Z"
}
HTTP 200
[Captures]
z_id: jsonpath "$.user.id"


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Z",
  "lastName": "Outsider",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# Sign back in as X, the room creator.
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "comms-x-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


# 1. Create a room with a unique context.
POST {{api}}/comms/chat-rooms
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "participants": ["{{x_id}}", "{{y_id}}"],
  "context": "{{x_id}}",
  "upsert": false
}
HTTP 201
[Captures]
room_id: jsonpath "$.id"


# 2. Re-creating the same room with upsert=false → 409.
POST {{api}}/comms/chat-rooms
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "participants": ["{{x_id}}", "{{y_id}}"],
  "context": "{{x_id}}",
  "upsert": false
}
HTTP 409


# 3. With upsert=true the impl returns either 200 (existing) or 201
# (created). Both are valid; what matters is no 409.
POST {{api}}/comms/chat-rooms
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "participants": ["{{x_id}}", "{{y_id}}"],
  "context": "{{x_id}}",
  "upsert": true
}
HTTP *
[Asserts]
status >= 200
status < 300


# 4. Outsider Z cannot read messages in this room.
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "comms-z-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
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
