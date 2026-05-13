# Association license renewal alerts flow: list alerts, acknowledge alert.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Content-Type: application/json
{
  "email": "assoc-lic-alerts-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "License Alerts Tester"
}
HTTP 200


POST {{api}}/persons
Content-Type: application/json
{
  "firstName": "LicenseAlerts",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201
[Captures]
person_id: jsonpath "$.id"


# 1. LIST license renewal alerts.
GET {{api}}/association/member/license-renewal-alerts
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 2. Acknowledge alert (uses placeholder ID — may 404 if no alerts exist).
POST {{api}}/association/member/license-renewal-alerts/00000000-0000-0000-0000-000000000001/acknowledge
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{}
HTTP 200


# 3. 401 — request without auth cookie.
GET {{api}}/association/member/license-renewal-alerts
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
[Options]
cookie:
HTTP 401
