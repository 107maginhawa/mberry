# Association membership tiers CRUD flow: create, list, get, update, delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-tiers-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Tiers Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Tiers",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. CREATE tier.
POST {{api}}/association/member/tiers
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "name": "Gold Tier {{suffix}}",
  "description": "Premium membership tier"
}
HTTP 201
[Captures]
tier_id: jsonpath "$.id"


# 2. LIST tiers.
GET {{api}}/association/member/tiers
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET tier by ID.
GET {{api}}/association/member/tiers/{{tier_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE tier.
PATCH {{api}}/association/member/tiers/{{tier_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "description": "Updated premium tier"
}
HTTP 200


# 5. DELETE tier.
DELETE {{api}}/association/member/tiers/{{tier_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. 401 — request without auth cookie.
GET {{api}}/association/member/tiers
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401


# 7. 404 — fake UUID.
GET {{api}}/association/member/tiers/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
