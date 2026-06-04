# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"



# Association dues reporting flow: list, update config, dashboard, report.

# 0. Auth setup — sign up + create person.
POST {{api}}/auth/sign-up/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "dues-rpt-{{suffix}}@example.org",
  "password": "Sup3rSecret!ContractTest",
  "name": "Reporting Tester"
}
HTTP 200


POST {{api}}/persons
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "firstName": "Reporting",
  "lastName": "Tester",
  "languagesSpoken": ["en"],
  "timezone": "America/New_York"
}
HTTP 201


# 1. LIST reporting configs.
GET {{api}}/association/member/dues-reporting
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 2. PUT — update reporting config.
PUT {{api}}/association/member/dues-reporting/ed8e3a96-8126-4341-be42-e6eb7940c562
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
{
  "enabled": true,
  "schedule": "monthly"
}
HTTP 200


# 3. GET dashboard.
GET {{api}}/association/member/dues-reporting/ed8e3a96-8126-4341-be42-e6eb7940c562/dashboard
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 4. GET report.
GET {{api}}/association/member/dues-reporting/ed8e3a96-8126-4341-be42-e6eb7940c562/report
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200


# 5. 401 — request without auth cookie.
GET {{api}}/association/member/dues-reporting/ed8e3a96-8126-4341-be42-e6eb7940c562/dashboard
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401


# 6. 404 — fake org UUID.
GET {{api}}/association/member/dues-reporting/00000000-0000-0000-0000-000000000000/dashboard
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 404
