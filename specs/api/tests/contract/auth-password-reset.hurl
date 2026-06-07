# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Auth password-reset round-trip:
#
#   1. Sign up a user, capture the original password.
#   2. POST /auth/forget-password -> Better-Auth queues a reset email.
#   3. Poll Mailpit for the message; extract the reset token from the link.
#      The link shape is: <api>/auth/reset-password/<token>?callbackURL=...
#   4. POST /auth/reset-password with { token, newPassword } -> 200.
#   5. Sign in with the new password to prove the reset took effect.

# 1. Sign up.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "reset-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Reset Tester"
}
HTTP 200


# 2. Request a password reset.
# Better-Auth exposes this as /auth/request-password-reset; the legacy
# /auth/forget-password is a different (404) route in the current build.
POST {{api}}/auth/request-password-reset
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "reset-{{suffix}}@example.org",
  "redirectTo": "/"
}
HTTP 200


# 3. Poll Mailpit for the reset email.
GET {{mailpit_api}}/api/v1/search?query=to:reset-{{suffix}}@example.org%20subject:reset&limit=1
[Options]
retry: 30
retry-interval: 500ms
HTTP 200
[Captures]
message_id: jsonpath "$.messages[0].ID"
[Asserts]
jsonpath "$.count" >= 1


# 4. Extract the path-style reset token from the email body.
# Link looks like: http://localhost:7213/auth/reset-password/<TOKEN>?callbackURL=...
GET {{mailpit_api}}/api/v1/message/{{message_id}}
HTTP 200
[Captures]
reset_token: jsonpath "$.Text" regex "/auth/reset-password/([^?\\s]+)"


# 5. POST the reset with the captured token.
POST {{api}}/auth/reset-password
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "token": "{{reset_token}}",
  "newPassword": "NewPassword!ContractTest"
}
HTTP 200


# 6. Sign in with the new password.
POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "reset-{{suffix}}@example.org",
  "password": "NewPassword!ContractTest"
}
HTTP 200
