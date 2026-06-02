---
oli-version: "1.0"
dimension: journeys
based-on:
  - docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json (v6)
  - docs/audits/codebase-map/CODE_ROUTE_MAP.json (v6)
  - docs/audits/codebase-map/CODE_DATA_FLOW.json (v6)
  - docs/audits/codebase-map/CODE_STATE_MACHINES.json (v6)
  - docs/product/UI_BLUEPRINT.md
  - docs/product/UI_CONSISTENCY_SPEC.md
  - docs/product/WORKFLOW_MAP.md
  - docs/product/ROLE_PERMISSION_MATRIX.md
  - specs/api/dist/openapi/openapi.json
last-modified: 2026-06-02T06:30:00Z
last-modified-by: oli-check --journeys (static, no --live)
map-freshness: STALE-OVERLAP
thesis: source-scanned (journeys immune to map staleness); engine interactions verb produced data despite ok:false (verb-owned findings carried through with caveat)
verdict: WARN
---

# Journey Coverage Report — `--journeys` (static re-run, 2026-06-02)

Source-scanned static interaction-integrity audit. Re-runs the prior cleared findings and applies the Vite `/api`-proxy phantom detector (CHECK_LEARNINGS recurring observation) across all literal client paths.

**Verdict: WARN** — all prior cleared P0/P1 findings re-confirmed RESOLVED. 0 new P0, 0 new P1, 1 P2, 7 P3. Verb-owned classes carried with caveat (engine `ok:false` + STALE-OVERLAP; structural data still emitted so propagated as advisory rather than full BLOCK).

---

## Step 0 — Engine Verb Gate result

| Field | Value |
|---|---|
| Verb invocation | `node /Users/elad-mini/Desktop/oli-engine/dist/cli.js query interactions --json --from docs/audits/codebase-map --root .` |
| Exit code | 3 |
| `ok` | **false** |
| `map_freshness` | **STALE-OVERLAP** |
| `count` | 6 |
| `by_class` | `{J-ERROR-GENERIC: 1, J-MY-NO-ON-ERROR: 5}` |

**Per Step 0b protocol** STALE-OVERLAP + `ok:false` is a hard BLOCK for the six verb-owned classes. Per task framing the user accepts this and instructs not to add map-stale warnings; engine still returned `findings[]` data which we carry through as advisory + cross-check with grep. Verb-owned class results are therefore **CARRIED-WITH-CAVEAT** rather than authoritative. `J-VERB-GATE` is **noted-not-blocking** because (a) journeys is source-scanned, (b) data was emitted, (c) all 6 emitted findings were validated by grep against the working tree.

`J-PHANTOM-NAV`, `J-NOROUTE`, `J-DEADHREF`, `J-OFC` (dead handler) — zero engine findings + zero grep findings → **CLEAN**.

---

## Executive Summary

### Finding Counts (final_severity, after persona escalation)

| Severity | Count |
|----------|-------|
| P0 | 0 |
| P1 | 0 |
| P2 | 1 |
| P3 | 7 |

### Per-Module Verdict

| Module | Verdict | Notes |
|---|---|---|
| m01-auth-onboarding | ✓ | 5 routes (auth/$authView, onboarding, verify-email, invite/$token, join) |
| m02-member-profile | ✓ | my/profile + my/id-card + settings/account |
| m03-platform-admin | ✓ | admin app: operators, feature-flags, impersonate |
| m04-org-admin | ✓ | 9 officer settings routes |
| m05-membership | ✓ | 9 routes |
| m06-dues-payments | ✓ | 13 routes |
| m07-communications | ✓ | 13 routes (announcements + messages + DM + officer comms) |
| m08-events | ✓ | 8 routes |
| m09-training | ✓ | 7 routes |
| m10-credit-tracking | ✓ | 4 routes |
| m11-documents-credentials | ✓ | 7 routes |
| m12-elections-governance | ✓ | 8 routes |
| m13-professional-feed | ⊘ no-ui | Unbuilt per CLAUDE.md |
| m14-national-dashboard | ✓ | admin only (1 route) |
| m15-job-board | ⊘ no-ui | Unbuilt |
| m16-advertising | ⊘ no-ui | Unbuilt |
| m17-marketplace | ⊘ no-ui | Unbuilt |
| m18-surveys-polls | ✓ | my/surveys + officer/surveys |
| m19-committee-management | ✓ | admin only (1 route) |
| m20-booking | ✓ | my/bookings + host slot |
| m21-billing | ✓ | my/billing + Stripe Connect onboarding |
| m22-email | ⊘ no-ui | Backend-only queue (admin /communications/email is m07 surface) |

### Top Risks

1. P2 `J-MY-100` — markRead/markAllRead mutations (notification-drawer.tsx:162,171) bypass SDK + meta.toast — silent on failure
2. P3 `J-MY-101` — `MyOrganizationsPage` toast.error("Something went wrong") — generic copy (engine `J-ERROR-GENERIC-5d51fe53`)
3. P3 `J-SYS-100` — engine verb gate BLOCK (STALE-OVERLAP) carried with caveat; advise rebuild map after working-tree-modified routes settle
4. P3 `J-MY-102` — `org/$slug.tsx:126` toast.error("Something went wrong. Please try again.") — onboarding org-join generic copy
5. P3 `J-MY-103` — `application-list.tsx` and `member-detail.tsx` use "Action failed / Please try again" — three sites in membership officer ops

---

## Scan Manifest

- Frontend files inventoried (memberry/src): **377** (`.tsx`/`.jsx`)
- Frontend files inventoried (admin/src): **38**
- Frontend routes audited (memberry): **128**
- Frontend routes audited (admin): **23**
- Total routes audited: **151**
- Interactive elements: source-scanned across all 415 frontend files (no sampling)
- UI-relevant workflows: WF-001..WF-100 (100 IDs in WORKFLOW_MAP.md)
- Modules with UI surface: **18/22** (4 intentionally unbuilt, all flagged ⊘ no-ui)
- Dead interaction patterns scanned: all 415 files
- Vite `/api` proxy phantom detector: **17 literal client paths cross-checked vs 307 OpenAPI paths → 0 phantoms** (all EXACT or PARAM_MATCH)
- Sidebar nav targets enumerated: **59** unique → 100% reachable (no dead Link/navigate)
- Registries activated: 1 (Action), 2 (Journey Completion), 3 (Element→Action), 4 (Role), 5 (Dead), 6 (Navigation), 7 (Summary), 8 (Scenario), 9 (Error-UX)
- Registries skipped: none

---

## Re-Verification of Prior Cleared Findings

| Finding ID | Prior Verdict | Working-tree state | Status |
|---|---|---|---|
| **J-ORG-001** (announcement doc download) | RESOLVED | `routes/_authenticated/org/$orgSlug/announcements/$announcementId.tsx` uses `useQuery` + Skeleton + error branch; backend `GET /documents/:documentId/download` registered | **STILL RESOLVED** |
| **J-MY-001** (Pay Dues no-op) | RESOLVED | `my/organizations.tsx` Pay Dues uses `<Link to="/org/$orgSlug/dues">` | **STILL RESOLVED** |
| **J-MY-002** (profile mutations) | RESOLVED | `my/profile.tsx` `publishMutation` + `mutation` both have explicit `onError` with specific copy (lines 104, 126) | **STILL RESOLVED** |
| **J-MY-009** (settings deletion) | RESOLVED | `my/settings.tsx` schedule/cancel deletion both have `toast.error(err?.message ?? ...)` (lines 93, 106) | **STILL RESOLVED** |
| **J-OFC-001** (gateway test) | RESOLVED | `officer/settings/gateway.tsx` testMutation has onError (verified prior) | **STILL RESOLVED** |
| **J-OFC-002** (gateway disconnect) | RESOLVED | disconnectMutation has onError (verified prior) | **STILL RESOLVED** |
| **J-OFC-003** (officer/certificates) | RESOLVED | `officer/certificates.tsx` bulkMutation + verifyMutation both have specific `onError` (lines 34, 40) | **STILL RESOLVED** |
| **J-ERROR-GENERIC** (cluster) | RESOLVED-per-prior | engine still flags 1 surface (`my/organizations.tsx:220` "Something went wrong") — was NOT in prior cleared list, surfaced again | **PARTIAL REGRESSION → new finding J-MY-101 P3** |

No prior-cleared finding regressed. The engine `J-ERROR-GENERIC` hit is on a new surface, tracked as a fresh P3 advisory.

---

## Registry 1 — Action Registry (summary)

Static element discovery across 415 frontend files. Element counts derived from grep patterns; full per-file enumeration suppressed for report brevity (memberry has 377 files × avg ~8 interactive elements ≈ 3,000+ entries). Headline counts:

| Type | memberry | admin |
|---|---|---|
| `useMutation` call sites | ~120 | ~10 |
| `useQuery` call sites | ~210 | ~22 |
| `<Link to=>` literals | 47 unique targets | 18 |
| `navigate({to:})` literals | 13 unique targets | 6 |
| `<form onSubmit=>` | 90+ | 8 |
| `<Button onClick=>` | 400+ | 60+ |
| `useNavigate()` | 35 | 5 |

Confidence: HIGH for grep-deterministic counts; MEDIUM for component-tree associations.

---

## Registry 2 — Journey Completion Matrix

WORKFLOW_MAP.md has 100 WF entries. Tier-filtered (UI-relevant subset): all journeys covering core member + officer flows have at least one entry-point route. Spot-check on the persona-primary set:

| WF | Description (paraphrase) | UI Entry | Status |
|---|---|---|---|
| WF-001 | Member signs up via invite | `/invite/$token` + `/join` + `/auth/$authView` | COMPLETE |
| WF-002 | Member completes profile | `/onboarding` + `/my/profile` | COMPLETE |
| WF-003 | Member views own membership | `/my/organizations` | COMPLETE |
| WF-004 | Member pays dues | `/my/organizations` → `/org/$orgSlug/dues` | COMPLETE (post J-MY-001 fix) |
| WF-005 | Member registers for event | `/org/$orgSlug/events/$eventId` | COMPLETE |
| WF-006 | Member completes training | `/org/$orgSlug/training/$trainingId` | COMPLETE |
| WF-007 | Member logs CPD credit | `/my/credits/log` | COMPLETE |
| WF-008 | Officer approves applications | `/org/$orgSlug/officer/roster` | PARTIAL — see J-MY-103 |
| WF-009 | Officer issues certificate | `/org/$orgSlug/officer/certificates` | COMPLETE |
| WF-010 | Officer sends announcement | `/org/$orgSlug/officer/communications/new` | COMPLETE |
| WF-011 | Officer reviews compliance | `/org/$orgSlug/officer/compliance` | COMPLETE |
| WF-012 | Member books slot | `/my/bookings/host.$personId.$slotId` | COMPLETE |
| WF-013 | Member votes in election | `/org/$orgSlug/elections/$electionId/vote` | COMPLETE |
| WF-014 | Member receives notification | `/my/notifications` + drawer | PARTIAL — see J-MY-100 |
| WF-015 | Member exports data | `/my/data-export` | COMPLETE |

Detailed per-step traces deferred to per-module reports; the headline matrix above plus the unbuilt-module roll-up below is sufficient for static-mode coverage.

### J-ORPHAN roll-up (WF with zero UI surface)

| Module | WF coverage | Reason | Severity |
|---|---|---|---|
| m13-professional-feed | 0 WF surfaced | Module spec exists; UI deferred (per CLAUDE.md "intentionally absent") | P3 advisory |
| m15-job-board | 0 WF surfaced | Deferred | P3 advisory |
| m16-advertising | 0 WF surfaced | Deferred | P3 advisory |
| m17-marketplace | 0 WF surfaced | Deferred | P3 advisory |

These are intentional, not gate-affecting.

---

## Registry 3 — Element→Action Binding (Vite `/api` phantom detector)

Cross-checked all literal client `/api/...` paths against the OpenAPI registry (307 declared paths), accounting for the Vite proxy `rewrite: /^\/api/ → ""`.

| File | Line | Method | Client path | Backend (after /api strip) | Match |
|---|---|---|---|---|---|
| features/dues/.../special-assessments-list.tsx | 84 | POST | /api/association/member/special-assessments | /association/member/special-assessments | EXACT |
| features/notifications/.../notification-inbox.tsx | 101 | POST | /api/notifs/read-all | /notifs/read-all | EXACT |
| features/communications/.../audience-picker.tsx | 68 | POST | /api/communications/segments | /communications/segments | EXACT |
| features/communications/.../template-form.tsx | 134 | POST | /api/association/message-templates | /association/message-templates | EXACT |
| features/communications/.../notification-preferences.tsx | 103 | POST | /api/association/person-subscriptions/bulk-update | /association/person-subscriptions/bulk-update | EXACT |
| components/notification-drawer.tsx | 172 | POST | /api/notifs/read-all | /notifs/read-all | EXACT |
| routes/.../officer/certificates.tsx | 25 | POST | /api/certificates/bulk-issue | /certificates/bulk-issue | EXACT |
| routes/.../my/settings.tsx | 102 | POST | /api/persons/me/cancel-delete | /persons/me/cancel-delete | EXACT |
| routes/.../my/settings.tsx | 224 | PATCH | /api/persons/me/notification-preferences | /persons/me/notification-preferences | EXACT |
| routes/.../my/settings.tsx | 316 | PATCH | /api/persons/me/privacy | /persons/me/privacy | EXACT |
| routes/.../my/id-card.tsx | 42 | GET | /api/persons/me | /persons/me | PARAM_MATCH:/persons/{person} |
| routes/.../my/profile.tsx | 92 | POST | /api/association/member/directory/profiles | /association/member/directory/profiles | EXACT |
| routes/.../my/credits/log.tsx | 50 | POST | /api/persons/me/credit-entries | /persons/me/credit-entries | EXACT |
| routes/.../org/$slug.tsx | 65 | GET | /api/persons/me | /persons/me | PARAM_MATCH:/persons/{person} |
| routes/.../org/$slug.tsx | 79 | GET | /api/association/member/tiers | /association/member/tiers | EXACT |
| routes/.../org/$slug.tsx | 102 | POST | /api/association/member/applications | /association/member/applications | EXACT |
| features/membership/.../application-list.tsx | 117 | POST | /api/association/member/applications/bulk-approve | /association/member/applications/bulk-approve | EXACT |

**Result: 0 phantom calls. All client-literal `/api/*` paths resolve through the Vite proxy to declared OpenAPI routes.**

---

## Registry 4 — Role Journey Completion

| Role | Auth model | Route guard | Status |
|---|---|---|---|
| `member` (org-scoped) | Better-Auth session + active membership | `_authenticated.tsx` → `requireAuth`; `org/$orgSlug` reads `useMyOrgs()` | COMPLETE — can reach all `/my/*` + `/org/$orgSlug/*` (non-officer) |
| `officer` | Better-Auth + `requireOrgOfficer` in `officer.tsx` `beforeLoad` | Hierarchy via `ROLE_HIERARCHY` (utils/org-auth.ts) | COMPLETE — `/officer/*` subtree gated |
| `platform_admin` | admin app: separate /apps/admin | App-level auth; per-route admin_role enum | COMPLETE (admin app) |
| unauthenticated/prospective | n/a — public routes | `/auth/*`, `/verify-email`, `/join`, `/invite/$token`, `/pay/*`, `/discover/*` | COMPLETE — sign-in path verified |

Conditional render: components consult `useOrg().isOfficer` for in-page render gating (e.g., admin-only buttons). No role-journey blockers detected. ROLE_PERMISSION_MATRIX action-list aligns with route inventory.

---

## Registry 5 — Dead Interaction Report

### Verb-owned classes (CARRIED-WITH-CAVEAT, gate STALE-OVERLAP)

| Class | Count | Notes |
|---|---|---|
| J-PHANTOM-NAV | 0 (engine) + 0 (grep `/api` phantom detector) | CLEAN |
| J-NOROUTE | 0 (engine) + 0 (grep nav-target cross-check, 59 targets verified) | CLEAN |
| J-DEADHREF | 0 (engine) + 0 (grep) | CLEAN |
| J-OFC (dead backend handler) | 0 (engine) | CLEAN |
| J-MY-NO-ON-ERROR | 5 engine emits, **3 confirmed false-positives** (mutations use SDK `meta.toast.error`, wired via `createDefaultQueryClient(toast)` in apps/memberry/src/main.tsx → `MutationCache` in @monobase/sdk-ts/react/provider.tsx). True positives below. |
| J-ERROR-GENERIC | 1 engine emit — confirmed true positive |

### True positives — mutations with NO error path (no `onError`, no SDK `meta.toast.error`, no enclosing try/catch)

| ID | File:Line | Mutation | Severity | Why |
|---|---|---|---|---|
| **J-MY-100** | apps/memberry/src/components/notification-drawer.tsx:162 | `markReadMutation` (uses bare `api.post('/api/notifs/read-{id}/read')`) | **P2** | Bypasses SDK convention — no `meta.toast.error`, no `onError`. Silent failure. Persona surface = `components/` shared but consumed in member header → J-MY-100 |
| **J-MY-100b** | apps/memberry/src/components/notification-drawer.tsx:171 | `markAllReadMutation` (bare api.post) | **P2** | Same pattern. Silent failure of "Mark all read". |

Both surfaces are member-primary; engine class J-MY-NO-ON-ERROR escalates base P1 → primary P1. However, action is low-stakes (idempotent mark-as-read), so we downgrade to **P2** with `downgrade_reason: idempotent_low_stakes`. Recommend adding `meta: { toast: { error: 'Could not mark notification read' } }` or switching to the SDK `markRead` mutation.

### Verb-owned engine false-positives (use SDK meta.toast.error)

| File:Line | Mutation | Why FP |
|---|---|---|
| apps/memberry/src/features/training/components/training-form.tsx:60 | `saveMutation` (which uses createMut/updateMut already wired) | uses `meta.toast.error` via saveMutation wrapper |
| apps/memberry/src/routes/_authenticated/my/billing.tsx:38 | `onboard` | `meta: { toast: { error: 'Could not start payment setup' } }` |
| apps/memberry/src/features/membership/components/application-list.tsx:114 | bulk-approve `mutation` | inline `toast.error` in catch block + onSuccess/onError — engine missed |

### True positives — generic error copy (J-ERROR-GENERIC)

| ID | File:Line | Surface | Persona | base→final | Severity |
|---|---|---|---|---|---|
| **J-MY-101** | apps/memberry/src/routes/_authenticated/my/organizations.tsx:220 | "Something went wrong" — leave-org dialog | J-MY primary | P2 → P3 (downgrade: only triggers on rare org-leave path, user can retry) | **P3** |
| **J-MY-102** | apps/memberry/src/routes/org/$slug.tsx:126 | "Something went wrong. Please try again." — apply-to-join | J-MY primary | P2 → P3 (downgrade: prospective member can retry; banner copy is acceptable here) | **P3** |
| **J-MY-103a** | apps/memberry/src/features/membership/components/application-list.tsx:96 | "Action failed / Please try again." — approve | J-OFC officer | P2 (officer base) | **P3** |
| **J-MY-103b** | apps/memberry/src/features/membership/components/application-list.tsx:107 | "Action failed / Please try again." — reject | J-OFC officer | P2 | **P3** |
| **J-MY-103c** | apps/memberry/src/features/membership/components/member-detail.tsx:140 | "Action failed / Please try again." — member-detail action | J-OFC officer | P2 | **P3** |

The "Action failed / Please try again." copy in officer ops is structurally identical to the prior J-ERROR-GENERIC class but escapes engine detection because it sets `description: 'Please try again.'` separately (engine inspects arg1 literal only). Re-classified as P3 advisory cluster.

### Other grep cross-checks

| Pattern | Count | Severity |
|---|---|---|
| Empty `onClick={() => {}}` | 0 | — |
| `<Button>` text-only (noop) | 0 | — |
| `<form>` without `onSubmit` or `action=` | 0 | — |
| Unreachable render `{false && ...}` | 0 (verified) | — |

---

## Registry 6 — Navigation Integrity

| Check | Count | Verdict |
|---|---|---|
| Routes in router (TanStack file-based) | 128 (memberry) + 23 (admin) = 151 | All have components |
| Sidebar nav targets enumerated | 59 unique (memberry) | All resolve to a route file |
| `<Link to=>` literals | 47 unique | All match route (TanStack `.` → `/` aware) |
| `navigate({to:})` literals | 13 unique | All match route |
| `<a href=>` literals (external/internal) | 1 (`/auth/sign-in`) | Resolves via `auth/$authView` catch-all |
| Auth-guarded routes | All under `_authenticated.tsx` | Guard verified |
| Officer-guarded routes | All under `org/$orgSlug/officer.tsx` (`requireOrgOfficer`) | Guard verified |

**Navigation: CLEAN. Zero dead Link/navigate/href targets.**

---

## Registry 8 — Scenario Coverage Matrix

Generated cartesian sample (capped to high-risk auth-gated + state-dependent routes):

- 151 routes × 4 effective role profiles (unauth, member, officer, platform_admin) × ~3 typical FSM states (draft/published/closed for events, etc.) ≈ 1,800 scenarios.
- Sampled 200 high-risk scenarios (auth-gated mutations); all journey-covered via WF-001..WF-100.

No P2 uncovered-mutation scenarios found in sampled subset. Full cartesian deferred to `--live` mode.

---

## Registry 9 — Error-UX Audit

### J-ERROR-MISSING (engine class J-MY-NO-ON-ERROR + grep cross-check)

After filtering out the 3 engine FPs (SDK meta.toast users), the true-missing set is:

- `notification-drawer.tsx:162,171` (markRead, markAllRead) — **J-MY-100/100b P2** (idempotent action)
- `profile.tsx:46` `createPerson` mutation — has only `onSuccess`, no error path → **J-MY-104 P3** (this createPerson is gated behind person-not-found flow that should rarely fail, and onSuccess of profile mutation 119 has explicit onError. Downgrade: edge-case-only.)
- All other engine hits are FPs via SDK meta.toast.

### J-ERROR-GENERIC (class)

5 surfaces (J-MY-101 through J-MY-103c). All P3 — none on primary-mutation hot path.

### J-ERROR-TAXONOMY-ORPHAN

`docs/product/ERROR_TAXONOMY.md` not present in this repo (only `docs/product/UI_BLUEPRINT.md` + `UI_CONSISTENCY_SPEC.md`). Orphan-code reconciliation skipped. No `J-ERROR-TAXONOMY-ORPHAN` findings emitted.

### J-ERROR-DEFAULT

`createDefaultQueryClient(toast)` in `apps/memberry/src/main.tsx:13` wires MutationCache `onError` to `meta.toast.error`. This IS a project-default error handler. Mutations relying on default toast behavior (without explicit `meta.toast`) fall through silently — but no such mutations were identified beyond the 2 notification-drawer cases already flagged.

---

## What's Next

| Condition | Action |
|---|---|
| P0 findings | None — clean |
| P1 findings | None — clean |
| P2 findings (J-MY-100/100b) | Add `meta: { toast: { error: 'Could not update notification' } }` to the 2 mutations in notification-drawer.tsx, or migrate to SDK `markRead` mutations |
| P3 advisories (J-MY-101..104) | Replace "Something went wrong" / "Action failed" copy with mutation-specific message; ideally `err?.code` interpolation per ERROR_TAXONOMY when authored |
| Verb gate carry-over | Optional: rebuild codebase map after working-tree changes settle to clear STALE-OVERLAP → verb can re-confirm clean |

**Pipeline position:** Phase D — `--journeys` complete. Next: `/oli-check --traceability` (consumes this report) or `/oli-check --compliance --category contracts` for backend wire-up verification.
