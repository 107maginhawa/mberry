# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Extended comms endpoints not covered by comms.hurl.
# Covers single room GET, ICE servers, and video call operations.
# Video/WebRTC endpoints require infrastructure and use HTTP * assertions.

# ── Auth: sign in as seeded officer, capture a second person id ──

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

GET {{api}}/persons
x-org-id: {{org_id}}
HTTP 200
[Captures]
b_id: jsonpath "$.data[1].id"

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


# ── 1. Get single room ──────────────────────────────────────

GET {{api}}/comms/chat-rooms/{{room_id}}
x-org-id: {{org_id}}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 2. ICE servers ──────────────────────────────────────────
# PREREQUISITE: Requires TURN server config

GET {{api}}/comms/ice-servers
x-org-id: {{org_id}}
HTTP *


# ── 3. Update video call participant ────────────────────────
# PREREQUISITE: Requires WebRTC infrastructure

PATCH {{api}}/comms/chat-rooms/{{room_id}}/video-call/participant
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
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
x-org-id: {{org_id}}
{}
HTTP *


# ── 5. Leave video call ─────────────────────────────────────
# PREREQUISITE: Requires WebRTC infrastructure

POST {{api}}/comms/chat-rooms/{{room_id}}/video-call/leave
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP *


# ── 6. End video call ───────────────────────────────────────
# PREREQUISITE: Requires WebRTC infrastructure

POST {{api}}/comms/chat-rooms/{{room_id}}/video-call/end
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: {{org_id}}
{}
HTTP *
