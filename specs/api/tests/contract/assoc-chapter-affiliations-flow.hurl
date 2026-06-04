# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association chapter affiliations CRUD flow: create, list, get, update, delete, set-primary.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-chaff-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "ChapterAffil Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "ChapterAffil",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE chapter affiliation.
POST {{api}}/association/member/chapter-affiliations
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "chapterName": "Metro Manila Chapter {{suffix}}"
}
HTTP 201
[Captures]
affiliation_id: jsonpath "$.id"


# 2. LIST chapter affiliations.
GET {{api}}/association/member/chapter-affiliations
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET chapter affiliation by ID.
GET {{api}}/association/member/chapter-affiliations/{{affiliation_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE chapter affiliation.
PATCH {{api}}/association/member/chapter-affiliations/{{affiliation_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "chapterName": "Updated Chapter {{suffix}}"
}
HTTP 200


# 5. Set primary affiliation.
POST {{api}}/association/member/chapter-affiliations/{{affiliation_id}}/set-primary
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 6. DELETE chapter affiliation.
DELETE {{api}}/association/member/chapter-affiliations/{{affiliation_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 7. 401 — request without auth cookie.
GET {{api}}/association/member/chapter-affiliations
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 8. 404 — fake UUID.
GET {{api}}/association/member/chapter-affiliations/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
