# Association affiliation transfers flow: create, list, get, approve-source,
# approve-target, complete, deny.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-xfer-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Transfer Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Transfer",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE affiliation transfer.
POST {{api}}/association/member/affiliation-transfers
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "sourceChapter": "Chapter A",
  "targetChapter": "Chapter B"
}
HTTP 201
[Captures]
transfer_id: jsonpath "$.id"


# 2. LIST affiliation transfers.
GET {{api}}/association/member/affiliation-transfers
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET affiliation transfer by ID.
GET {{api}}/association/member/affiliation-transfers/{{transfer_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. Approve source.
POST {{api}}/association/member/affiliation-transfers/{{transfer_id}}/approve-source
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 5. Approve target.
POST {{api}}/association/member/affiliation-transfers/{{transfer_id}}/approve-target
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 6. Complete transfer.
POST {{api}}/association/member/affiliation-transfers/{{transfer_id}}/complete
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 7. CREATE another transfer to test deny.
POST {{api}}/association/member/affiliation-transfers
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "sourceChapter": "Chapter C",
  "targetChapter": "Chapter D"
}
HTTP 201
[Captures]
transfer_id_2: jsonpath "$.id"


# 8. Deny transfer.
POST {{api}}/association/member/affiliation-transfers/{{transfer_id_2}}/deny
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "reason": "Contract test denial"
}
HTTP 200


# 9. 401 — request without auth cookie.
GET {{api}}/association/member/affiliation-transfers
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 10. 404 — fake UUID.
GET {{api}}/association/member/affiliation-transfers/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
