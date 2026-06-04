# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association training enrollments CRUD flow: create, list, get, update,
# complete, then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-trainenr-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "TrainEnr Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "TrainEnr",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 0b. Create a training to enroll in.
POST {{api}}/association/training
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "Enrollment Training {{suffix}}",
  "description": "Training for enrollment tests",
  "startDate": "2026-10-01T09:00:00Z",
  "endDate": "2026-10-01T17:00:00Z",
  "credits": 6
}
HTTP 201
[Captures]
training_id: jsonpath "$.id"


# 1. CREATE enrollment.
POST {{api}}/association/training/enrollments
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "trainingId": "{{training_id}}",
  "personId": "{{person_id}}"
}
HTTP 201
[Captures]
enrollment_id: jsonpath "$.id"


# 2. LIST enrollments.
GET {{api}}/association/training/enrollments
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET enrollment by ID.
GET {{api}}/association/training/enrollments/{{enrollment_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE enrollment.
PATCH {{api}}/association/training/enrollments/{{enrollment_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "notes": "Updated enrollment notes"
}
HTTP 200


# 5. Complete enrollment.
POST {{api}}/association/training/enrollments/{{enrollment_id}}/complete
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 6. DELETE enrollment.
DELETE {{api}}/association/training/enrollments/{{enrollment_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 7. 401 — request without auth cookie.
GET {{api}}/association/training/enrollments
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
