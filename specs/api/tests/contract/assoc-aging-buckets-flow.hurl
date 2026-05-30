# Association aging buckets flow: get and recalculate.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-aging-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "AgingBuckets Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "AgingBuckets",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. GET aging buckets for org.
GET {{api}}/association/member/aging-buckets/ed8e3a96-8126-4341-be42-e6eb7940c562
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 2. Recalculate aging buckets.
POST {{api}}/association/member/aging-buckets/ed8e3a96-8126-4341-be42-e6eb7940c562/recalculate
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 3. 401 — request without auth cookie.
GET {{api}}/association/member/aging-buckets/ed8e3a96-8126-4341-be42-e6eb7940c562
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
