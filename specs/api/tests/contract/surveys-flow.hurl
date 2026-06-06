# UNVERIFIED
# Surveys module contract test: officer creates a survey (draft), updates it,
# publishes it, a member submits a response, officer reads analytics,
# officer clones + closes a survey, and finally deletes a draft.
#
# Covers operationIds:
#   listSurveys, createSurvey, getSurvey, updateSurvey, publishSurvey,
#   submitSurveyResponse, getSurveyAnalytics, cloneSurvey, closeSurvey, deleteSurvey
#
# Requires: a seeded org + officer account. Uses test org from db:seed-modules.
# Org ID: ed8e3a96-8126-4341-be42-e6eb7940c562

# CSRF preamble — fetches token + sets cookie for state-changing requests.
# Auto-injected by scripts/audit/inject-csrf-into-hurl.ts (idempotent).
GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

# ── Auth: sign in as officer ──────────────────────────────────────────────────

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200
[Captures]
officer_cookie: cookie "better-auth.session_token"

# ── 0. Unauthenticated access → 401 ──────────────────────────────────────────
# Sign out to test unauth gate

POST {{api}}/auth/sign-out
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
HTTP 200

GET {{api}}/surveys/
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 401

# ── Re-authenticate ───────────────────────────────────────────────────────────

GET {{api}}/csrf-token
HTTP 200
[Captures]
csrf_token: jsonpath "$.token"

POST {{api}}/auth/sign-in/email
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Content-Type: application/json
{
  "email": "test@memberry.ph",
  "password": "TestPass123!"
}
HTTP 200
[Captures]
officer_cookie: cookie "better-auth.session_token"

# ── 1. List surveys (empty org baseline) ─────────────────────────────────────

GET {{api}}/surveys/
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.data" isCollection

# ── 2. Create a draft survey ──────────────────────────────────────────────────

POST {{api}}/surveys/
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "title": "Annual Member Satisfaction {{suffix}}",
  "description": "How satisfied are you with association services this year?",
  "surveyType": "satisfaction",
  "questions": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "type": "rating",
      "text": "Rate your overall satisfaction (1-5)",
      "required": true,
      "order": 0,
      "scale": { "min": 1, "max": 5 }
    },
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "type": "text",
      "text": "Any additional comments?",
      "required": false,
      "order": 1,
      "maxLength": 500
    }
  ],
  "settings": {
    "anonymous": false
  }
}
HTTP 201
[Captures]
survey_id: jsonpath "$.id"
[Asserts]
jsonpath "$.title" contains "Annual Member Satisfaction"
jsonpath "$.status" == "draft"
jsonpath "$.surveyType" == "satisfaction"

# ── 3. Read survey back ───────────────────────────────────────────────────────

GET {{api}}/surveys/{{survey_id}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.id" == "{{survey_id}}"
jsonpath "$.status" == "draft"
jsonpath "$.questions" isCollection

# ── 4. Update draft survey ────────────────────────────────────────────────────

PATCH {{api}}/surveys/{{survey_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "description": "Updated: How satisfied are you with association services this year?"
}
HTTP 200
[Asserts]
jsonpath "$.id" == "{{survey_id}}"
jsonpath "$.description" contains "Updated:"

# ── 5. Publish survey ─────────────────────────────────────────────────────────

POST {{api}}/surveys/{{survey_id}}/publish
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.id" == "{{survey_id}}"
jsonpath "$.status" == "active"

# ── 6. Submit a response (as officer acting as member) ────────────────────────

POST {{api}}/surveys/{{survey_id}}/responses
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "answers": [
    {
      "questionId": "11111111-1111-4111-8111-111111111111",
      "value": 4
    },
    {
      "questionId": "22222222-2222-4222-8222-222222222222",
      "value": "Great events this year."
    }
  ]
}
HTTP 201
[Asserts]
jsonpath "$.surveyId" == "{{survey_id}}"

# ── 7. Get survey analytics ───────────────────────────────────────────────────

GET {{api}}/surveys/{{survey_id}}/analytics
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.surveyId" == "{{survey_id}}"
jsonpath "$.totalResponses" >= 1

# ── 8. Close survey ───────────────────────────────────────────────────────────

POST {{api}}/surveys/{{survey_id}}/close
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 200
[Asserts]
jsonpath "$.id" == "{{survey_id}}"
jsonpath "$.status" == "closed"

# ── Bonus: Clone closed survey → creates new draft ────────────────────────────

POST {{api}}/surveys/{{survey_id}}/clone
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 201
[Captures]
cloned_survey_id: jsonpath "$.id"
[Asserts]
jsonpath "$.status" == "draft"
jsonpath "$.title" exists

# ── Delete the cloned draft ───────────────────────────────────────────────────

DELETE {{api}}/surveys/{{cloned_survey_id}}
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP 204

# ── 9. Admin survey list (super-admin endpoint) ───────────────────────────────

GET {{api}}/admin/surveys/
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403)$"

# ── 10. NPS trend analytics ───────────────────────────────────────────────────

GET {{api}}/surveys/analytics/nps-trends
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403)$"

# ── 11. Delete my responses (member-side action) ──────────────────────────────

DELETE {{api}}/surveys/my-responses
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|204|404)$"

# ── 12. List responses for a synthetic survey ─────────────────────────────────

GET {{api}}/surveys/00000000-0000-4000-8000-000000000000/responses
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

# ── 13. Export responses for a synthetic survey ───────────────────────────────

GET {{api}}/surveys/00000000-0000-4000-8000-000000000000/export
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
HTTP *
[Asserts]
status toString matches "^(200|403|404)$"

# ── 14. Dismiss a synthetic response ──────────────────────────────────────────

POST {{api}}/surveys/00000000-0000-4000-8000-000000000000/responses/dismiss
Origin: {{origin}}
x-csrf-token: {{csrf_token}}
Cookie: better-auth.session_token={{officer_cookie}}
x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562
Content-Type: application/json
{
  "responseId": "00000000-0000-4000-8000-000000000000",
  "reason": "test"
}
HTTP *
[Asserts]
status toString matches "^(200|400|404|422)$"
