# Extended communications (announcements) endpoints not covered by
# communications-flow.hurl. Covers update, delete, publish, archive.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth ─────────────────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200


# ── 1. Create an announcement to work with ──────────────────

POST {{api}}/communications/announcements/ed8e3a96-8126-4341-be42-e6eb7940c562
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
Content-Type: application/json
{}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 4. Archive announcement ─────────────────────────────────

POST {{api}}/communications/announcements/{{announcement_id}}/archive
Content-Type: application/json
{}
HTTP *
[Asserts]
status >= 200
status < 300


# ── 5. Delete announcement ──────────────────────────────────

DELETE {{api}}/communications/announcements/{{announcement_id}}
HTTP *
[Asserts]
status >= 200
status < 300
