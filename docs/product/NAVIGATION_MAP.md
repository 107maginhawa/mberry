---
name: navigation-map-consolidated
route-count: 147
derived-from-head: bf8b8fdd
last-generated: 2026-06-03T01:03:31.717Z
---

# Navigation Map — Consolidated

Top-level index of all 147 frontend routes across both apps, bucketed by product module. See per-module `docs/product/modules/{name}/NAVIGATION_MAP.md` for the full route table per module.

## Schema (canonical)

Each per-module `NAVIGATION_MAP.md` file carries frontmatter declaring:
- `name: navigation-map` — sentinel for journeys-dim consumers
- `module: m{NN}-{slug}` — the product module ID this file anchors
- `route-count: <int>` — number of routes assigned to this module
- `derived-from-head: <git_sha>` — code anchor
- `last-generated: <ISO-8601>` — regeneration timestamp
- `status: INFERRED | NO-UI (deferred|backend-only) | HUMAN-REVIEWED`

Body is a table of routes (path, logical, page_component, app, auth, params, middleware) plus a how-to-consume section.

## Module distribution

| Module | Routes | Status |
|--------|--------|--------|
| m01-auth-onboarding | 4 | INFERRED |
| m02-member-profile | 7 | INFERRED |
| m03-platform-admin | 7 | INFERRED |
| m04-org-admin | 39 | INFERRED |
| m05-membership | 4 | INFERRED |
| m06-dues-payments | 11 | INFERRED |
| m07-communications | 18 | INFERRED |
| m08-events | 10 | INFERRED |
| m09-training | 8 | INFERRED |
| m10-credit-tracking | 2 | INFERRED |
| m11-documents-credentials | 10 | INFERRED |
| m12-elections-governance | 7 | INFERRED |
| m13-professional-feed | 0 | ⊘ no-ui |
| m14-national-dashboard | 5 | INFERRED |
| m15-job-board | 0 | ⊘ no-ui |
| m16-advertising | 0 | ⊘ no-ui |
| m17-marketplace | 0 | ⊘ no-ui |
| m18-surveys-polls | 6 | INFERRED |
| m19-committee-management | 1 | INFERRED |
| m20-booking | 6 | INFERRED |
| m21-billing | 0 | ⊘ no-ui |
| m22-email | 0 | ⊘ no-ui |

