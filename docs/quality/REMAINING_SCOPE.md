# Mega-Module Decomposition — Remaining Scope

**Date:** 2026-06-07
**Branch baseline:** `feature/member-rebuild` @ `d3aa681b` (post-R5-officers-skip)
**Replaces:** R5/R6/R7 sequential numbering. Going forward, work is labeled by **domain**, not by step index.

---

## §0 — Why this doc exists

The R-series (chapters → governance → credentials → directory) cut over four sub-domains via tsp-tag retag. Two subsequent steps (elections, officers) turned out to be **already absorbed by R2** because R2's tag (`Member/Governance`) caught more interfaces than the original 9-sub-domain plan anticipated. Re-baselining now produces ground truth for the rest of the migration.

**Origin of staleness:** the original plan was sized for 157 mega-module files; current count is 193 (per resume prompt). 23 % growth during the R-series itself. The plan was last calibrated *before* R1 ran.

**Scope of this doc:** every `@tag("Association:Member")` interface still in `specs/api/src/main.tsp`, mapped to the destination tag, the candidate sub-domain directory, the handler files involved, the hand-wired routes the sub-domain touches, and a SKIP/PARTIAL/FULL classification with execution-order recommendation.

---

## §1 — Tag inventory (ground truth)

`specs/api/src/main.tsp` tag distribution as of `d3aa681b`:

| Tag | Count | Status |
| --- | --- | --- |
| `Association:Member` | **28** | unmigrated — this doc's subject |
| `Member/Chapters` | 4 | ✅ R1 cut over |
| `Member/Governance` | 5 | ✅ R2 cut over (includes elections + officers) |
| `Member/Credentials` | 6 | ✅ R3 cut over |
| `Member/Directory` | 2 | ✅ R4 cut over |
| `Membership` | 1 | legacy standalone (not mega-module) |
| `Dues` | 5 | legacy standalone (not mega-module) |
| `Association:Operations` | 12 | training/events — separate decomposition |

The 28 `Association:Member` tags decompose by source namespace as follows:

### 1.A `Association.Member.Membership.*` — 8 interfaces

| Interface | Route | Lines in main.tsp |
| --- | --- | --- |
| `AssocMembershipTierManagement` | `/association/member/tiers` | 254-256 |
| `AssocMembershipManagement` | `/association/member/memberships` | 258-260 |
| `AssocMembershipApplicationManagement` | `/association/member/applications` | 262-264 |
| `AssocInstitutionalMembershipManagement` | `/association/member/institutional-memberships` | 266-268 |
| `AssocSeatAllocationManagement` | `/association/member/institutional-memberships/{...}/seats` | 270-272 |
| `AssocMemberRosterManagement` | `/association/member/roster` | 274-276 |
| `AssocMembershipCategoryManagement` | `/association/member/membership-categories` | 278-280 |
| `AssocOrganizationProfileManagement` | `/association/member/org-profile` | 282-284 |

Source namespace: single, `Association.Member.Membership`. Source file: `specs/api/src/association/member/membership.tsp`.

### 1.B `Association.Member.Credits.*` — 2 interfaces

| Interface | Route |
| --- | --- |
| `CreditComplianceManagement` | `/credit-compliance` |
| `OfficerTermsManagement` | `/officer-terms` (`listOfficerTermsSummary`) |

Source: `specs/api/src/association/member/credits.tsp`.

### 1.C `Association.Operations.Training.*` — 6 interfaces (route-mounted under member/)

| Interface | Route | Source namespace |
| --- | --- | --- |
| `AssocCpdConfigManagement` | `/association/member/cpd-config` | `Operations.Training.CpdConfigManagement` |
| `AssocManualCreditManagement` | `/association/member/credits/manual` | `Operations.Training.ManualCreditManagement` |
| `AssocCreditAdjustmentManagement` | `/association/member/credits/adjust` | `Operations.Training.CreditAdjustmentManagement` |
| `AssocEventCreditVoidManagement` | `/association/member/credits/void-event` | `Operations.Training.EventCreditVoidManagement` |
| `AssocMemberPeerCreditsManagement` | `/association/member/credits` | `Operations.Training.MemberPeerCreditsManagement` |
| `AssocComplianceManagement` | `/association/member/compliance` | `Operations.Training.ComplianceManagement` |

**Cross-namespace wrinkle:** these 6 interfaces are sourced from the `Association.Operations.Training` namespace but tagged `@tag("Association:Member")` and mounted at `/association/member/*`. The retag mechanism operates on the `@tag` in main.tsp, not the source namespace, so retagging to `Member/Credits` is mechanically clean **provided** no sibling `Operations.Training` interface (with the SAME @tag) lives elsewhere unintentionally. Spot-check confirmed: there are 12 other `Association:Operations` tags but they sit on training/events-mounted routes outside `/association/member/`, so a per-interface retag is required (not a bulk @tag find-replace).

### 1.D `Association.Member.Dues.*` — 8 interfaces

| Interface | Route |
| --- | --- |
| `AssocDuesConfigManagement` | `/association/member/dues-configs` |
| `AssocDuesInvoiceManagement` | `/association/member/dues-invoices` |
| `AssocAgingBucketService` | `/association/member/aging-buckets` |
| `AssocDunningManagement` | `/association/member/dunning` |
| `AssocDuesPaymentManagement` | `/association/member/dues-payments` |
| `AssocDuesPaymentProofManagement` | `/association/member/dues-payments` (sibling) |
| `AssocDuesGatewayManagement` | `/association/member/dues-gateway` |
| `AssocDuesReportingService` | `/association/member/dues-reporting` |

Source: `specs/api/src/association/member/dues.tsp`.

### 1.E `Association.Member.SpecialAssessments.*` — 1 interface

| Interface | Route |
| --- | --- |
| `AssocSpecialAssessmentManagement` | `/association/member/special-assessments` |

### 1.F `Association.Member.Certificates.*` — 3 interfaces

| Interface | Route |
| --- | --- |
| `AssocCertificateManagement` | `/association/member/certificates` |
| `CertificateVerificationService` | `/certificates` (public verify) |
| `CertificateBulkIssuance` | `/certificates` (bulk issue) |

Source: `specs/api/src/association/member/certificates.tsp`.

**Total: 8 + 2 + 6 + 8 + 1 + 3 = 28 ✓**

---

## §2 — Handler inventory (118 .ts files in `handlers/association:member/`)

Counted via `ls handlers/association:member/ | grep -v test | grep -v repos | grep -v jobs | grep -v utils | grep -v test-fixtures | wc -l`.

Bucketed (approximate; cross-domain handlers like `getOrgDashboard.ts` counted once under their dominant domain):

| Bucket | Approx handlers | Notes |
| --- | --- | --- |
| Membership | ~32 | lifecycle (create/update/delete/decease/reinstate/renew/resign/terminate), applications (approve/deny/bulk), tiers, categories, institutional + seats, roster (add/get/list/import/update), org-profile, disciplinary, subscription (3 hand-wired) |
| Dues | ~38 | configs, invoices, payments (4), proofs, dunning (templates + runs + events), gateway (test/disconnect), reporting (funds), aging buckets, special-assessments, payment-link/webhook, refunds, downloadReceipt (hand-wired) |
| Credits | ~22 | createCreditEntry, adjustCreditEntry, voidCreditEntry (hand-wired), awardManualCredit, recalculate*, refreshCompliance, getCreditTranscript (× 2 hand-wired), getCreditCompliance, getCpdConfig + updateCpdConfig, getOrgCpdConfig + updateOrgCpdConfig, listMemberCreditsForPeer, listOfficerTermsSummary (credits/officer-terms interface), listPendingProofs |
| Certificates | ~5 | getCertificate, listMyCertificates, bulkIssueCertificates, verifyCertificatePublic + hand-wired PDF (Wave-2b) |
| Cross-cutting / hand-wired holdouts | ~5 | transitionOfficerTerm, getOrgDashboard, voidCreditEntry, the 3 subscription handlers — already documented as deferred |
| Org-profile / misc | ~3 | getOrganizationProfile, updateOrganizationProfile, etc. — fold into Membership |

**Rough total: 32 + 38 + 22 + 5 + 5 + 3 ≈ 105.** Remaining ~13 are services/, jobs/, utility files that don't migrate as handler files. Matches `118` total minus non-handler files.

---

## §3 — Hand-wired holdout register (31 `@hand-wired` markers in app.ts)

Holdouts that intersect member-domain decomposition:

| Holdout | Wave | Disposition |
| --- | --- | --- |
| `transitionOfficerTerm` (`POST .../officers/:termId/transition`) | M4-R3 | stays in `association:member/` — checklist not in TypeSpec |
| `getOrgDashboard` (`GET .../dashboard`) | M4-DASHBOARD | stays — dashboard aggregator |
| `voidCreditEntry` (`POST .../credits/void-event` body) | S-G1-07 | candidate for fold into credits retag (sibling tsp interface exists `AssocEventCreditVoidManagement`) — re-evaluate during credits work |
| `downloadReceipt` (`GET /org/.../payments/:paymentId/receipt`) | Cycle-8 | stays — PDF byte download |
| `getMyIdCard` (`GET /persons/me/id-card/:orgId` + `/pdf`) | Wave-2b | stays — by-design hand-wired |
| `generateCertificatePdf` (`GET /certificates/:id/pdf`) | Wave-2b | stays — PDF byte download |
| `getCreditTranscript` + `Pdf` (`GET /persons/me/credit-transcript[+/pdf]`) | Wave-22 | stays — cross-org export inline schema |
| `requestDataExport` + `getDataExportStatus` + `Download` | Wave-24 | stays — async DPA flow |
| `createSubscriptionCheckout`, `upgradeSubscription`, `getMySubscription` | UJ-M03 | stays — billing handshake |
| `exportNationalDashboard` | Cycle-8 | stays — admin CSV |
| Admin pricing tier CRUD (4 routes) | UJ-M03 | stays — admin-only |
| `validatePaymentLink`, `handlePaymentWebhook` | by-design | stays — pre-auth public |

None of these will be touched by the remaining decomposition phase. Document their hand-wired status and skip.

---

## §4 — Sub-domain classification (FULL / PARTIAL / SKIP)

| Sub-domain | Interfaces | Source tsp file | Handlers est. | Hand-wired holdouts | Classification | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| **Membership** | 8 | `membership.tsp` | ~32 | 0 (org-profile + roster all in tsp) | **FULL** | high |
| **Credits** | 2 (Member.Credits) + 6 (Operations.Training) = 8 | `credits.tsp` + `operations/training.tsp` ref | ~22 | 1 (`voidCreditEntry` fold-in option) | **FULL** (cross-namespace nuance) | medium |
| **Dues** | 8 | `dues.tsp` | ~38 | 1 (`downloadReceipt` — stays) | **FULL** | high |
| **Special Assessments** | 1 | shares `dues.tsp` namespace SpecialAssessments | ~6 | 0 | **PARTIAL/MERGE-INTO-DUES** | high |
| **Certificates** | 3 | `certificates.tsp` | ~5 | 2 PDF (stay) | **FULL** | high |

Net active decomposition work: **4 sub-domains** (membership, credits, dues+specialassessments fused, certificates) — not 3 as the original "credits/dues/membership" plan stated.

---

## §5 — Recommended execution order

Independence-first ordering (least cross-coupled → most cross-coupled):

1. **Certificates** — 3 interfaces, ~5 handlers, smallest surface, isolated domain. Good warmup after two SKIPs. Tests are mostly self-contained.
2. **Credits** — cross-namespace wrinkle worth handling early while the pattern is fresh. Bundle `voidCreditEntry` fold-in decision. ~22 handlers + 8 interfaces.
3. **Dues + Special Assessments (fused)** — same `dues.tsp` source file structure, 9 interfaces, ~44 handlers. Biggest single migration. Dunning + payments + gateway + reporting + special-assessments all in one cut.
4. **Membership** — last because it touches everything else (officer-term references roster, dues references memberships, credits references compliance). Full migration but with maximum cross-module ripple risk. Best done with all upstream sub-domains already settled.

Each step preserves the proven R-series pattern:
1. Scope-doc per sub-domain (small — main inventory done here)
2. Retag interfaces in main.tsp → `@tag("Member/<Sub>")`
3. tsp build → routes.ts regen → wipe → restore originals → fix imports
4. Hurl scenarios (≥ 5 per sub-domain)
5. Per-sub-domain MODULE_SPEC
6. Gates ≥ R4 floor → tag `member-<sub>-cutover`

---

## §6 — Quantitative summary

| Metric | Pre-R0 | After R1-R4 | After current SKIPs | Remaining work | After all-cutover |
| --- | --- | --- | --- | --- | --- |
| `Association:Member`-tagged interfaces in main.tsp | 47 | 28 | 28 | 28 → 0 | 0 |
| Sub-tag namespaces under `Member/*` | 0 | 4 | 4 | + 4 | 8 |
| Handler files in `handlers/association:member/` (excl. tests/repos/jobs) | ~193 | 118 | 118 | 118 → ~13 | ~13 (hand-wired holdouts only) |
| `member-*-cutover` tags | 0 | 4 | 4 + 2 SKIP | + 4 | 8 cutover + 2 SKIP |

End-state: `association:member/` contains only repos, jobs, services, and ~13 hand-wired handler holdouts. Future mega-module-split (`.planning/deferred/14-mega-module-split/`) can then address the repos.

---

## §7 — Renaming convention going forward

**Drop "R5/R6/R7"** numbering. Use domain labels:

- `member-certificates-cutover` (next)
- `member-credits-cutover`
- `member-dues-cutover` (includes special-assessments)
- `member-membership-cutover` (final)

Scope docs:
- `docs/quality/SCOPE.certificates.md`
- `docs/quality/SCOPE.credits.md`
- `docs/quality/SCOPE.dues.md`
- `docs/quality/SCOPE.membership.md`

(`R5_ELECTIONS_SCOPE.md`, `R5_OFFICERS_SCOPE.md`, and the prior `R1..R4_*_SCOPE.md` docs stay as historical artifacts. New scope docs use the domain-label convention.)

---

## §8 — Gates posture (unchanged)

R4 floor remains for every cutover:

| Gate | Floor |
| --- | --- |
| typecheck | 5/5 |
| unit | ≥ 6027 pass (1 pre-existing fail accepted) |
| contract | ≥ 130 / 132 (2 pre-existing email flake accepted at baseline) |
| SDK drift | 0 / 454 |
| observability | ≥ 94 % |
| contract coverage | ≥ 81 % |

---

## §9 — Decision required

**Confirm execution order:**

Certificates → Credits → Dues+SpecialAssessments → Membership.

Each step starts with a brief domain-scope doc (smaller than this one — most of the inventory is already here), then proceeds through the R-pattern.

**Open questions to surface before Certificates cutover:**
1. The two `/certificates`-prefixed interfaces (`CertificateVerificationService`, `CertificateBulkIssuance`) share the same route prefix with handler dir `services/api-ts/src/handlers/certificates/` (per CLAUDE.md §"Content"). Does that dir absorb the migration, or do we create `handlers/member/certificates/`? Convention so far has been `handlers/member/<sub>/`, but the certificates dir already exists. Decide before retag.
2. PDF byte-download handlers (`generateCertificatePdf`, `getMyIdCardPdf`) are hand-wired by design — they reference cert state owned by `association:member/`. Keep import path stable post-cutover (re-export shim, or absolute import path to new location).

Awaiting user checkpoint.
