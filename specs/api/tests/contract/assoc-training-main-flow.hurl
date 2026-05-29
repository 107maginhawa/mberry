# Association training CRUD flow: create, list, get, update,
# publish, then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-train-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Training Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Training",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE training.
POST {{api}}/association/training
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "CPD Training {{suffix}}",
  "description": "Contract test training session",
  "startDate": "2026-07-15T09:00:00Z",
  "endDate": "2026-07-15T17:00:00Z",
  "credits": 8
}
HTTP 201
[Captures]
training_id: jsonpath "$.id"


# 2. LIST trainings.
GET {{api}}/association/training
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET training by ID.
GET {{api}}/association/training/{{training_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE training.
PATCH {{api}}/association/training/{{training_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "description": "Updated training description"
}
HTTP 200


# 5. Publish training.
POST {{api}}/association/training/{{training_id}}/publish
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 6. DELETE training.
DELETE {{api}}/association/training/{{training_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 7. 401 — request without auth cookie.
GET {{api}}/association/training
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
