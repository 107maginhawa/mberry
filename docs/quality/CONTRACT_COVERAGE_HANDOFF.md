# Contract Coverage Handoff — Wave 4

Baseline: **32%** (144/454 endpoints covered by 99 Hurl files)
Target:   **60%** (≥272/454 endpoints)
Gap:      **128 endpoints** (~87 new scenarios needed)

This wave delivered:
- `scripts/contract-coverage-gap.ts` — gap analyzer (re-runnable)
- `docs/quality/CONTRACT_COVERAGE.json` — machine-readable baseline
- `specs/api/tests/contract/surveys-flow.hurl` — Surveys module (10 scenarios, 10 operationIds)

Estimated coverage after this wave: **~34%** (surveys adds ~10 covered endpoints).

---

## Remaining work by tag

Each tag below needs Hurl scenarios from scratch (0% or near-0% coverage).
Effort estimate: ~5 scenarios per half-day, ~1 .hurl file per module.

### Priority 1 — Complete within Wave 4 continuation (days 2-4)

| Tag | Uncovered | File to create | Key operationIds |
|---|---|---|---|
| Documents | 15 | `documents-flow.hurl` | listDocuments, getDocument, uploadDocument, deleteDocument, getDocumentAccessLog |
| Marketplace | 9 | `marketplace-flow.hurl` | listVendors, createVendor, getVendor, updateVendor, listOffers, createOffer |
| Advertising | 7 | `advertising-flow.hurl` | listPlacements, createPlacement, getPlacement, updatePlacement, deletePlacement |
| Jobs | 7 | `jobs-flow.hurl` | listJobs, getJob, triggerJob, getJobHistory |
| Dues (remainder) | 6 | `dues-extended-flow.hurl` | getDuesConfig, updateDuesConfig, listDuesFunds, createDuesFund |

### Priority 2 — Wave 4 continuation days 5-6

| Tag | Uncovered | File to create | Notes |
|---|---|---|---|
| Communication | 22 | `communications-gaps-flow.hurl` | Already has 2 files; patch remaining 22 operationIds |
| Association:Operations | 46 | `assoc-operations-gaps-flow.hurl` | Large — split into 2-3 files if needed |
| Surveys (remainder) | 6 | Add to `surveys-flow.hurl` | listSurveyResponses, exportSurveyResponses, deleteMemberResponses, dismissSurveyResponse, getNpsTrends, listAdminSurveys |

### Priority 3 — Wave 4 tail / Wave 7 gate (days 7-8)

| Tag | Uncovered | Notes |
|---|---|---|
| Association:Member | 152 | Mega-module — coordinate with Wave 5.5 split plan. Focus on the 17 endpoints already covered (10%); add 30 more in targeted sub-flows |
| Billing (gaps) | verify | Run gap script after fixes to re-assess |

---

## Per-wave breakdown for follow-on execution

### Wave 4a (2 days) — Zero-coverage small modules
- Documents, Marketplace, Advertising, Jobs, Dues gaps
- Target: +37 endpoints covered → ~40% total

### Wave 4b (2 days) — Communication + Association:Operations gaps
- Communication remaining 22, AssocOps top-20 critical
- Target: +42 endpoints covered → ~49% total

### Wave 4c (2 days) — Surveys remainder + AssocMember targeted
- Surveys 6 remaining, AssocMember 30 priority endpoints
- Target: +36 endpoints covered → ~57% total

### Wave 4d (1 day) — Buffer + re-run gap script + fix false negatives
- Re-run `bun run scripts/contract-coverage-gap.ts`
- Patch template-matching edge cases
- Target: ≥60% gate satisfied

---

## Acceptance criteria (Wave 7 gate)

```
bun run scripts/contract-coverage-gap.ts
# coveragePercent must be >= 60
```

CI gate wired in Wave 7 (`scripts/gates/contract-coverage-gate.sh`).

---

## Notes for next agent

1. Always read the handler implementation before writing a scenario — don't invent body shapes.
2. Mark `# UNVERIFIED` at top if the API server wasn't running during scaffold.
3. Use `x-org-id: ed8e3a96-8126-4341-be42-e6eb7940c562` for seeded org context.
4. Officer auth: `test@memberry.ph` / `TestPass123!`
5. After adding scenarios, re-run gap script to confirm coverage delta.
6. Association:Member 152-endpoint gap is the hardest — coordinate with P1-11 split plan before attempting bulk scaffold.
