# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/certificates — bulk issuance (officer flow, sync ≤10 path)
#
# Covers operationId: bulkIssueCertificates
# Real flow: sign up a fresh recipient (so (training_id, person_id) is
# always unique across re-runs and across sibling hurl files), then
# officer (President = seed test@memberry.ph) signs in and issues
# 1 certificate via the sync path, capturing the resulting certificate
# number and asserting the response envelope.
#
# Auth contract: bulk-issue requires Origin-allowed CSRF + President or
# Secretary position scoped to body.organizationId (x-require-position
# middleware reads from body). Seed user test@memberry.ph = President of
# {{org_id}} (PDA-MM).
#
# Envelope contract:
#   - 201 sync path returns { data: [{ personId, certificateNumber, pdfUrl }] }
#   - >10 personIds would queue and return 202 { data: { status, jobId, message } } —
#     not exercised here (would require 11+ real persons).
#
# DB invariant note: bulkIssue handler sets trainingId = organizationId.
# The certificate_training_person_unique constraint thus prohibits a
# second issuance to the same person within the same org. Using a
# fresh sign-up per {{suffix}} sidesteps this on repeated gate runs.

# ── 0. Sign up fresh recipient — its user.id is the personId we issue to ─
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "cert-bulk-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Cert Bulk Recipient {{suffix}}"
}
HTTP 200
[Captures]
recipient_id: jsonpath "$.user.id"


# ── 1. Sign in as officer (signup above overwrote session) ──────────
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
officer_person_id: jsonpath "$.user.id"


# ── 2. bulkIssueCertificates → 201, sync path, direct {data:[]} envelope ──
# orgCode PDA-MM matches the seeded org_certificate_seq row, so a
# deterministic PDA-MM-YYYY-NNNN number is allocated for the recipient.
POST {{api}}/certificates/bulk-issue
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "organizationId": "{{org_id}}",
  "personIds": ["{{recipient_id}}"],
  "trainingTitle": "Hurl Bulk Issuance Test {{suffix}}",
  "certificateType": "attendance",
  "signingOfficerId": "{{officer_person_id}}",
  "orgCode": "PDA-MM",
  "signatoryName": "Test Signatory",
  "signatoryTitle": "President"
}
HTTP 201
[Captures]
issued_cert_number: jsonpath "$.data[0].certificateNumber"
[Asserts]
jsonpath "$.data" count == 1
jsonpath "$.data[0].personId" == "{{recipient_id}}"
jsonpath "$.data[0].certificateNumber" matches "^PDA-MM-[0-9]{4}-[0-9]{4}$"


# ── 3. verifyCertificatePublic on issued number → 200, isValid: true ──
# Confirms the cert actually landed in the DB (vs. the bulk handler's
# best-effort fallback that returns certificateNumber:'ERROR' on insert
# failure but still 201s the parent request).
GET {{api}}/certificates/verify/{{issued_cert_number}}
HTTP 200
[Asserts]
jsonpath "$.data.certificateNumber" == "{{issued_cert_number}}"
jsonpath "$.data.isValid" == true
jsonpath "$.data.status" == "issued"
