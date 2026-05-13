# Association events CRUD flow: create event, list, get, update,
# action endpoints (cancel, publish, waitlist, promote), then delete.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-events-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Events Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "Events",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. CREATE event.
POST {{api}}/association/events
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "title": "Test Event {{suffix}}",
  "description": "Contract test event",
  "startDate": "2026-07-01T09:00:00Z",
  "endDate": "2026-07-01T17:00:00Z",
  "location": "Test Venue"
}
HTTP 201
[Captures]
event_id: jsonpath "$.id"


# 2. LIST events.
GET {{api}}/association/events
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 3. GET event by ID.
GET {{api}}/association/events/{{event_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. UPDATE event.
PATCH {{api}}/association/events/{{event_id}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "description": "Updated event description"
}
HTTP 200


# 5. Publish event.
POST {{api}}/association/events/{{event_id}}/publish
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 6. List waitlist.
GET {{api}}/association/events/{{event_id}}/waitlist
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 7. Promote waitlist entry (fake UUID — expect 404).
POST {{api}}/association/events/{{event_id}}/waitlist/00000000-0000-0000-0000-000000000000/promote
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 404


# 8. Cancel event.
POST {{api}}/association/events/{{event_id}}/cancel
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 9. DELETE event.
DELETE {{api}}/association/events/{{event_id}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 10. 401 — request without auth cookie.
GET {{api}}/association/events
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401
