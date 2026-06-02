# Runtime Test Plan — Memberry

---
oli-version: runtime-v3
report_date: 2026-06-02
generated_by: /oli-check --runtime (Tier 1 + 2)
based_on:
  - docs/product/PERFORMANCE.md
  - docs/product/THREAT_MODEL.md
  - docs/product/ROLE_PERMISSION_MATRIX.md
  - docs/product/API_CONVENTIONS.md
  - docs/product/ERROR_TAXONOMY.md
  - docs/audits/codebase-map/CODE_ROUTE_MAP.json (v6 — engine post-v4 ✓)
  - docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json (v6 — loading_state_hygiene + interaction_hygiene + hrefs populated)
  - docs/audits/codebase-map/CODE_API_SURFACE.json (v6, 450 endpoints)
  - docs/audits/codebase-map/CODE_MUTATIONS.json (v6 — TanStack onError/onSettled coverage)
  - services/api-ts/src/tests/smoke.test.ts (audited)
  - apps/memberry/playwright.config.ts (audited, 129+ specs)
  - apps/admin/tests/e2e/admin-smoke.spec.ts (audited, 8 specs)
last_modified: 2026-06-02
last_modified_by: oli-runtime-plan (invoked by /oli-check --runtime)
map_sha: f29971811da966f1d02e8e70c910d92095c65244
map_snapshot_ts: 2026-06-01T13:47:58Z
working_tree_drift: STALE-OVERLAP (13 .tsx files modified after map snapshot)
---

## Verdict

**WARN** — Tier 1 boot-smoke PASS (source-scanned, 2 WARN, 2 INFO). Tier 2 plan emitted in **Full FE↔BE walker mode** (engine v6 schema unlocks `api_call` + `loading_state_hygiene` + `interaction_hygiene` + `hrefs`). Tier 3 (live interaction loop) SKIPPED — `--live` not passed.

**Stale-map WARN attached.** The map snapshot precedes 13 modifications to working-tree .tsx files (mostly `apps/memberry/src/routes/_authenticated/**`). Walker template references map-derived route paths and component api_calls — newly added routes / api_calls since the snapshot will be missed. Boot-smoke (Tier 1) is source-scanned and immune.

> `RUNTIME: stale-map (WARN)` — refresh map before any Tier-3 live execution
> `RUNTIME-LIVE: skipped (no --live)`
> `live_runtime_available: false`

---

## Three-Tier Ladder Status

| Tier | Status | Mechanism |
|------|--------|-----------|
| 1. boot-smoke | **PASS (static, source-scanned)** | Configs + Zod env schema + docker-compose audited. See `docs/audits/runtime/boot-smoke.md`. |
| 2. contract walker (oli-runtime-plan) | **emitted (Full mode)** | Full FE↔BE `api_call` walker emitted — `loading_state_hygiene` + `interaction_hygiene` + `hrefs` populated in v6 map. |
| 3. interaction loop (`--live`) | **SKIPPED** | `--live` not passed. Map v6 would route to full executor if re-run. |

---

## Tier 1 — Boot-Smoke

See `docs/audits/runtime/boot-smoke.md` for full report. Summary:

- All three workspaces (`apps/memberry`, `apps/admin`, `services/api-ts`) have valid dev scripts, parseable configs, and no port collisions.
- `services/api-ts/src/core/config.ts` Zod env schema (commit `9b68988f`) is consistent with documented `.env.example` defaults; required-in-prod guards (`AUTH_SECRET`, `DATABASE_URL`, `INTERNAL_SERVICE_TOKEN`) wired via `superRefine`.
- Docker-compose stack (`postgres` / `minio` / `mailpit` / `stripe-mock` / `loki` / `grafana`) is structurally valid with health checks on 6 of 7 services.

**WARN findings:**
1. `stripe-mock` compose service lacks a healthcheck — non-blocking.
2. Doc-drift between root `.env.example` (`STORAGE_BUCKET=memberry-dev`, legacy `CORS_ORIGINS=...3000,...7213`) and `services/api-ts/.env.example` — schema defaults rescue both, but copy-paste lands a contributor on the wrong bucket / wrong origin set. P3.

---

## Tier 2 — Contract Walker Plan (templates only — emit, do not run)

### Inputs summary

| Input | Size | Notes |
|-------|------|-------|
| CODE_ROUTE_MAP routes (total) | **147** | 130 memberry + 17 admin + 0 catch-all (api-ts handlers tracked separately in API_SURFACE) |
| Memberry routes with `page_component` | **130** | Of which 25 are param-free (mountable without fixture data) |
| Admin routes with `page_component` | **17** | Of which 12 are param-free |
| CODE_API_SURFACE endpoints | **450** | Total backend API surface |
| CODE_COMPONENT_REGISTRY components | **359** | v6 schema with `api_calls` + `loading_state_hygiene` + `interaction_hygiene` |
| Components with declared `api_calls` | ~90 (estimate, walker iterates dynamically) | Page components in `apps/memberry/src/routes/**` and `apps/admin/src/routes/**` |
| PERFORMANCE.md SLA tiers | **5** | Read p95 < 200ms (search) / 500ms (general); write < 500ms; heavy (PDF) < 3000ms; auth < 500ms; ws < 100ms delivery |
| THREAT_MODEL STRIDE entries | 24+ | Plus 5 P0/P1/P2 gap items |
| ROLE_PERMISSION_MATRIX roles | 9 | guest, user, member, officer, treasurer, secretary, president, chapter-officer, platform-admin |

### Route × Interaction Matrix

> Memberry's existing Playwright suite contains **129+ specs** covering happy-path + auth + role-boundary navigation. The matrix below is the *minimum* design-time coverage target the Tier-2 walker template must hit.

- **Routes covered (param-free, mountable):** 37 (25 memberry + 12 admin)
- **Routes parametric (need fixture):** 110 (require fixture-resolved IDs — separate fixture file in walker harness)
- **Interaction primitives per route:** 4 (mount, primary CTA click, secondary nav click, form submit if `<form>` present)
- **Matrix size:** ~148 cells for param-free first pass; full matrix scales to ~588 with fixtures
- **k6 scenarios:** **6** (one per Memberry SLA tier — search / read / write / heavy / auth / ws)
- **DAST checklist items:** **22** (8 STRIDE-driven + 9 OWASP Top-10 + 5 Memberry-specific)

### k6 Scenario Templates (6)

> All scenarios are TEMPLATES — materialize against staging URL + auth fixtures before running.

```js
// k6 — scenarios.template.js  (place under docs/audits/runtime/k6/ or services/api-ts/perf/)
import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';

const BASE_URL = __ENV.API_URL || 'http://localhost:7213';
const AUTH_COOKIE = __ENV.AUTH_COOKIE || ''; // mint via /auth/sign-in/email in setup()

export const options = {
  scenarios: {
    s0_member_search:    { executor: 'constant-vus', vus: 30,  duration: '60s',  tags: { tier: 'search' } },
    s1_read_general:     { executor: 'constant-vus', vus: 50,  duration: '60s',  tags: { tier: 'read' } },
    s2_write_crud:       { executor: 'constant-vus', vus: 20,  duration: '60s',  tags: { tier: 'write' } },
    s3_heavy_pdf:        { executor: 'constant-vus', vus: 5,   duration: '120s', tags: { tier: 'heavy' } },
    s4_auth_roundtrip:   { executor: 'constant-vus', vus: 30,  duration: '60s',  tags: { tier: 'auth' } },
    s5_ws_concurrency:   { executor: 'constant-vus', vus: 500, duration: '180s', tags: { tier: 'ws' } },
  },
  thresholds: {
    // PERFORMANCE.md SLA Summary table — derived directly
    'http_req_duration{tier:search}': ['p(95)<200'],   // Member search NFR
    'http_req_duration{tier:read}':   ['p(95)<500'],   // General API
    'http_req_duration{tier:write}':  ['p(95)<500'],   // Payment recording NFR
    'http_req_duration{tier:heavy}':  ['p(95)<3000'],  // PDF generation NFR
    'http_req_duration{tier:auth}':   ['p(95)<500'],   // Login NFR
    'ws_connecting{tier:ws}':         ['p(95)<1500'],  // 500-concurrent NFR
    'http_req_failed':                ['rate<0.01'],
  },
};

export default function () {
  // Per-tier handlers — fill in endpoints from CODE_API_SURFACE.endpoints (450 total)
  // High-value targets to template first:
  //   search: GET /persons?q=...                       (Member search SLA)
  //   read:   GET /associations/:assoc/members         (Roster load)
  //   write:  POST /dues/recordManualPayment           (Idempotent path)
  //   heavy:  POST /certificates/:id/render            (PDF NFR)
  //   auth:   POST /auth/sign-in/email                 (Login NFR)
  //   ws:     WS /comms/ws                             (Convention spike)
}
```

### Per-Module Performance Budgets (from PERFORMANCE.md)

| Module | Critical Path | P95 Target | Priority | Notes |
|--------|--------------|-----------|----------|-------|
| M01 Auth | Login, OTP verification | < 500ms | HIGH | Better-Auth session creation |
| M02 Profile | Profile load, **search** | **< 200ms** | HIGH | Tightest SLA in stack |
| M05 Membership | Roster load, status check | < 500ms | HIGH | Status computed from `dues_expiry_date` |
| M06 Dues | Payment recording | < 500ms | HIGH | Optimistic-lock conflict adds latency |
| M08 Events | Registration, QR check-in | < 500ms | HIGH | 500-concurrent NFR — convention spike |
| M09 Training | Enrollment, completion | < 500ms | MEDIUM | Auto-credit crosses M09 → M10 |
| M10 Credits | Credit aggregation | < 500ms | MEDIUM | Cross-org may be hot path |
| M11 Documents | PDF generation | **< 3000ms** | MEDIUM | Real-time card/receipt at events |
| M07 Comms | WebSocket delivery | **< 100ms** | HIGH | Real-time notification SLA |

### DAST Checklist (22 items)

#### STRIDE-derived (8) — from THREAT_MODEL.md

- [ ] **Spoofing-1:** credential stuffing — account lockout after BR-26 threshold
- [ ] **Spoofing-2:** session hijack — session rotation after privilege escalation
- [ ] **Tampering-1:** payment record manipulation — optimistic-lock conflict returns 409
- [ ] **Tampering-2:** SVG upload XSS — sanitizer strips `<script>` (BR-31)
- [ ] **Tampering-3 (CSRF):** POST without `Sec-Fetch-Site: same-origin` rejected (Wave G4 middleware)
- [ ] **Info-Disclosure-1:** cross-tenant query — member of org A cannot GET org B's roster (P1 gap — **must verify before pilot**)
- [ ] **Info-Disclosure-2:** PII not in logs — search logs for license_number / phone patterns
- [ ] **EoP-1:** member token cannot call platform-admin endpoints (403)

#### OWASP Top-10 (9)

- [ ] A01 Broken Access Control — see Auth Matrix below
- [ ] A02 Cryptographic Failures — TLS-only cookies, no secrets in client bundle
- [ ] A03 Injection — Drizzle parameterized queries (`?orderBy=1;DROP TABLE persons`)
- [ ] A04 Insecure Design — rate limit per endpoint category (P2 gap — define budgets first)
- [ ] A05 Security Misconfiguration — CSP / HSTS / X-Frame-Options headers (P2 gap)
- [ ] A06 Vulnerable Components — `bun audit` + dependabot baseline
- [ ] A07 Identification & Auth Failures — Better-Auth lockout + 2FA for platform admins
- [ ] A08 Software / Data Integrity — signed Stripe webhooks; signed `/email/unsubscribe` tokens
- [ ] A09 Logging & Monitoring Failures — correlation-id propagation; audit log on every officer mutation
- [ ] A10 SSRF — disallow user-controlled outbound URLs in storage uploads

#### Memberry-specific (5)

- [ ] **Idempotency:** double-submit POST `/dues/recordManualPayment` with same `Idempotency-Key` returns one record
- [ ] **Impersonation:** read-only audit assertion — impersonation session cannot POST/PUT/DELETE (BR-10)
- [ ] **Cross-org bleed:** officer of org A switching to org B sees only org B data
- [ ] **Webhook replay:** Stripe webhook with old `timestamp` is rejected
- [ ] **Unsubscribe token:** unsubscribe link without signature returns 401

### Auth Matrix (sample roles × endpoints)

> Full role × module × action matrix lives in `docs/product/ROLE_PERMISSION_MATRIX.md` §3 (10+ sub-matrices). The table below is the spot-check the walker should assert at runtime.

| Role | GET `/persons/:self` | POST `/dues/recordManualPayment` | DELETE `/admin/orgs/:id` | GET `/comms/ws` |
|------|--------------------|-----------------------------------|---------------------------|------------------|
| guest | 401 | 401 | 401 | 401 |
| user (no person) | 401 (until onboarded) | 401 | 401 | 401 |
| member | 200 (self only) | 403 | 403 | 200 |
| officer | 200 (org-scoped) | 200 (idempotent) | 403 | 200 |
| treasurer | 200 (org-scoped) | 200 (idempotent) | 403 | 200 |
| platform-admin | 200 (all, read-only via impersonation) | 403 (org-scoped action) | 200 | 200 |

### Cross-Layer Contract Walker (Full FE↔BE mode — Playwright template)

> **Mode: Full FE↔BE walker** — v6 CODE_COMPONENT_REGISTRY populates `api_calls`, `loading_state_hygiene`, `interaction_hygiene`, `hrefs`. Walker asserts: (a) every declared `api_call` fires on mount, (b) skeleton resolves within 5s ceiling, (c) no `/undefined` or `/null` in URL, (d) no raw UUID rendered in body text, (e) no console.error / pageerror, (f) `hrefs` resolve (J-DEADHREF cross-check).

Place this template at `apps/memberry/tests/e2e/runtime-contract-walker.spec.ts`. Memberry's existing Playwright config already targets baseURL `http://localhost:3004`.

```ts
// apps/memberry/tests/e2e/runtime-contract-walker.spec.ts
// TEMPLATE — generated by /oli-check --runtime against engine v6 maps.
// Customize signIn() for your auth fixture; tune SKELETON_SELECTORS for your DS.
import { test, expect, type Page, type Request } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const ROUTE_MAP_PATH = path.join(REPO_ROOT, 'docs/audits/codebase-map/CODE_ROUTE_MAP.json');
const REGISTRY_PATH = path.join(REPO_ROOT, 'docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json');

const APP = process.env.WALKER_APP ?? 'apps/memberry'; // or 'apps/admin'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3004';
const SKELETON_TIMEOUT_MS = 5000;
const SKELETON_SELECTORS = '[aria-busy="true"], [data-skeleton="true"], [data-state="loading"], .skeleton';
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

interface RouteEntry {
  method: string;
  page_component: string | null;
  middleware: string[];
  auth_required: boolean | null;
  params: string[];
  module: string;
}
interface ApiCall { method: string; endpoint: string; }
interface LoadingHygiene { has_skeleton: boolean; has_error_branch: boolean; violation: boolean; }
interface InteractionHygiene { hrefs: string[]; violation: boolean; }
interface ComponentEntry {
  name: string;
  api_calls: ApiCall[];
  routes_used_in: string[];
  loading_state_hygiene?: LoadingHygiene;
  interaction_hygiene?: InteractionHygiene;
}

async function signIn(_page: Page): Promise<void> {
  // CUSTOMIZE — Memberry uses Better-Auth at /auth/sign-in/email
  // const email = process.env.E2E_USER ?? 'walker@contract-tests.local';
  // const pass  = process.env.E2E_PASS ?? 'walker-password';
  // await _page.goto(`${BASE_URL}/auth/sign-in`);
  // await _page.fill('[name=email]', email);
  // await _page.fill('[name=password]', pass);
  // await _page.click('button[type=submit]');
  // await _page.waitForURL('**/dashboard');
}

test('cross-layer FE↔BE contract walker — Full mode (engine v6)', async ({ page }) => {
  const routeMap = JSON.parse(fs.readFileSync(ROUTE_MAP_PATH, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const components: Record<string, ComponentEntry> = registry.components;

  await signIn(page);

  const failures: Array<{ route: string; class: string; reason: string }> = [];

  // Param-free first pass — fixture-bound param routes get a second pass with a fixture file.
  const candidates = (Object.entries(routeMap.routes) as [string, RouteEntry][]).filter(
    ([, r]) =>
      r.module === APP &&
      r.page_component !== null &&
      r.params.length === 0,
  );

  for (const [routePath, route] of candidates) {
    const component = route.page_component ? components[route.page_component] : undefined;
    const declared = (component?.api_calls ?? []).map(
      (c) => `${c.method} ${c.endpoint.replace(/:[^/]+/g, '*')}`,
    );
    const declaredHrefs = component?.interaction_hygiene?.hrefs ?? [];
    const captured: string[] = [];
    const consoleErrors: string[] = [];

    const onRequest = (request: Request) => {
      const url = new URL(request.url());
      captured.push(`${request.method()} ${url.pathname}`);
    };
    const onConsole = (m: { type: () => string; text: () => string }) =>
      m.type() === 'error' && consoleErrors.push(m.text());
    const onPageError = (e: Error) => consoleErrors.push(`pageerror: ${e.message}`);

    page.on('request', onRequest);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    try {
      await page.goto(`${BASE_URL}${routePath}`, { waitUntil: 'domcontentloaded' });

      // (a) no /undefined or /null in URL after settle
      const url = page.url();
      if (url.includes('/undefined') || url.includes('/null')) {
        failures.push({ route: routePath, class: 'url-undefined', reason: `final URL=${url}` });
      }

      // (b) skeleton ceiling
      const resolved = await page
        .waitForFunction(
          (sel: string) => !document.querySelector(sel),
          SKELETON_SELECTORS,
          { timeout: SKELETON_TIMEOUT_MS },
        )
        .then(() => true)
        .catch(() => false);

      if (!resolved) {
        failures.push({
          route: routePath,
          class: 'infinite-skeleton',
          reason: `skeleton stuck past ${SKELETON_TIMEOUT_MS}ms`,
        });
        // continue to api_call check anyway — both classes can coexist
      }

      // (c) every declared api_call fired at least once
      const missing = declared.filter(
        (d) => !captured.some((c) => new RegExp(`^${d.replace(/\*/g, '[^/]+')}$`).test(c)),
      );
      if (missing.length > 0) {
        failures.push({
          route: routePath,
          class: 'api-call-missing',
          reason: `declared but not fired: ${missing.join(', ')}`,
        });
      }

      // (d) no raw UUID in user-visible body
      const bodyText = await page.locator('body').innerText();
      if (UUID_RE.test(bodyText)) {
        failures.push({ route: routePath, class: 'uuid-render', reason: 'raw UUID visible in body text' });
      }

      // (e) console / page errors
      if (consoleErrors.length > 0) {
        failures.push({
          route: routePath,
          class: 'console-error',
          reason: consoleErrors.slice(0, 3).join(' | '),
        });
      }

      // (f) J-DEADHREF — anchor/link hrefs declared in component must resolve in route map
      for (const href of declaredHrefs) {
        if (!href.startsWith('/')) continue; // skip external
        const baseHref = href.split('?')[0]?.split('#')[0] ?? '';
        const resolvedInMap =
          baseHref in routeMap.routes ||
          Object.keys(routeMap.routes).some((r) => baseHref.startsWith(r));
        if (!resolvedInMap) {
          failures.push({
            route: routePath,
            class: 'dead-href',
            reason: `component declares href=${href} not in route map`,
          });
        }
      }
    } finally {
      page.removeListener('request', onRequest);
      page.removeListener('console', onConsole);
      page.removeListener('pageerror', onPageError);
    }
  }

  expect(
    failures,
    `Cross-layer walker failures (${APP}):\n${JSON.stringify(failures, null, 2)}`,
  ).toHaveLength(0);
});
```

**Walker contract summary:**

| Failure class | Detection mechanism | Bug class closed |
|---------------|---------------------|------------------|
| `infinite-skeleton` | `waitForFunction(skeleton-selector absent)` with 5s ceiling | Memberry 2026-05-30 |
| `api-call-missing` | `page.on('request')` capture vs `component.api_calls` declared | Cross-layer FE↔BE contract drift |
| `url-undefined` | `page.url()` includes `/undefined` or `/null` | Memberry 2026-05-31 |
| `uuid-render` | UUID regex against `body.innerText` | Memberry 2026-05-31 |
| `console-error` | `page.on('console' \| 'pageerror')` | Boot-smoke parity |
| `dead-href` | `component.interaction_hygiene.hrefs` vs route map keys | J-DEADHREF class |

**Cost:** ~37 param-free routes × ~1–2s per route on `domcontentloaded` + 5s ceiling = ~3–4 min serial wall clock. Sign-in amortized once.

### Accessibility Config (axe-core)

```ts
// apps/memberry/tests/e2e/a11y-baseline.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SCREENS = [
  '/',
  '/auth/sign-in',
  '/dashboard',
  '/my/profile',
  '/my/credits',
  '/my/billing',
];

for (const url of SCREENS) {
  test(`a11y baseline (WCAG 2.1 AA) — ${url}`, async ({ page }) => {
    await page.goto(url);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
```

> **a11y baseline inference:** No `accessibility-baseline.md` files were found under `docs/product/modules/*/ui-prototype/`. Per skill contract, inferring **WCAG 2.1 AA** target. `CONFIRM: a11y baseline inferred (WCAG AA) — confirm or override.`

---

## Per-Module Runtime Coverage (22 modules)

Legend: tier-1 (boot-smoke audited), tier-2 (route × interaction matrix template covers ≥ 1 route)
- ✓ = covered, ⊘ = partial / template only, ✗ = not covered

| # | Module | Routes in map | Tier-1 / Tier-2 | Status |
|---|--------|---------------|------------------|--------|
| 1 | m01-auth-onboarding | 7 | tier-1 ✓ / tier-2 ✓ | **✓** (auth smoke in api `smoke.test.ts` + 5 e2e specs under `tests/e2e/auth/`) |
| 2 | m02-member-profile | 8 | tier-1 ⊘ / tier-2 ✓ | **⊘** (profile.spec.ts present; walker covers /my/profile) |
| 3 | m03-platform-admin | 0 (admin app = 17 routes) | tier-1 ✓ / tier-2 ✓ | **✓** (`admin-smoke.spec.ts` + 17 admin routes in walker) |
| 4 | m04-org-admin | ~80 | tier-1 ⊘ / tier-2 ✓ | **✓** (largest surface; walker covers param-free subset) |
| 5 | m05-membership | folded into m04 | tier-1 ⊘ / tier-2 ⊘ | **⊘** (routes nested under `/org/$orgSlug/officer/*`) |
| 6 | m06-dues-payments | 3 | tier-1 ⊘ / tier-2 ✓ | **⊘** (billing.spec.ts present; walker covers /my/billing) |
| 7 | m07-communications | 4 | tier-1 ⊘ / tier-2 ✓ | **⊘** (communications.spec.ts present; WS scenario in k6) |
| 8 | m08-events | 4 | tier-1 ⊘ / tier-2 ✓ | **⊘** (member/event-capacity.spec.ts present) |
| 9 | m09-training | 2 | tier-1 ✗ / tier-2 ✓ | **⊘** (no dedicated training e2e spec; walker covers routes) |
| 10 | m10-credit-tracking | 2 | tier-1 ✗ / tier-2 ✓ | **⊘** (no credit-only e2e spec; walker covers /my/credits) |
| 11 | m11-documents-credentials | 2 | tier-1 ✗ / tier-2 ✓ | **⊘** (walker covers /my/certificates; no dedicated spec) |
| 12 | m12-elections-governance | folded into m04 | tier-1 ✗ / tier-2 ⊘ | **✗** (no e2e file; routes nested) |
| 13 | m13-professional-feed | 0 | tier-1 ✗ / tier-2 ✗ | **✗** (stub only: `stubs/feed-moderation.spec.ts`) |
| 14 | m14-national-dashboard | 1 | tier-1 ✗ / tier-2 ⊘ | **✗** (stub only: `stubs/national-dashboard.spec.ts`) |
| 15 | m15-job-board | 0 | tier-1 ✗ / tier-2 ✗ | **✗** (stub only: `stubs/job-posting-expiry.spec.ts`) |
| 16 | m16-advertising | 0 | tier-1 ✗ / tier-2 ✗ | **✗** (no routes in map; no spec) |
| 17 | m17-marketplace | 0 | tier-1 ✗ / tier-2 ✗ | **✗** (stub only: `stubs/marketplace-referral.spec.ts`) |
| 18 | m18-surveys-polls | 3 | tier-1 ⊘ / tier-2 ✓ | **⊘** (officer-surveys + member-surveys specs present) |
| 19 | m19-committee-management | 1 | tier-1 ✗ / tier-2 ⊘ | **✗** (stub only: `stubs/committee-dissolution.spec.ts`) |
| 20 | m20-booking | 5 | tier-1 ⊘ / tier-2 ✓ | **⊘** (walker covers /my/bookings/*; no dedicated spec) |
| 21 | m21-billing | 0 (server-side) | tier-1 ⊘ / tier-2 ⊘ | **⊘** (Stripe Connect routes server-side; no client routes) |
| 22 | m22-email | 0 (server-side) | tier-1 ✓ / tier-2 n/a | **⊘** (API smoke covers /auth/ok which exercises email queue) |

**Roll-up:** ✓ = 3 modules, ⊘ = 11 modules, ✗ = 8 modules (mostly stubbed wave-future modules m13/m15/m16/m17/m19 — expected gaps for unbuilt features).

---

## Top 5 Findings

1. **STALE MAP — STALE-OVERLAP (P2).** Map snapshot `2026-06-01T13:47:58Z` (`f29971811`) precedes 13 modified .tsx files in `apps/memberry/src/routes/_authenticated/**` working tree. New routes / `api_calls` added since the snapshot won't appear in walker scope. **Fix:** rerun `/oli-codebase-map` before Tier-3 live execution. Boot-smoke (Tier 1) is source-scanned and unaffected.
2. **8 MODULES UNCOVERED BY E2E (P2)** — m13 feed, m15 jobs, m16 ads, m17 marketplace, m19 committees all have stub specs only (file present, no real assertions). m09 training, m10 credits, m11 documents lack dedicated specs (walker covers them, but no business-rule verification). m12 elections has no e2e at all.
3. **DAST GAP — cross-tenant isolation NOT VERIFIED (P0/P1 from THREAT_MODEL).** Threat-model says "Verify" for cross-tenant data leakage and cross-org privilege bleed. No automated test asserts org-A member cannot reach org-B data. Walker template targets single-tenant fixture only. **Fix:** add Info-Disclosure-1 + EoP cross-org tests as P0 BLOCK before pilot.
4. **NO RATE-LIMIT BUDGET DEFINED (P2 from THREAT_MODEL).** PERFORMANCE.md sets 500-concurrent NFR but THREAT_MODEL+API_CONVENTIONS have no per-endpoint rate-limit thresholds. k6 `s4_auth_roundtrip` stress-tests auth, but DAST item OWASP-A04 can't be verified until budgets exist. **Fix:** define rate-limit budgets per endpoint category in API_CONVENTIONS.md §RATE_LIMIT.
5. **DOC-DRIFT IN `.env.example` (P3 from Tier 1).** Root `.env.example` and `services/api-ts/.env.example` disagree on `STORAGE_BUCKET` and `CORS_ORIGINS`. Zod schema defaults rescue both, but copy-paste lands a contributor on the wrong bucket / missing origins. **Fix:** point root `.env.example` at `services/api-ts/.env.example` as canonical (already partially done — root is a pointer file) and remove the override lines that contradict.

---

## Why Tier 3 Was Skipped

`live_runtime_available` evaluation:

| Gate | Required | Actual | Pass? |
|------|----------|--------|-------|
| `--live` flag passed by caller | true | **false** | ✗ |
| Map version ≥ v4 (engine post-v4) | true | **v6** | ✓ |
| `loading_state_hygiene` populated | true | **populated (v6)** | ✓ |
| `routes_used_in` populated | true | **populated (v6)** | ✓ |
| `interaction_hygiene.hrefs` populated | true | **populated (v6)** | ✓ |
| Map fresh (no STALE-OVERLAP) | preferred | **STALE-OVERLAP (13 files)** | ⚠ WARN |

**Reason:** caller did not pass `--live` this run. Engine map is v6 — Tier-3 executor *would* route to the full FE↔BE walker (not Tier-3-lite) if `--live` were passed. Recommend map refresh first to clear STALE-OVERLAP.

**`RUNTIME-LIVE: skipped (no --live)`**

---

## What's Next

1. **Refresh code map** — run `/oli-codebase-map --refresh` to capture the 13 working-tree .tsx changes and lift snapshot beyond `STALE-OVERLAP`.
2. **Run live Tier 3** — `/oli-check --runtime --live` after refresh (will route to Full walker on v6 map).
3. **Materialize k6 templates** — fill in staging baseURL + auth fixtures, wire into CI nightly perf job. High-value first: `s0_member_search` (tightest SLA: < 200ms) and `s5_ws_concurrency` (500-concurrent NFR).
4. **Add P0 cross-tenant DAST tests** — close THREAT_MODEL "Verify" items before pilot launch.
5. **Build e2e specs for uncovered modules** — m12, m13, m15, m16, m17, m19 — even basic mount-and-no-console-error specs would lift coverage from ✗ to ⊘.
6. **Confirm WCAG AA inference** — review the inferred a11y baseline; create `docs/product/modules/*/ui-prototype/accessibility-baseline.md` for modules that need a different target (typically m11 documents → AAA for PDF accessibility).
