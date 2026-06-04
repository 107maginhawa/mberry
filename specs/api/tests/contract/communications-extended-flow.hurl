# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Extended communications (announcements) endpoints not covered by
# communications-flow.hurl. Covers update, delete, publish, archive.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth ─────────────────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200


# ── 1. Create an announcement to work with ──────────────────

POST {{api}}/communications/announcements/ed8e3a96-8126-4341-be42-e6eb7940c562
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "title": "Extended Test Announcement {{suffix}}",
  "content": "Created for extended contract testing."
}
HTTP 201
[Captures]
announcement_id: jsonpath "$.data.id"


# ── 2. Update announcement ──────────────────────────────────

PATCH {{api}}/communications/announcements/{{announcement_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "title": "Updated Announcement {{suffix}}",
  "content": "Updated content for contract test."
}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 3. Publish announcement ─────────────────────────────────

POST {{api}}/communications/announcements/{{announcement_id}}/publish
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 4. Archive announcement ─────────────────────────────────

POST {{api}}/communications/announcements/{{announcement_id}}/archive
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 5. Delete announcement ──────────────────────────────────

DELETE {{api}}/communications/announcements/{{announcement_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP *
[Asserts]
status >= 200
status < 300
