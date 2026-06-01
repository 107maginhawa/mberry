---
oli-version: "1.0"
dimension: journeys
based-on:
  - docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json
  - docs/audits/codebase-map/CODE_ROUTE_MAP.json
  - docs/product/UI_BLUEPRINT.md
last-modified: 2026-06-01T00:00:00Z
last-modified-by: oli-check --journeys
map-freshness: STALE-OVERLAP
thesis: source-scanned (journeys immune to map staleness)
verdict: PASS
---

# Journey Coverage Report — `--journeys` (re-run after P2/P3 fixes)

Source-scanned static interaction-integrity audit. Re-run targeting the 2 P2 + 2 P3 advisories left after the P0/P1 clearance. Journeys analysis is source-derived and immune to map staleness.

**Verdict: PASS** — all P0/P1/P2/P3 resolved + verified in code and browser. Zero open journey findings.

## Severity Summary

| Severity | Count | Drivers |
|----------|-------|---------|
| P0 | 0 | — (J-ORG-001 resolved) |
| P1 | 0 | — (J-MY-001, J-OFC-001, J-OFC-002 resolved) |
| P2 | 0 | — (J-MY-002, J-ERROR-GENERIC cluster resolved) |
| P3 | 0 | — (J-OFC-003, J-MY-009 resolved) |

## Changes Since Last Run

The 4 P0/P1 findings from the prior `--all --live` run are all resolved and verified:

- **RESOLVED P0** J-ORG-001 — registered backend `GET /documents/:documentId/download` (app.ts:490, handler `downloadDocument.ts`, membership-gated, 302→presigned URL); client repointed to `/api/documents/${documentId}/download`. Browser-verified.
- **RESOLVED P1** J-MY-001 — Pay Dues is now a `<Link to="/org/$orgSlug/dues">`. Browser-verified navigation; dues destination renders clean.
- **RESOLVED P1** J-OFC-001 — `testMutation` now has `onError` (gateway-setup.tsx:48).
- **RESOLVED P1** J-OFC-002 — `disconnectMutation` now has `onError` (gateway-setup.tsx:75).
- Prior resolved findings remain resolved.
- Bonus: dues-page render crash chain (Date `periodStart` `.slice`/`getFullYear`, BigInt arithmetic) found while verifying J-MY-001 and fixed in `dues.tsx` + `arrears-breakdown.tsx`. Runtime crash, not a static journey finding; verified clean.

## P0 Findings — RESOLVED

### J-ORG-001 — Document download → dead endpoint (P0) — RESOLVED
`apps/memberry/src/routes/_authenticated/org/$orgSlug/documents/$documentId.tsx:236,252`

Was: both `<a href>` (236) and `<iframe src>` (252) pointed at `/api/association/documents/${documentId}/download` — no registered backend route (Vite strips `/api` → `association/documents/:id/download` unregistered, and the documentId UUID would be mis-read as orgId by `/association/*` org-context middleware) → 404.

**Fix:** registered a hand-wired `GET /documents/:documentId/download` (app.ts:490, handler `services/api-ts/src/handlers/documents/downloadDocument.ts`) mounted OUTSIDE `/association/*` to avoid the UUID/orgId collision. It self-enforces access (platform admin OR active member of the doc's org), audits the read, and 302-redirects to a short-lived presigned storage URL. Client repointed to `/api/documents/${documentId}/download`.

**Browser-verified:** 302 → presigned MinIO URL; 401 unauthenticated; 400 on bad UUID; membership-gated.

## P1 Findings — RESOLVED

### J-MY-001 — Pay Dues button is a no-op (P1) — RESOLVED
`apps/memberry/src/routes/_authenticated/my/organizations.tsx:122-126`

Was: `<Button onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>Pay Dues</Button>` swallowed the event.

**Fix:** now `<Button size="sm" asChild><Link to="/org/$orgSlug/dues" params={{ orgSlug: ... }}>Pay Dues</Link></Button>`. **Browser-verified:** navigates to the dues page, which renders real dues content (Outstanding Dues, Aging Summary, invoices, Payment Timeline) with no ErrorBoundary.

### J-OFC-001 — Gateway "Test Connection" has no error handling (P1) — RESOLVED
`apps/memberry/src/features/dues/components/gateway-setup.tsx:48`

**Fix:** `testMutation` now has `onError` surfacing `toast.error('Connection test failed', ...)` and setting the inline test-result error state.

### J-OFC-002 — Gateway "Disconnect" has no error handling (P1) — RESOLVED
`apps/memberry/src/features/dues/components/gateway-setup.tsx:75`

**Fix:** `disconnectMutation` now has `onError` surfacing `toast.error('Failed to disconnect', ...)`.

## P2 Findings — RESOLVED

### J-MY-002 — Payment history empty state is indistinguishable from load failure (P2) — RESOLVED
`apps/memberry/src/features/dues/components/payment-history-table.tsx` (the query surface behind `/my/payments`).

Was: `useQuery` destructured only `data, isLoading`; a query error fell through to the same empty UI as a 2xx-empty (silent-empty risk).

**Fix:** destructure `isError, refetch, isRefetching` and render a distinct error branch (AlertTriangle, "Couldn't load payments", `role="alert"`, Retry button) before the empty-state branch. Empty now renders only on a genuine 2xx-empty. **Browser-verified:** `/my/payments` renders a clean empty state (no false error); error branch is structurally separate.

### J-ERROR-GENERIC cluster (P2, officer-heavy) — RESOLVED
Static error toasts with no `err.code` / `err.message` interpolation across officer/finance surfaces.

**Fix:** introduced `apps/memberry/src/utils/error.ts#extractErrorMessage` (handles both the flat `{message,code}` runtime shape and the taxonomy-documented nested `{error:{code,message}}` shape; surfaces the taxonomy code as `"message (CODE)"`). Repointed `onError` handlers to `toast.error('Failed to X', { description: extractErrorMessage(err, 'Please try again.') })` in: officer/settings/providers.tsx (3), officer/payments/index.tsx, officer/finances/invoices.tsx, officer/finances/invoices/$invoiceId.tsx, officer/finances/invoices/index.tsx (3), special-assessments-list.tsx (4), dues-config-form.tsx, gateway-setup.tsx (save). **Browser-verified:** officer finance pages (invoices, funds, payments) load clean as president.

## P3 Findings — RESOLVED

### J-OFC-003 — "Use Template" button has no own onClick (P3) — RESOLVED
`apps/memberry/src/features/surveys/components/survey-templates.tsx:141-148`

Was: `<Button variant="ghost" size="sm">Use Template</Button>` selected only via bubbling to the parent card (fragile).

**Fix:** button now has its own `onClick={(e) => { e.stopPropagation(); onSelect(t) }}`. **Browser-verified:** direct click on "Use Template" advances past template selection into the builder (template applied, inputs populated) as president.

### J-MY-009 — Training discovery dead-end (P3) — RESOLVED
`apps/memberry/src/routes/_authenticated/my/training.tsx`

Was: empty training state offered no forward action.

**Fix:** empty `EmptyState` now carries a forward `action` — "Browse training catalog" → `/org/$orgSlug/training` when the org slug resolves (via `useMyOrgs`), else "View my organizations" → `/my/organizations`. **Browser-verified:** `/my/training` empty state shows the CTA button as a seeded member.

## Live Reconciliation (ER- ↔ J-)

The executor loaded 109 routes as a seeded member with ZERO app-origin P0/P1 (no pageerror, no 4xx/401, no infinite-skeleton, no `/undefined` URL, no raw-UUID cell). It did NOT exercise click-only actions (download, Pay Dues) because `dataSurfaces` is empty — so none of the static P0/P1 above were confirmable or refutable live. The single ER-P1 is a runner-exception locator flake at `/my/payments` (not an app defect — see RUNTIME_EXEC_REPORT.md). No ER- finding upgrades or clears a J- finding this run.
