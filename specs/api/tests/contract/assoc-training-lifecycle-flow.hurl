# Association training lifecycle flow: my trainings, enrollments,
# cancel, check-in, complete, enroll.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-trainlife-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "TrainLife Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "TrainLife",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 0b. Create a training for lifecycle tests.
POST {{api}}/association/training
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "Lifecycle Training {{suffix}}",
  "description": "Training for lifecycle tests",
  "startDate": "2026-09-15T09:00:00Z",
  "endDate": "2026-09-15T17:00:00Z",
  "credits": 4
}
HTTP 201
[Captures]
training_id: jsonpath "$.id"


# 1. My trainings (user-scoped).
GET {{api}}/association/training-lifecycle/my
HTTP 200


# 2. Enroll in training.
POST {{api}}/association/training-lifecycle/{{training_id}}/enroll
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 3. List enrollments for training.
GET {{api}}/association/training-lifecycle/{{training_id}}/enrollments
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. Check in to training.
POST {{api}}/association/training-lifecycle/{{training_id}}/check-in
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 5. Complete training.
POST {{api}}/association/training-lifecycle/{{training_id}}/complete
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 6. Cancel training.
POST {{api}}/association/training-lifecycle/{{training_id}}/cancel
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 7. 401 — request without auth cookie.
GET {{api}}/association/training-lifecycle/my
[Options]
cookie:
HTTP 401
