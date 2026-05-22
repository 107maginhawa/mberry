# Extended comms endpoints not covered by comms.hurl.
# Covers single room GET, ICE servers, and video call operations.
# Video/WebRTC endpoints require infrastructure and use HTTP * assertions.

# ── Auth: two users to create a room ─────────────────────────

POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "comms-ext-a-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "CommsExt A"
}
HTTP 200
[Captures]
a_id: jsonpath "$.user.id"


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "CommsExtA",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "comms-ext-b-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "CommsExt B"
}
HTTP 200
[Captures]
b_id: jsonpath "$.user.id"


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "CommsExtB",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# Sign back in as A to create room
POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "comms-ext-a-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest"
}
HTTP 200


POST {{api}}/comms/chat-rooms
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


# ── 1. Get single room ──────────────────────────────────────

GET {{api}}/comms/chat-rooms/{{room_id}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 2. ICE servers ──────────────────────────────────────────
# PREREQUISITE: Requires TURN server config

GET {{api}}/comms/ice-servers
HTTP *


# ── 3. Update video call participant ────────────────────────
# PREREQUISITE: Requires WebRTC infrastructure

PATCH {{api}}/comms/chat-rooms/{{room_id}}/video-call/participant
Content-Type: application/json
{
  "audioEnabled": true,
  "videoEnabled": false
}
HTTP *


# ── 4. Join video call ──────────────────────────────────────
# PREREQUISITE: Requires WebRTC infrastructure

POST {{api}}/comms/chat-rooms/{{room_id}}/video-call/join
Content-Type: application/json
{}
HTTP *


# ── 5. Leave video call ─────────────────────────────────────
# PREREQUISITE: Requires WebRTC infrastructure

POST {{api}}/comms/chat-rooms/{{room_id}}/video-call/leave
Content-Type: application/json
{}
HTTP *


# ── 6. End video call ───────────────────────────────────────
# PREREQUISITE: Requires WebRTC infrastructure

POST {{api}}/comms/chat-rooms/{{room_id}}/video-call/end
Content-Type: application/json
{}
HTTP *
