---
oli-version: "1.0"
dimension: runtime
sub-check: plan
based-on: map@2331bd9f
inputs:
  - docs/audits/codebase-map/CODE_ROUTE_MAP.json (v6, 147 routes)
  - docs/audits/codebase-map/CODE_API_SURFACE.json (471 endpoints)
  - docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json
  - docs/audits/codebase-map/CODE_MUTATIONS.json
  - docs/audits/codebase-map/CODE_IMPORT_GRAPH.json (sdk_op_edges)
last-modified: 2026-06-03T20:30:00Z
last-modified-by: oli-runtime-plan --auto --refresh
tier: Tier-3 Full (CODE_ROUTE_MAP v6 + CODE_COMPONENT_REGISTRY ≥ v4 detected → Full FE↔BE walker)
emit-mode: Full FE↔BE (api_calls + loading_state_hygiene + interaction_hygiene + hrefs + mutations)
---

# Runtime Test Plan — Memberry

Design-time plan of runtime tests against the current fresh-enough map. **Templates only — not executed by this skill.** Live execution is performed by `/oli-check --runtime --live` invoking `apps/memberry/tests/e2e/oli-runtime-loop.spec.ts`.

## Test Coverage Summary

| Layer | Surface | Source map | Coverage strategy |
|---|---|---|---|
| Frontend routes | 147 TanStack Router routes | CODE_ROUTE_MAP.json v6 | Full walker — load each route, assert skeleton-ceiling 5s, console-error budget=0, no `/undefined` in URL, no UUID rendered in user-facing cells |
| Backend API | 471 endpoints (OpenAPI) | CODE_API_SURFACE.json | FE↔BE contract — per declared `api_call` on each component, assert request fires and resolves with declared status class |
| Mutations | TanStack `useMutation` sites | CODE_MUTATIONS.json | `onError`/`onSettled`/`.catch` coverage walk — assert error-path resilience for every mutation |
| Nav links | `<Link to=...>` + `navigate(...)` | CODE_COMPONENT_REGISTRY.json `hrefs[]` | `J-DEADHREF` cross-check — every emitted href resolves to a route map entry |
| SDK edges | 242 sdk_op_edges over 151 operations | CODE_IMPORT_GRAPH.sdk_op_edges | Walker auto-resolves SDK hook → endpoint mapping for FE↔BE assertions |

## Load Test Scenarios (k6 templates)

> **Templates only — populate `BASE_URL`, `AUTH_TOKEN`, and per-endpoint payloads from `specs/api/dist/openapi/openapi.json` before running.**

### Scenario 1: Steady-state authenticated browsing

```js
// k6 run --vus 20 --duration 5m scenario-1.js  — TEMPLATE
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<800'],     // 95th pct < 800ms
    http_req_failed: ['rate<0.01'],       // <1% errors
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:7213';
const TOKEN = __ENV.AUTH_TOKEN || '<paste session token>';

export default function () {
  const params = { headers: { Cookie: `better-auth.session_token=${TOKEN}` } };
  // High-traffic GET endpoints derived from CODE_API_SURFACE
  const r1 = http.get(`${BASE}/persons/me`, params);
  check(r1, { 'persons/me 200': r => r.status === 200 });
  const r2 = http.get(`${BASE}/association/member/dashboard`, params);
  check(r2, { 'dashboard 200': r => r.status === 200 });
  sleep(1);
}
```

### Scenario 2: Officer-tier admin operations

Targets `/_authenticated/org/$orgSlug/officer/*` (54 routes). Same template — substitute `BASE_URL`, officer session token, and exercise `GET /association/operations/*` aggregates.

### Scenario 3: Public-token landing pages

Targets `/invite/$token`, `/pay/$token`, `/verify/$*`, `/join`, `/onboarding`. No auth header. Assert 200 OR documented redirect.

## Per-Module Performance Budgets

PERFORMANCE.md not present in `docs/product/` — budgets default to the standard tier from oli-runtime-plan:

| Endpoint class | Budget (p95) | Source |
|---|---|---|
| `GET *` list endpoints | 500 ms | default |
| `GET *` detail endpoints | 400 ms | default |
| `POST *` mutations | 800 ms | default |
| `GET /persons/me`, `/auth/*` | 200 ms | hot-path default |
| WebSocket connect (`/comms/*`) | 1500 ms | default |

> **Action**: populate `docs/product/PERFORMANCE.md` to override these defaults — without it, runtime confidence dimension caps at MEDIUM.

## Security Test Plan (DAST)

> **Template DAST checklist — execution requires ZAP / Burp / Schemathesis runner + a deployed target.**

| Check | Surface | Tool |
|---|---|---|
| OWASP Top 10 baseline scan | All 147 routes | OWASP ZAP `baseline.py` against `http://localhost:3004` |
| Auth bypass — anon access to `/_authenticated/*` | 127 protected routes | Schemathesis with empty cookie |
| Auth bypass — member access to `/officer/*` | 54 officer routes | Schemathesis with member session |
| IDOR — cross-org access | All `$orgSlug` routes | Hurl + 2 fixture orgs |
| Token replay — `/invite/$token`, `/pay/$token` | 7 token routes | Manual + reused expired token |
| WebSocket auth — `/comms/*` | comms module | wscat with stale token |
| CSRF — state-changing POSTs | 200+ POST endpoints | Schemathesis stateful mode |

## Auth Matrix Tests

| Role | Routes that MUST 200 | Routes that MUST 401/403 |
|---|---|---|
| anonymous | `/`, `/auth/*`, `/join`, `/onboarding`, `/invite/*`, `/pay/*`, `/verify/*` | All `/_authenticated/*` (127) |
| member (no officer role) | `/_authenticated/my/*` (20), `/_authenticated/org/$orgSlug/{home,directory,events,dues,my-cpd,announcements/*,documents/*,training/*,elections/*}` | `/_authenticated/org/$orgSlug/officer/*` (54), all `/admin` routes |
| officer | All member routes + `/_authenticated/org/$orgSlug/officer/*` (54) | `/admin` cross-org routes, `/_authenticated/org/$otherSlug/officer/*` |
| platform admin | All officer routes + `/admin/*` | (no restrictions in scope) |

## Accessibility Test Config

> **Template axe-core config — wire into Playwright runner before execution.**

```js
// axe-config.template.js — TEMPLATE
import { injectAxe, checkA11y } from 'axe-playwright';
export const axeConfig = {
  rules: {
    'color-contrast': { enabled: true },
    'landmark-one-main': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
  },
  // WCAG baseline — UI_BLUEPRINT.md not present → using WCAG 2.1 AA defaults
  tags: ['wcag2a', 'wcag2aa'],
};
```

Manual checklist: keyboard-only navigation, screen-reader smoke (`/`, `/_authenticated/dashboard`, `/_authenticated/my/profile`), 200%-zoom layout integrity.

## Cross-Layer Contract Walker (Full FE↔BE — Tier-3)

Engine map at v6 with `CODE_COMPONENT_REGISTRY` populated → **Full mode** eligible. Live runner is `apps/memberry/tests/e2e/oli-runtime-loop.spec.ts`, configuration in `apps/memberry/tests/e2e/oli-runtime.config.ts`. No duplicate template emitted here — that file is the canonical runner.

Walker assertions (per route, per declared `api_call`):
1. Page resolves past skeleton within **5 s ceiling** (closes infinite-skeleton bug class — Memberry 2026-05-30)
2. No `/undefined` substring in URL
3. No raw UUID rendered in user-facing cells (closes UUID-render bug class — Memberry 2026-05-31)
4. Every declared `api_call` fires with declared verb + path
5. Status class matches declared (`2xx` / declared error class)
6. Every `<Link to=>` href resolves to a known route (`J-DEADHREF`)
7. Every `useMutation` site has `onError` OR `onSettled` OR `.catch` coverage

## What's Next

- Live execution: `/oli-check --runtime --live` (requires API at :7213 + memberry at :3004 + seed)
- Promotion: latest `docs/audits/runtime/runtime-exec-results.json` rolls into `RUNTIME_EXEC_REPORT.md`
- This plan is **read-only** — re-run `oli-runtime-plan --refresh` after any CODE_ROUTE_MAP version bump
