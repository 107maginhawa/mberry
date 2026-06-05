# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Public feature flags endpoint. No auth required.
# Path is mounted at /feature-flags (see core/feature-flags.ts:57); earlier
# spec had it doubled as /feature-flags/feature-flags — corrected here.

GET {{api}}/feature-flags
HTTP 200
[Asserts]
# Endpoint returns a flag-name → boolean map (object). May be {} when no
# flags configured. Use header check + status code only — assert-on-empty
# would fail when an org has zero flags defined.
header "Content-Type" matches "application/json"
