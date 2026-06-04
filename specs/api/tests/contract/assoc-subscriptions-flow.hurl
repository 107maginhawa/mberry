# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association subscription topics and person subscriptions flow:
# create topic, get, update, delete, list person subs, bulk update, update sub.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "assoc-subs-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Subs Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Subs",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE subscription topic.
POST {{api}}/association/subscription-topics
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "name": "Newsletter {{suffix}}",
  "description": "Monthly newsletter subscription"
}
HTTP 201
[Captures]
topic_id: jsonpath "$.id"


# 2. GET subscription topic by ID.
GET {{api}}/association/subscription-topics/{{topic_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. UPDATE subscription topic.
PATCH {{api}}/association/subscription-topics/{{topic_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "description": "Updated newsletter description"
}
HTTP 200


# 4. LIST my person subscriptions.
GET {{api}}/association/person-subscriptions
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 5. Bulk update person subscriptions.
POST {{api}}/association/person-subscriptions/bulk-update
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "subscriptions": [
    {"topicId": "{{topic_id}}", "enabled": true}
  ]
}
HTTP 200


# 6. Update single person subscription (fake UUID — expect 404).
PATCH {{api}}/association/person-subscriptions/00000000-0000-0000-0000-000000000000
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "enabled": false
}
HTTP 404


# 7. DELETE subscription topic.
DELETE {{api}}/association/subscription-topics/{{topic_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 8. 401 — request without auth cookie.
GET {{api}}/association/person-subscriptions
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401
