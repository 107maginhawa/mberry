# member/chapters — affiliation transfer happy lifecycle
#
# Covers operationIds:
#   createAffiliationTransfer, approveTransferBySource,
#   approveTransferByTarget, completeAffiliationTransfer,
#   getAffiliationTransfer, listAffiliationTransfers
# Real flow: officer creates source affiliation in current org pointing
# at pda-metro-manila (current org), submits transfer to pda-cebu, both
# chapter officers approve (source then target), officer completes.
# Verifies the state machine transitions: requested →
# pendingTargetApproval → approved → completed.
#
# Seed dependency: pda-cebu chapter org must exist with id
# c5b0ed2c-1a51-4445-b548-416df7d27415. See src/seed/layer-1-foundation.ts.

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── 0. Sign in as seeded officer (admin) ───────────────────────────────────
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
officer_cookie: cookie "better-auth.session_token"
officer_user_id: jsonpath "$.user.id"

# ── 1. Sign up the transferring person ─────────────────────────────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "xfer-target-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Xfer Target {{suffix}}"
}
HTTP 200
[Captures]
transferring_person_id: jsonpath "$.user.id"

# ── 2. Re-sign in as officer + create the source affiliation ───────────────
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

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
officer_cookie: cookie "better-auth.session_token"
officer_user_id: jsonpath "$.user.id"

POST {{api}}/association/member/chapter-affiliations
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{transferring_person_id}}",
  "chapterId": "ed8e3a96-8126-4341-be42-e6eb7940c562",
  "isPrimary": true,
  "affiliatedAt": "2026-01-01T00:00:00.000Z"
}
HTTP 201
[Captures]
source_affiliation_id: jsonpath "$.id"

# ── 3. Submit transfer request (pda-metro-manila → pda-cebu) ───────────────
POST {{api}}/association/member/affiliation-transfers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{transferring_person_id}}",
  "fromChapterId": "ed8e3a96-8126-4341-be42-e6eb7940c562",
  "toChapterId": "c5b0ed2c-1a51-4445-b548-416df7d27415"
}
HTTP 201
[Captures]
transfer_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "requested"

# ── 4. Source officer approves → pendingTargetApproval ─────────────────────
POST {{api}}/association/member/affiliation-transfers/{{transfer_id}}/approve-source
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "officerId": "{{officer_user_id}}",
  "reason": "Source ok"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "pendingTargetApproval"

# ── 5. Target officer approves → approved ──────────────────────────────────
POST {{api}}/association/member/affiliation-transfers/{{transfer_id}}/approve-target
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "officerId": "{{officer_user_id}}",
  "reason": "Target accepts"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "approved"

# ── 6. Complete → completed ────────────────────────────────────────────────
POST {{api}}/association/member/affiliation-transfers/{{transfer_id}}/complete
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.status" == "completed"
jsonpath "$.completedAt" exists

# ── 7. GET resolves transfer in terminal state ─────────────────────────────
GET {{api}}/association/member/affiliation-transfers/{{transfer_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.status" == "completed"

# ── 8. LIST filtered by personId includes the transfer ─────────────────────
GET {{api}}/association/member/affiliation-transfers?personId={{transferring_person_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 200
[Asserts]
jsonpath "$.data[?(@.id=='{{transfer_id}}')]" exists
