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

# Journey Coverage Report — `--journeys` (re-run after fixes)

Source-scanned static interaction-integrity audit. Re-run targeting the 4 P0/P1 findings from the `--all --live` run (2026-05-31). Journeys analysis is source-derived and immune to map staleness.

**Verdict: PASS** — all P0/P1 resolved + verified in code and browser. Only P2/P3 advisories remain.

## Severity Summary

| Severity | Count | Drivers |
|----------|-------|---------|
| P0 | 0 | — (J-ORG-001 resolved) |
| P1 | 0 | — (J-MY-001, J-OFC-001, J-OFC-002 resolved) |
| P2 | 2 | J-MY-002, J-ERROR-GENERIC cluster (officer) |
| P3 | 2 | J-OFC-003, J-MY-009 |

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

## P2 Findings

### J-MY-002 — Payment history empty state is indistinguishable from load failure (P2)
`apps/memberry/src/routes/_authenticated/my/payments.tsx` — payment-history surface renders the same empty UI on a 2xx-empty as on a query error (no error branch). Silent-empty risk.

### J-ERROR-GENERIC cluster (P2, officer-heavy)
Static error toasts/messages with no `err.code` / `err.message` interpolation — generic "Something went wrong" text that can't tell the user what to do. Concentrated in officer surfaces. Advisory-to-moderate; does not block.

## P3 Findings

### J-OFC-003 — "Use Template" button has no own onClick (P3, downgraded)
`apps/memberry/src/features/surveys/components/survey-templates.tsx:141-147`

`<Button variant="ghost" size="sm">Use Template</Button>` has no `onClick`. Initially flagged P1, but the **parent card** (`onClick={() => onSelect(t)}`, line 128) handles selection and the button does not `stopPropagation`, so a click bubbles and the template IS selected. Functional via bubbling → downgraded to P3 (redundant/decorative button; relies on event bubbling, fragile but not dead).

### J-MY-009 — Training discovery dead-end (P3)
Training list offers no forward action when a member has no enrolled/available training — advisory dead-end, no data loss.

## Live Reconciliation (ER- ↔ J-)

The executor loaded 109 routes as a seeded member with ZERO app-origin P0/P1 (no pageerror, no 4xx/401, no infinite-skeleton, no `/undefined` URL, no raw-UUID cell). It did NOT exercise click-only actions (download, Pay Dues) because `dataSurfaces` is empty — so none of the static P0/P1 above were confirmable or refutable live. The single ER-P1 is a runner-exception locator flake at `/my/payments` (not an app defect — see RUNTIME_EXEC_REPORT.md). No ER- finding upgrades or clears a J- finding this run.
