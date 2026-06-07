# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# member/certificates — public verify, not-found path
#
# Covers operationId: verifyCertificatePublic (negative path)
#
# Scope swap (was: verify-revoked):
#   The TypeSpec surface (specs/api/src/association/member/certificates.tsp)
#   exposes no revoke endpoint — revocation only happens via direct DB
#   transitions (e.g. layer-5 seed UPDATEs status='revoked'). Without a
#   public route to transition status, an end-to-end Hurl flow that
#   provably observes verified=false / isValid=false on a freshly-revoked
#   cert can't run.
#
#   The semantics that mattered — handler honors status='revoked' as
#   isValid=false — are unit-tested in
#   handlers/member/certificates/verifyCertificatePublic.test.ts
#   ("returns isValid=false for revoked certificate"). This contract test
#   covers the orthogonal negative path: a nonexistent cert number must
#   return 404, not leak existence via 200.

# Endpoint is public (no auth). Use an obviously-non-allocated number.
GET {{api}}/certificates/verify/PDA-MM-9999-{{suffix}}
HTTP 404
