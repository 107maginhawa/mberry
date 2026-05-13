# Association messages CRUD flow: create, list, get, update,
# action endpoints (send, schedule, cancel), then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-msgs-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Msgs Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Msgs",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE message.
POST {{api}}/association/messages
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "subject": "Test Message {{suffix}}",
  "body": "Contract test message body",
  "channel": "email",
  "recipients": ["{{person_id}}"]
}
HTTP 201
[Captures]
message_id: jsonpath "$.id"


# 2. LIST messages.
GET {{api}}/association/messages
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET message by ID.
GET {{api}}/association/messages/{{message_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE message.
PATCH {{api}}/association/messages/{{message_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "subject": "Updated Message {{suffix}}"
}
HTTP 200


# 5. Schedule message.
POST {{api}}/association/messages/{{message_id}}/schedule
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "scheduledAt": "2026-12-01T10:00:00Z"
}
HTTP 200


# 6. Cancel message.
POST {{api}}/association/messages/{{message_id}}/cancel
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 7. Send message (create a new one to send).
POST {{api}}/association/messages
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "subject": "Send Test {{suffix}}",
  "body": "Message to send immediately",
  "channel": "email",
  "recipients": ["{{person_id}}"]
}
HTTP 201
[Captures]
send_message_id: jsonpath "$.id"


POST {{api}}/association/messages/{{send_message_id}}/send
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 8. DELETE message.
DELETE {{api}}/association/messages/{{message_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 9. 401 — request without auth cookie.
GET {{api}}/association/messages
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401
