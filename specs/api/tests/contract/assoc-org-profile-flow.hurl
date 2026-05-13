# Association org profile flow: get and update.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-orgp-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "OrgProfile Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "OrgProfile",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. GET org profile.
GET {{api}}/association/member/org-profile/ed8e3a96-8126-4341-be42-e6eb7940c562
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 2. UPDATE org profile.
PUT {{api}}/association/member/org-profile/ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "description": "Updated org profile {{suffix}}"
}
HTTP 200


# 3. 401 — request without auth cookie.
GET {{api}}/association/member/org-profile/ed8e3a96-8126-4341-be42-e6eb7940c562
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401
