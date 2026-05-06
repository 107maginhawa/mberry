# Business Rules: [BR-35]
# Feed content moderation contract test: verify endpoint auth and stub response.
#
# Requires: seeded org ed8e3a96-8126-4341-be42-e6eb7940c562

# Step 1: Unauthenticated access should fail
GET {{api}}/association/feed/moderation?organizationId=ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401

# Step 2: Authenticate
POST {{api}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "Test1234!"
}
HTTP 200
[Captures]
session_token: cookie "better-auth.session_token"

# Step 3: Authenticated request to unimplemented endpoint
GET {{api}}/association/feed/moderation?organizationId=ed8e3a96-8126-4341-be42-e6eb7940c562
Cookie: better-auth.session_token={{session_token}}
HTTP 404
