# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/certificates — public verify, HMAC signature query path
#
# Covers operationId: verifyCertificatePublic (signature query param surface)
#
# Hurl can't compute HMAC-SHA256 inline. We exercise the two
# fail-closed paths of the EF-M11-002 signature contract here:
#   - No `signature` query param  → verified: false (backward-compat).
#   - Garbage `signature` query   → verified: false (tamper rejection).
#
# The verified=true positive path requires a pre-computed signature using
# CERTIFICATE_QR_SECRET (server-side env). That positive contract is
# covered deterministically in two unit suites:
#   - utils/certificate-qr.test.ts             (sign + verify primitives)
#   - verifyCertificatePublic-hmac.test.ts     (handler integration)
#
# Both flows here issue a fresh cert first so the verify call hits a
# real row (not the 404 path covered in certificates-verify-not-found.hurl).
#
# Recipient is a fresh sign-up per {{suffix}} to keep the
# certificate_training_person_unique (trainingId=orgId, personId)
# invariant stable across re-runs and across sibling hurl files.

# ── 0. Sign up fresh recipient ─────────────────────────────────────
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "cert-hmac-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Cert HMAC Recipient {{suffix}}"
}
HTTP 200
[Captures]
recipient_id: jsonpath "$.user.id"


# ── 1. Sign in as officer ──────────────────────────────────────────
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


# ── 2. Issue a fresh cert via bulk-issue → capture certificateNumber ──
POST {{api}}/certificates/bulk-issue
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: {{org_id}}
Content-Type: application/json
{
  "organizationId": "{{org_id}}",
  "personIds": ["{{recipient_id}}"],
  "trainingTitle": "Hurl HMAC Verify Test {{suffix}}",
  "certificateType": "attendance",
  "signingOfficerId": "{{officer_person_id}}",
  "orgCode": "PDA-MM",
  "signatoryName": "Test Signatory",
  "signatoryTitle": "President"
}
HTTP 201
[Captures]
hmac_cert_number: jsonpath "$.data[0].certificateNumber"
[Asserts]
jsonpath "$.data[0].certificateNumber" matches "^PDA-MM-[0-9]{4}-[0-9]{4}$"


# ── 3. Verify with NO signature → 200, verified: false, isValid: true ──
GET {{api}}/certificates/verify/{{hmac_cert_number}}
HTTP 200
[Asserts]
jsonpath "$.data.certificateNumber" == "{{hmac_cert_number}}"
jsonpath "$.data.verified" == false
jsonpath "$.data.isValid" == true


# ── 4. Verify with GARBAGE signature → 200, verified: false (tamper) ──
# Signature is 16 hex chars (HMAC-SHA256 truncated). Garbage that matches
# the format must still fail the constant-time compare.
GET {{api}}/certificates/verify/{{hmac_cert_number}}?signature=deadbeefdeadbeef
HTTP 200
[Asserts]
jsonpath "$.data.certificateNumber" == "{{hmac_cert_number}}"
jsonpath "$.data.verified" == false
jsonpath "$.data.isValid" == true
