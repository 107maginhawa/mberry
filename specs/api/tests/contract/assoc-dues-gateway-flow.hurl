# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# [BR-65] Association dues gateway — gateway-credential confidentiality at the wire.
#
# The per-org payment gateway secret is AES-256-GCM encrypted at rest and must
# NEVER be returned to any client (encryption-at-rest + round-trip is proven on
# real PG in gateway-config-encryption.integration.test.ts). This flow proves the
# wire half: an association:admin can configure the gateway and read it back, and
# neither the upsert nor the get response ever exposes the encrypted OR plaintext
# secret — only non-secret metadata (provider, publicKey).

# 0. Sign in as the seed officer (association:admin for {{org_id}}).
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "{{seed_officer_email}}",
  "password": "{{seed_officer_password}}"
}
HTTP 200


# 1. Configure the gateway (PUT) — provide a secret; the response must omit it.
PUT {{api}}/association/member/dues-gateway/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "provider": "stripe",
  "publicKey": "pk_test_contract_visible",
  "secretKey": "sk_test_contract_secret_never_returned"
}
HTTP 200
[Asserts]
jsonpath "$.publicKey" == "pk_test_contract_visible"
jsonpath "$.encryptedSecret" not exists
jsonpath "$.secretKey" not exists
jsonpath "$.encryptedWebhookSecret" not exists


# 2. Read it back (GET) — non-secret metadata only, no secret of any kind.
GET {{api}}/association/member/dues-gateway/{{org_id}}
HTTP 200
[Asserts]
jsonpath "$.provider" == "stripe"
jsonpath "$.publicKey" == "pk_test_contract_visible"
jsonpath "$.encryptedSecret" not exists
jsonpath "$.secretKey" not exists
jsonpath "$.encryptedWebhookSecret" not exists


# [B5] 3. PUT with webhookSecret — encrypted at rest, never returned at wire.
# BR-65 extension: webhookSecret is write-only just like secretKey. The upsert
# must store AES-256-GCM ciphertext (encryptedWebhookSecret) but never expose it.
# C1 fix: upsert now sets connected:true so checkout gates can verify the org is live.
PUT {{api}}/association/member/dues-gateway/{{org_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "provider": "paymongo",
  "publicKey": "pk_test_paymongo_visible",
  "secretKey": "sk_test_paymongo_never_returned",
  "webhookSecret": "whsec_test_paymongo_never_returned"
}
HTTP 200
[Asserts]
jsonpath "$.encryptedSecret" not exists
jsonpath "$.encryptedWebhookSecret" not exists
jsonpath "$.secretKey" not exists
jsonpath "$.webhookSecret" not exists
jsonpath "$.connected" == true
jsonpath "$.provider" == "paymongo"
jsonpath "$.publicKey" == "pk_test_paymongo_visible"


# [B5] 4. GET after webhookSecret upsert — both encrypted fields still absent.
GET {{api}}/association/member/dues-gateway/{{org_id}}
HTTP 200
[Asserts]
jsonpath "$.provider" == "paymongo"
jsonpath "$.publicKey" == "pk_test_paymongo_visible"
jsonpath "$.encryptedSecret" not exists
jsonpath "$.encryptedWebhookSecret" not exists
jsonpath "$.secretKey" not exists
jsonpath "$.webhookSecret" not exists
