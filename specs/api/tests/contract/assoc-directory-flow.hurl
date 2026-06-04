# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association directory profiles CRUD flow: create, list, get, update, delete,
# search, and public lookup.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-dir-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Directory Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Directory",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE directory profile.
POST {{api}}/association/member/directory/profiles
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "personId": "{{person_id}}",
  "displayName": "Dr. Directory {{suffix}}",
  "visibility": "public"
}
HTTP 201
[Captures]
profile_id: jsonpath "$.id"


# 2. LIST directory profiles.
GET {{api}}/association/member/directory/profiles
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET directory profile by ID.
GET {{api}}/association/member/directory/profiles/{{profile_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE directory profile.
PATCH {{api}}/association/member/directory/profiles/{{profile_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "displayName": "Dr. Updated {{suffix}}"
}
HTTP 200


# 5. Search directory.
GET {{api}}/association/member/directory/search
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 6. Public lookup by person ID.
GET {{api}}/association/member/directory/search/{{person_id}}/public
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 7. DELETE directory profile.
DELETE {{api}}/association/member/directory/profiles/{{profile_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 8. 401 — request without auth cookie.
GET {{api}}/association/member/directory/profiles
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 9. 404 — fake UUID.
GET {{api}}/association/member/directory/profiles/00000000-0000-0000-0000-000000000000
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
