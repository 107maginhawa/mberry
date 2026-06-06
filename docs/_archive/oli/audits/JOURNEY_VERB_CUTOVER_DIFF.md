# Journey Verb-Cutover Diff (M5)

**What:** diff of the engine `interactions` verb output (now the authoritative source for the 6 verb-owned journey classes) against the prior AI-synthesized `UI_JOURNEY_AUDIT.md` (2026-05-31). Asserts **no regression on findings the prior audit cleared**.

**Verb run:** `oli query interactions --json --from docs/audits/codebase-map --root .`
**Verb state:** `ok:true`, `map_freshness: FRESH`, `count: 25` — `J-PHANTOM-NAV 5`, `J-MY-NO-ON-ERROR 19`, `J-ERROR-GENERIC 1`, `J-NOROUTE 0`, `J-DEADHREF 0`, `J-OFC 0`.
**Persona mapping:** Step 0d (engine class+file → curated persona ID + escalated severity).

---

## Cleared-finding regression check

| Prior audit assertion (cleared/clean) | Verb signal now | Verdict |
|---|---|---|
| **Navigation Integrity = 0** (no MISSING_ROUTE) | `J-NOROUTE 0` + `J-DEADHREF 0` | ✅ NO REGRESSION — holds **only because of E1**. Pre-E1 the verb false-fired 53 `J-DEADHREF` (layout/index/param route-key mismatch); the E1 normalization is what makes the cutover safe. |
| **Dead Interaction = 0** (no noop/orphan/empty handler) | `J-OFC 0`, no `interaction_hygiene` violations | ✅ NO REGRESSION |
| **J-ERROR-001 RESOLVED** — 6 member screens given error branches (id-card, my/training, my-cpd, announcements/$id, governance/index, org training/index) | none of those 6 files appear in the verb's 19 `J-MY-NO-ON-ERROR` | ✅ NO REGRESSION — the cleared screens are not re-flagged. (Orthogonal signal: J-ERROR-001 was `loading_state_hygiene` query-error-branch; verb `J-MY-NO-ON-ERROR` is mutation-`onError` — the fixed screens were query-side fixes.) |
| **J-ORPHAN-001 (P1)** orphan modules M13/M15/M16/M17 zero UI routes | not verb-owned (Registry 2, AI/WORKFLOW_MAP) — unaffected | ✅ NO REGRESSION — persists as before |
| **P0 = 0** ("188 API calls all resolve") | `J-PHANTOM-NAV 5` | ⚠️ **CORRECTION, not regression** — see below |

---

## P0 correction (improvement — AI audit false-cleared dead API calls)

The prior AI audit asserted "188 calls all resolve / 0 dead API." The verb finds **5 `J-PHANTOM-NAV`**. Per `PHANTOM_NAV_TRIAGE.md` + Step 0d persona mapping:

| Engine finding | File | Persona (0d) | final P | Disposition |
|---|---|---|---|---|
| AssociationDetailPage | `apps/admin/.../associations/$associationId.tsx` | J-SYS (admin app — out of memberry scope) | P0 | **FALSE POSITIVE** — engine `/api`-join artifact; `/admin/national-dashboard/:id` exists, works via Vite proxy strip |
| OrganizationDetailPage | `apps/admin/.../organizations/$organizationId.tsx` | J-SYS (admin) | P0 | **FALSE POSITIVE** — `/admin/organizations/:id/transition` exists |
| ApplicationList | `apps/memberry/.../membership/application-list.tsx` | J-OFC (officer) | P0 | **FALSE POSITIVE** — `/association/member/applications/bulk-approve` exists |
| ProofUploadForm | `apps/memberry/.../dues/proof-upload-form.tsx` | **J-MY (member)** | **P0** | **REAL BUG** — wrong path `POST /api/storage/files`; should be `/storage/files/upload` |
| PostEventActions | `apps/memberry/.../events/post-event-actions.tsx` | J-MY/J-OFC | **P0** | **REAL BUG** — `credits/void-event` route does not exist in backend |

- **2 genuine P0 dead calls** the AI audit missed → net detection **improvement**, not a regression on a cleared finding.
- **3 false positives** are the engine's known `/api`-prefix raw-fetch join limitation (E2 follow-up: strip configurable `/api` proxy prefix). 2 of the 3 are in `apps/admin` (out of memberry journey scope); none is a previously-cleared memberry finding.

---

## Net

- **0 regressions** on any finding the prior audit cleared (navigation, dead-interaction, resolved error screens, orphan modules all preserved).
- **+2 true P0** dead API calls surfaced (ProofUploadForm wrong path, PostEventActions missing route) — fixes already recommended in `PHANTOM_NAV_TRIAGE.md`, not yet applied.
- **3 engine false positives** (accepted, E2 backlog) — dispositioned by triage + persona mapping, not gate-blocking after disposition.
- **19 `J-MY-NO-ON-ERROR` + 1 `J-ERROR-GENERIC`** are a mutation-side lens the prior Registry 9 (`loading_state_hygiene`, query-side) did not isolate — additive coverage, no conflict.

**Assertion: the verb cutover introduces no regression on cleared findings.** The only behavior change is strictly-more-correct P0 detection, gated safe by E1 (without E1, the 53 false `J-DEADHREF` would have been a catastrophic false regression).
