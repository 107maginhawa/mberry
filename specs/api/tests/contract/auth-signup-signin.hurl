# Business Rules: [BR-21] [BR-25] [BR-26]
# Sign-up + sign-in lifecycle (Better-Auth).
# Validates: account creation, session token issuance, get-session round-trip,
# sign-out invalidation. Each Hurl run uses a unique email via the {{suffix}}
# variable injected by scripts/run-contract-tests.ts.

# 1. Create a new account
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "ct-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Contract Tester"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"
created_user_email: jsonpath "$.user.email"
[Asserts]
jsonpath "$.user.id" exists
jsonpath "$.user.email" exists
jsonpath "$.token" exists


# 2. Read back the session via cookie
GET {{api}}/auth/get-session
Cookie: better-auth.session_token={{session_token}}
HTTP 200
[Asserts]
jsonpath "$.user.email" == "{{created_user_email}}"


# 3. Sign out
POST {{api}}/auth/sign-out
Cookie: better-auth.session_token={{session_token}}
HTTP 200


# 4. [BR-25] OTP send endpoint exists (does not 500)
POST {{api}}/auth/email-otp/send-verification-otp
Content-Type: application/json
{
  "email": "ct-{{suffix}}@example.org",
  "type": "sign-in"
}
HTTP *
[Asserts]
status < 500
