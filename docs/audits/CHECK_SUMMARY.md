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

# OLI Check Summary — `--journeys` (re-run after fixes)

## 0. TRUST STATUS

| Field | Value |
|-------|-------|
| Producer | **engine** (engine_version 0.1.0) |
| Map version | 5 |
| MAP-FRESHNESS | **STALE-OVERLAP** — 5 working-tree files newer than map (certificate-preview.tsx, officer/compliance.tsx, officer/certificates.tsx, my/settings.tsx, my/profile.tsx) |
| map@ | engine v5 build · HEAD@82dd56dc |
| fields_unavailable | `[]` |
| unverified (below-threshold nodes) | 0 |

**Journeys is source-scanned (immune to map staleness).** This `--journeys` re-run targets the 4 P0/P1 findings from the `--all --live` run (2026-05-31); each is verified resolved in code + browser. No runtime dimension selected this run.

## 1. Run Context

- **Detected state:** source code present, UI present (UI_BLUEPRINT).
- **Dimensions selected:** Journeys (static). Runtime not selected (no `--live` this run).
- **Flags:** `--journeys`.

## 2. Dimension Results

| Dimension | Verdict | Report | Findings | unverified |
|-----------|---------|--------|----------|------------|
| Journeys | **PASS** | `JOURNEY_COVERAGE_REPORT.md` | P0:0 P1:0 P2:2 P3:2 | 0 |

Prior P0/P1 (now resolved): J-ORG-001 (P0), J-MY-001 (P1), J-OFC-001 (P1), J-OFC-002 (P1).

## 3. Coverage Matrix (module × applicable dimension)

Single dimension this run (Journeys static). `✓` = ran + verdict; `⊘ reason` = legitimately N/A; `✗` = applicable but no verdict.

| Module | Journeys (static) |
|--------|-------------------|
| M01 Auth / public | ✓ |
| M02 Profile | ✓ |
| M03 Settings | ✓ |
| M04 ID Card / Certificates (member) | ✓ |
| M05 Training / CPD | ✓ (J-MY-009 P3) |
| M06 Events / Booking | ✓ |
| M07 Dues / Payments (member) | ✓ (J-MY-001 RESOLVED; J-MY-002 P2) |
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
| M18 Surveys & Polls | ✓ (J-OFC-003 P3) |
| M19 Officer / Finance (gateway) | ✓ (J-OFC-001/002 RESOLVED; J-ERROR-GENERIC P2) |

**Uncovered modules (✗ gap):** none. All built modules covered by Journeys.

## 4. GATE

```
GATE: PASS
```

**Resolved this cycle (verified in code + browser):**
- J-ORG-001 (P0) — document download → registered backend route `GET /documents/:documentId/download` (app.ts:490, handler `downloadDocument.ts`); client repointed to `/api/documents/${documentId}/download`. Browser-verified 302 → presigned MinIO URL; 401 unauth, 400 bad-uuid, membership-gated.
- J-MY-001 (P1) — Pay Dues now a `<Link to="/org/$orgSlug/dues">` (organizations.tsx:123). Browser-verified: navigates to dues page, which renders real dues content with no ErrorBoundary.
- J-OFC-001 (P1) — `testMutation` has `onError` (gateway-setup.tsx:48) with `toast.error`.
- J-OFC-002 (P1) — `disconnectMutation` has `onError` (gateway-setup.tsx:75) with `toast.error`.

Remaining findings are P2/P3 only (do not gate): J-MY-002, J-ERROR-GENERIC (P2); J-MY-009, J-OFC-003 (P3).

No `✗ gap`. No P0/P1 remain → **PASS**.

## 5. What's Next

1. (Optional) Address P2s: `J-ERROR-GENERIC` (interpolate `err.code`/`err.message` in dues toasts), `J-MY-002`.
2. (Optional) Re-run `/oli-check --journeys --all --live` with seeded `dataSurfaces` + officer auth for empirical Tier-3 backstop on download / Pay Dues / officer surfaces.
3. Ship with `/ship` — journeys gate is clear.

> Note: a separate dues-page render crash chain (Date-vs-string `periodStart` + BigInt arithmetic) was found and fixed during J-MY-001 verification — `dues.tsx` (fmtPeriod helper, `Number(...)` BigInt guards) and `arrears-breakdown.tsx` (`groupByYear` `getFullYear` instead of `.slice`). These were runtime crashes on the Pay Dues destination, not static journey findings; verified clean in browser.
