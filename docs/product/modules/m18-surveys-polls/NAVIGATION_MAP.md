---
name: navigation-map
module: m18-surveys-polls
route-count: 6
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.717Z
status: INFERRED — needs human review
---

# Navigation Map — m18-surveys-polls

**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module.

## Routes (6)

| Path | Logical | Page Component | App | Auth | Params | Middleware |
|------|---------|----------------|-----|------|--------|------------|
| `/_authenticated/my/surveys/$surveyId` | `/my/surveys/$surveyId` | SurveyDetailPage | memberry | yes | surveyId | — |
| `/_authenticated/my/surveys/` | `/my/surveys/` | MySurveys | memberry | yes | — | — |
| `/_authenticated/org/$orgSlug/officer/reviews/` | `/org/$orgSlug/officer/reviews/` | OfficerReviews | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/surveys/$surveyId` | `/org/$orgSlug/officer/surveys/$surveyId` | SurveyDetailPage | memberry | yes | orgSlug, surveyId | — |
| `/_authenticated/org/$orgSlug/officer/surveys/` | `/org/$orgSlug/officer/surveys/` | OfficerSurveys | memberry | yes | orgSlug | — |
| `/_authenticated/org/$orgSlug/officer/surveys/new` | `/org/$orgSlug/officer/surveys/new` | NewSurveyPage | memberry | yes | orgSlug | — |

## Derivation


## How journeys consumes this

The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.
