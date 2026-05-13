# Association royalty splits CRUD flow: create, list, get, update, delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-royal-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "RoyaltySplit Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "RoyaltySplit",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. CREATE royalty split.
POST {{api}}/association/member/royalty-splits
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "name": "National-Chapter Split {{suffix}}",
  "percentage": 70
}
HTTP 201
[Captures]
royalty_split_id: jsonpath "$.id"


# 2. LIST royalty splits.
GET {{api}}/association/member/royalty-splits
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET royalty split by ID.
GET {{api}}/association/member/royalty-splits/{{royalty_split_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE royalty split.
PATCH {{api}}/association/member/royalty-splits/{{royalty_split_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "percentage": 60
}
HTTP 200


# 5. DELETE royalty split.
DELETE {{api}}/association/member/royalty-splits/{{royalty_split_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. 401 — request without auth cookie.
GET {{api}}/association/member/royalty-splits
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401


# 7. 404 — fake UUID.
GET {{api}}/association/member/royalty-splits/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
