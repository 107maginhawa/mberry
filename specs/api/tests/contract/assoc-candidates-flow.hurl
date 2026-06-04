# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association candidates CRUD flow: create, list, get, update, delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-candidates-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Candidates Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Candidates",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE candidate.
POST {{api}}/association/member/candidates
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "positionTitle": "Board Member",
  "statement": "I will improve member services {{suffix}}"
}
HTTP 201
[Captures]
candidate_id: jsonpath "$.id"


# 2. LIST candidates.
GET {{api}}/association/member/candidates
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET candidate by ID.
GET {{api}}/association/member/candidates/{{candidate_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE candidate.
PATCH {{api}}/association/member/candidates/{{candidate_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "statement": "Updated platform statement {{suffix}}"
}
HTTP 200


# 5. DELETE candidate.
DELETE {{api}}/association/member/candidates/{{candidate_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. 401 — request without auth cookie.
GET {{api}}/association/member/candidates
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
