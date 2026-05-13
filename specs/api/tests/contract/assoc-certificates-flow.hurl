# Association certificates flow: list and get by ID.
# Covers /association/member/certificates (spec paths).

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-cert-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "AssocCert Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "AssocCert",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. LIST certificates.
GET {{api}}/association/member/certificates
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 2. GET certificate by ID (fake UUID — expect 404).
GET {{api}}/association/member/certificates/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404


# 3. 401 — request without auth cookie.
GET {{api}}/association/member/certificates
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401
