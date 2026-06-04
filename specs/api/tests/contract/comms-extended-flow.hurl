# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Extended comms endpoints not covered by comms.hurl.
# Covers single room GET, ICE servers, and video call operations.
# Video/WebRTC endpoints require infrastructure and use HTTP * assertions.

# ── Auth: two users to create a room ─────────────────────────

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "comms-ext-a-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "CommsExt A"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "comms-ext-b-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "CommsExt B"
}
HTTP 200
[Captures]
person_id: jsonpath "$.user.id"

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
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "audioEnabled": true,
  "videoEnabled": false
}
HTTP *


# ── 4. Join video call ──────────────────────────────────────
# PREREQUISITE: Requires WebRTC infrastructure

POST {{api}}/comms/chat-rooms/{{room_id}}/video-call/join
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{}
HTTP *


# ── 5. Leave video call ─────────────────────────────────────
# PREREQUISITE: Requires WebRTC infrastructure

POST {{api}}/comms/chat-rooms/{{room_id}}/video-call/leave
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{}
HTTP *


# ── 6. End video call ───────────────────────────────────────
# PREREQUISITE: Requires WebRTC infrastructure

POST {{api}}/comms/chat-rooms/{{room_id}}/video-call/end
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{}
HTTP *
