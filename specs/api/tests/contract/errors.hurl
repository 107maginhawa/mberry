# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Error envelope contract. Every 4xx/5xx response carries a stable
# JSON body shape: code, message, statusCode, timestamp, requestId,
# path, method. 400 responses additionally carry fieldErrors[]. Clients
# branch on `code`, not `message`.

# 1. Validation error on POST /persons with empty body.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "errors-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Errors Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{}
HTTP 400
[Asserts]
header "Content-Type" matches "application/json"
jsonpath "$.code" exists
jsonpath "$.code" == "VALIDATION_ERROR"
jsonpath "$.message" exists
jsonpath "$.statusCode" == 400
jsonpath "$.timestamp" matches "^[0-9]{4}-"
jsonpath "$.requestId" exists
jsonpath "$.path" == "/persons"
jsonpath "$.method" == "POST"
jsonpath "$.fieldErrors" isCollection


# 2. Not-found error on GET /persons/{uuid} with random id.
GET {{api}}/persons/00000000-0000-4000-8000-000000000000
HTTP 404
[Asserts]
jsonpath "$.code" == "NOT_FOUND"
jsonpath "$.statusCode" == 404


# 3. Authentication error on a protected endpoint without a session.
# (Use a hop that the auth middleware rejects pre-routing — sign out
# clears the cookie jar.)
POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200


GET {{api}}/persons/me
HTTP 401
[Asserts]
jsonpath "$.code" matches "^(UNAUTHORIZED|UNAUTHENTICATED)$"
jsonpath "$.statusCode" == 401
