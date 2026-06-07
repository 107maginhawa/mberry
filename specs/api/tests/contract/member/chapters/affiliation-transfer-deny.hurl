# member/chapters — affiliation transfer deny terminal state
#
# Covers operationIds: createAffiliationTransfer, denyAffiliationTransfer
# Real flow: officer creates source affiliation + transfer, officer denies,
# transfer enters terminal `denied` state and cannot be re-approved.

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

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "deny-target-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Deny Target {{suffix}}"
}
HTTP 200
[Captures]
deny_person_id: jsonpath "$.user.id"

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

# Source affiliation precondition.
POST {{api}}/association/member/chapter-affiliations
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{deny_person_id}}",
  "chapterId": "ed8e3a96-8126-4341-be42-e6eb7940c562",
  "isPrimary": true,
  "affiliatedAt": "2026-01-01T00:00:00.000Z"
}
HTTP 201

# Submit transfer (pda-metro-manila → pda-cebu).
POST {{api}}/association/member/affiliation-transfers
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "personId": "{{deny_person_id}}",
  "fromChapterId": "ed8e3a96-8126-4341-be42-e6eb7940c562",
  "toChapterId": "c5b0ed2c-1a51-4445-b548-416df7d27415"
}
HTTP 201
[Captures]
deny_transfer_id: jsonpath "$.id"

# Deny → status=denied.
POST {{api}}/association/member/affiliation-transfers/{{deny_transfer_id}}/deny
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "officerId": "{{officer_user_id}}",
  "reason": "Test rejection"
}
HTTP 200
[Asserts]
jsonpath "$.status" == "denied"

# Cannot complete a denied transfer.
POST {{api}}/association/member/affiliation-transfers/{{deny_transfer_id}}/complete
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
HTTP 422

# Cannot deny twice.
POST {{api}}/association/member/affiliation-transfers/{{deny_transfer_id}}/deny
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "officerId": "{{officer_user_id}}",
  "reason": "Second deny attempt"
}
HTTP 422
