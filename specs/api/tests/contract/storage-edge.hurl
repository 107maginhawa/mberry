# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Storage edge cases: missing-file 4xx on download, can't download a file
# still in `uploading` status, special chars in filename round-trip, and a
# non-owner cannot read someone else's file metadata.
#
# Storage uploads are tenant-scoped (P0-7 / migration 0081: stored_file.organization_id
# is NOT NULL). The /storage/* route uses orgContextOptionalMiddleware, which only sets
# the org for an ACTIVE MEMBER of the x-org-id org — so the file owner signs in as the
# seeded officer (a member of the seeded org) and sends x-org-id on every storage call.
# The "other user" is a fresh non-member whose read is blocked by the org/owner guard.
# Requires: seeded org + officer (test@memberry.ph) from db:seed-modules.
# Org ID: ed8e3a96-8126-4341-be42-e6eb7940c562

# ── Auth: file owner signs in as the seeded officer (member of the seeded org) ──
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200
[Captures]
owner_cookie: cookie "better-auth.session_token"


# Create a file (status=uploading until binary is PUT), then try to
# download it — should 4xx because not yet uploaded.
POST {{api}}/storage/files/upload
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{owner_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "filename": "pending-edge-{{suffix}}.pdf",
  "size": 100,
  "mimeType": "application/pdf"
}
HTTP 201
[Captures]
pending_file: jsonpath "$.file"

GET {{api}}/storage/files/{{pending_file}}/download
Cookie: better-auth.session_token={{owner_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status >= 400
status < 500


# 5. Filenames with special characters round-trip through metadata.
POST {{api}}/storage/files/upload
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{owner_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "filename": "Anaïs's résumé (final v2).pdf",
  "size": 42,
  "mimeType": "application/pdf"
}
HTTP 201
[Captures]
special_file: jsonpath "$.file"


GET {{api}}/storage/files/{{special_file}}
Cookie: better-auth.session_token={{owner_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.filename" == "Anaïs's résumé (final v2).pdf"


# 6. Another user cannot read someone else's file metadata. A fresh non-member
# of the seeded org is blocked by the org/owner guard (org mismatch → 403).
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "storage-other-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Storage Other"
}
HTTP 200
[Captures]
other_cookie: cookie "better-auth.session_token"

GET {{api}}/storage/files/{{special_file}}
Cookie: better-auth.session_token={{other_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status >= 401
status <= 404
