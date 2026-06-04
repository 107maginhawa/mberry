# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Public feature flags endpoint. No auth required.

GET {{api}}/feature-flags/feature-flags
HTTP 200
[Asserts]
jsonpath "$" isCollection
