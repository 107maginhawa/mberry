---
oli-version: "1.0"
based-on:
  - docs/audits/JOURNEY_COVERAGE_REPORT.md
  - docs/audits/RUNTIME_EXEC_REPORT.md
  - docs/audits/runtime/runtime-exec-results.json
  - docs/audits/codebase-map/.map-meta.json
last-modified: 2026-06-01T00:00:00Z
last-modified-by: oli-check
flags: --journeys
---

# OLI Check Summary — `--journeys` (re-run after P2/P3 fixes)

## 0. TRUST STATUS

| Field | Value |
|-------|-------|
| Producer | **engine** (engine_version 0.1.0) |
| Map version | 5 |
| MAP-FRESHNESS | **STALE-OVERLAP** — 5 working-tree files newer than map (certificate-preview.tsx, officer/compliance.tsx, officer/certificates.tsx, my/settings.tsx, my/profile.tsx) |
| map@ | engine v5 build · HEAD@82dd56dc |
| fields_unavailable | `[]` |
| unverified (below-threshold nodes) | 0 |

**Journeys is source-scanned (immune to map staleness).** This `--journeys` re-run targets the 2 P2 + 2 P3 advisories left after P0/P1 clearance; each is verified resolved in code + browser. No runtime dimension selected this run.

## 1. Run Context

- **Detected state:** source code present, UI present (UI_BLUEPRINT).
- **Dimensions selected:** Journeys (static). Runtime not selected (no `--live` this run).
- **Flags:** `--journeys`.

## 2. Dimension Results

| Dimension | Verdict | Report | Findings | unverified |
|-----------|---------|--------|----------|------------|
| Journeys | **PASS** | `JOURNEY_COVERAGE_REPORT.md` | P0:0 P1:0 P2:0 P3:0 | 0 |

All prior findings resolved: J-ORG-001 (P0), J-MY-001/J-OFC-001/J-OFC-002 (P1), J-MY-002 + J-ERROR-GENERIC (P2), J-OFC-003 + J-MY-009 (P3).

## 3. Coverage Matrix (module × applicable dimension)

Single dimension this run (Journeys static). `✓` = ran + verdict; `⊘ reason` = legitimately N/A; `✗` = applicable but no verdict.

| Module | Journeys (static) |
|--------|-------------------|
| M01 Auth / public | ✓ |
| M02 Profile | ✓ |
| M03 Settings | ✓ |
| M04 ID Card / Certificates (member) | ✓ |
| M05 Training / CPD | ✓ (J-MY-009 RESOLVED) |
| M06 Events / Booking | ✓ |
| M07 Dues / Payments (member) | ✓ (J-MY-001 RESOLVED; J-MY-002 RESOLVED) |
| M08 Org membership | ✓ (J-ORG-001 RESOLVED) |
| M09 Documents | ✓ (J-ORG-001 RESOLVED) |
| M10 Governance / Elections | ✓ |
| M11 Announcements / Comms | ✓ |
| M12 Notifications | ✓ |
| M13 Professional Feed | ⊘ no-ui (unbuilt) |
| M14 National Dashboard | ⊘ no-ui (unbuilt) |
| M15 Job Board | ⊘ no-ui (unbuilt) |
| M16 Advertising | ⊘ no-ui (unbuilt) |
| M17 Marketplace | ⊘ no-ui (unbuilt) |
| M18 Surveys & Polls | ✓ (J-OFC-003 RESOLVED) |
| M19 Officer / Finance (gateway) | ✓ (J-OFC-001/002 RESOLVED; J-ERROR-GENERIC RESOLVED) |

**Uncovered modules (✗ gap):** none. All built modules covered by Journeys.

## 4. GATE

```
GATE: PASS
```

**Resolved prior cycle (P0/P1, verified in code + browser):**
- J-ORG-001 (P0) — document download → registered backend route `GET /documents/:documentId/download` (app.ts:490, handler `downloadDocument.ts`); client repointed to `/api/documents/${documentId}/download`. Browser-verified 302 → presigned MinIO URL; 401 unauth, 400 bad-uuid, membership-gated.
- J-MY-001 (P1) — Pay Dues now a `<Link to="/org/$orgSlug/dues">` (organizations.tsx:123). Browser-verified.
- J-OFC-001 (P1) — `testMutation` has `onError` (gateway-setup.tsx:48) with `toast.error`.
- J-OFC-002 (P1) — `disconnectMutation` has `onError` (gateway-setup.tsx:75) with `toast.error`.

**Resolved this cycle (P2/P3, verified in code + browser):**
- J-MY-002 (P2) — payment-history-table.tsx now renders a distinct error branch (AlertTriangle, `role="alert"`, Retry) separate from the empty state. Browser-verified `/my/payments` clean empty render.
- J-ERROR-GENERIC (P2) — new `utils/error.ts#extractErrorMessage` (handles flat + nested error shapes, surfaces taxonomy code); wired into officer/finance `onError` toasts across providers, payments, invoices, special-assessments, dues-config, gateway-save. Browser-verified officer finance pages load clean.
- J-OFC-003 (P3) — "Use Template" button has own `onClick` + `stopPropagation` (survey-templates.tsx). Browser-verified direct click applies template.
- J-MY-009 (P3) — training empty state carries a forward CTA ("Browse training catalog" / "View my organizations"). Browser-verified.

No `✗ gap`. Zero open journey findings (P0/P1/P2/P3 all 0) → **PASS**.

## 5. What's Next

1. (Optional) Re-run `/oli-check --journeys --all --live` with seeded `dataSurfaces` + officer auth for empirical Tier-3 backstop on download / Pay Dues / officer surfaces.
2. Ship with `/ship` — journeys gate is clear, zero open findings.

> Note: a separate dues-page render crash chain (Date-vs-string `periodStart` + BigInt arithmetic) was found and fixed during J-MY-001 verification — `dues.tsx` (fmtPeriod helper, `Number(...)` BigInt guards) and `arrears-breakdown.tsx` (`groupByYear` `getFullYear` instead of `.slice`). These were runtime crashes on the Pay Dues destination, not static journey findings; verified clean in browser.
