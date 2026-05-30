# Association training courses CRUD flow: course CRUD, course enrollment CRUD,
# progress logging, and quiz attempts.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-courses-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Courses Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Courses",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# ── Course CRUD ──────────────────────────────────────────────

# 1. CREATE course.
POST {{api}}/association/training/courses
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "Online Course {{suffix}}",
  "description": "Contract test online course",
  "credits": 10,
  "format": "online"
}
HTTP 201
[Captures]
course_id: jsonpath "$.id"


# 2. LIST courses.
GET {{api}}/association/training/courses
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET course by ID.
GET {{api}}/association/training/courses/{{course_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE course.
PATCH {{api}}/association/training/courses/{{course_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "description": "Updated course description"
}
HTTP 200


# ── Course Enrollment CRUD ───────────────────────────────────

# 5. CREATE course enrollment.
POST {{api}}/association/training/courses/enrollments
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "courseId": "{{course_id}}",
  "personId": "{{person_id}}"
}
HTTP 201
[Captures]
enrollment_id: jsonpath "$.id"


# 6. LIST course enrollments.
GET {{api}}/association/training/courses/enrollments
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 7. GET course enrollment by ID.
GET {{api}}/association/training/courses/enrollments/{{enrollment_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 8. UPDATE course enrollment.
PATCH {{api}}/association/training/courses/enrollments/{{enrollment_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "notes": "Updated course enrollment notes"
}
HTTP 200


# 9. Log progress for enrollment.
POST {{api}}/association/training/courses/enrollments/{{enrollment_id}}/progress
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "lessonId": "lesson-1",
  "completed": true
}
HTTP 200


# 10. DELETE course enrollment.
DELETE {{api}}/association/training/courses/enrollments/{{enrollment_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# ── Quiz Attempts ────────────────────────────────────────────

# 11. Submit quiz attempt.
POST {{api}}/association/training/courses/quiz-attempts
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "courseId": "{{course_id}}",
  "answers": [
    {"questionId": "q1", "answer": "A"},
    {"questionId": "q2", "answer": "B"}
  ]
}
HTTP 201


# 12. LIST quiz attempts.
GET {{api}}/association/training/courses/quiz-attempts
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# ── Cleanup ──────────────────────────────────────────────────

# 13. DELETE course.
DELETE {{api}}/association/training/courses/{{course_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 14. 401 — request without auth cookie.
GET {{api}}/association/training/courses
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
