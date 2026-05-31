# Spec Review — Proposed Patches (Suggest-Only)

<!-- oli:artifact spec-review-patches v1.0 generated:2026-05-31 by:/oli-check (oli-spec-gate Stage 2 --auto) -->

---
generated_by: oli-spec-gate Stage 2 (Pass 2)
report_date: 2026-05-31
companion: docs/product/SPEC_REVIEW.md
authority: suggest-only — NEVER auto-applied. Human must apply patches manually, bump artifact version, then re-run `/oli-spec-gate`.
---

> **Important:** This file is a holding area for proposed diffs the gate would write IF it had write authority over specs. It does NOT have that authority — per the skill's locked ownership-boundary decision, source specs are human-owned. The gate emits proposals only. The human applies (or rejects) each one explicitly.

---

## Group 1 — Stub API_CONTRACTS Backfill (13 modules — D2-1..D2-13)

### Pattern

13 modules have a stub `API_CONTRACTS.md` file (file exists, no endpoint definitions). MODULE_SPEC §10 lists 7–14 endpoints per module. Backfill API_CONTRACTS from MODULE_SPEC §10 using the template:

```markdown
# {Module Name} — API Contracts

<!-- oli:api-contracts v1.0 generated:{DATE} source:MODULE_SPEC.md §10, ROLE_PERMISSION_MATRIX.md §3.{N} -->

## Conventions
See `docs/product/API_CONVENTIONS.md` for response envelopes, pagination, error shape.

## Endpoints

### {METHOD} {path}
- **WF-ID:** WF-NNN
- **Auth:** {role(s)} via `hasMinimumRole()` / `committee_member.role`
- **Request:** `{ ... }` (links to MODULE_SPEC §7 entity)
- **Response (200):** `{ data: ... }` per API_CONVENTIONS §1
- **Errors:** {MODULE-NNN, MODULE-NNN} per ERROR_TAXONOMY §5.{N}
```

### Affected Modules

| Module | Endpoints to Backfill (per MODULE_SPEC §10) |
|--------|--------------------------------------------:|
| m05-membership | 9 |
| m06-dues-payments | 11 |
| m07-communications | 9 |
| m08-events | 10 |
| m09-training | 11 |
| m12-elections-governance | 9 |
| m13-professional-feed | 7 |
| m14-national-dashboard | 6 |
| m15-job-board | 10 |
| m16-advertising | 14 |
| m17-marketplace | 7 |
| m18-surveys-polls | 9 |
| m19-committee-management | 12 |
| **Total** | **124 endpoints to write** |

### Suggested Disposition
- Human: confirm whether to backfill via `/oli-spec-api --module <mNN>` (idempotent, idempotent, idempotent), OR mark as future work
- After backfill: bump each MODULE_SPEC's `oli-version` and re-run `/oli-spec-gate`

---

## Group 2 — m13 Professional Feed RPM + DOMAIN_MODEL Backfill (C-31p2-3, C-31p2-5)

### Patch P-2.1 — Add `feed_post` entity to DOMAIN_MODEL

**File:** `docs/product/DOMAIN_MODEL.md`
**Section:** §13 (Communications) or §14 (new "Social/Feed" section)
**Before:** (no `feed_post` table defined)
**After:**

```diff
+ ### feed_post
+ | Column | Type | Constraint | Notes |
+ |--------|------|-----------|-------|
+ | id | uuid | PK | |
+ | organization_id | uuid | FK organizations.id, NOT NULL | tenancy |
+ | author_id | uuid | FK persons.id, NOT NULL | |
+ | post_type | text | NOT NULL, enum(announcement, clinicalUpdate, eventHighlight, ...) | per m13 spec §7 |
+ | body_text | text | NOT NULL | |
+ | visibility | text | NOT NULL, enum(public, org, role) | |
+ | status | text | NOT NULL, enum(draft, published, archived, removed) | |
+ | is_pinned | boolean | NOT NULL DEFAULT false | |
+ | is_sponsored | boolean | NOT NULL DEFAULT false | |
+ | is_removed | boolean | NOT NULL DEFAULT false | |
+ | report_count | integer | NOT NULL DEFAULT 0 | |
+ | created_at | timestamptz | NOT NULL | |
+
+ ### feed_post_reactions
+ | Column | Type | Constraint |
+ |--------|------|-----------|
+ | post_id | uuid | FK feed_post.id, ON DELETE CASCADE |
+ | member_id | uuid | FK persons.id |
+ | reaction_type | text | NOT NULL |
+
+ ### feed_post_reports
+ (per existing seed code in services/api-ts/src/seed/layer-7-comms.ts)
```

**Resolution status:** PROPOSED — needs Engineering sign-off

### Patch P-2.2 — Add RPM §3.x for Professional Feed (m13)

**File:** `docs/product/ROLE_PERMISSION_MATRIX.md`
**Before:** (no §3.x for Professional Feed; H-8 only updated Create-post row)
**After:**

```diff
+ ### 3.x Professional Feed (m13)
+
+ | Action | super | admin | platform_admin | president | secretary | treasurer | vp | officer | member | support |
+ |--------|:----:|:----:|:--------------:|:--------:|:--------:|:--------:|:-:|:------:|:------:|:------:|
+ | Read feed (own org) | R | R | R | R | R | R | R | R | R | R |
+ | Create post | W | W | — | W | W | — | — | — | — | — |
+ | Pin post | W | W | — | W | — | — | — | — | — | — |
+ | React to post | W | W | W | W | W | W | W | W | W | W |
+ | Report post | W | W | W | W | W | W | W | W | W | W |
+ | Remove post | W | W | — | W | W | — | — | — | — | — |
+ | Sponsor post | W | W | — | W | — | — | — | — | — | — |
+
+ See m13 MODULE_SPEC §6 (Permissions).
```

**Resolution status:** PROPOSED — Security + Product sign-off needed

---

## Group 3 — m14 National Dashboard RPM Backfill (C-31p2-4)

### Patch P-3.1 — Add RPM §3.x for National Dashboard (m14)

**File:** `docs/product/ROLE_PERMISSION_MATRIX.md`
**Before:** (no §3.x for National Dashboard)
**After:**

```diff
+ ### 3.x National Dashboard (m14)
+
+ | Action | super | admin | platform_admin | analyst | president |
+ |--------|:----:|:----:|:--------------:|:------:|:--------:|
+ | View aggregate stats | R | R | R | R | — |
+ | View per-org rollup | R | R | R | R | R (own org only) |
+ | Export data | W | W | W | W | — |
+
+ Cross-reference: m14 MODULE_SPEC §6.
```

**Resolution status:** PROPOSED — Security + Product sign-off needed

---

## Group 4 — m18 Surveys/Polls DPA n≥k Threshold (C-31p2-6)

### Patch P-4.1 — Privacy/regulatory minimum-n threshold for anonymous polls

**File:** `docs/product/modules/m18-surveys-polls/MODULE_SPEC.md`
**Line:** 262
**Before:**
```
- Anonymous survey with 1 respondent: results still shown (no minimum threshold). [VERIFY -- privacy concern with n=1]
```
**After:**
```
- Anonymous survey results require a minimum of 5 respondents before any aggregate is published (BR-NN). Below threshold: display "Awaiting more responses" with the count blurred. Rationale: DPA 2012 — n=1 disclosure is functionally non-anonymous; n<5 risks re-identification by elimination.
```

**Also update:**
- `docs/product/WORKFLOW_MAP.md` — add new BR for "Survey results min-n threshold (5)"
- `docs/product/modules/m18-surveys-polls/ui-prototype/microcopy.md` — add the "Awaiting more responses" string
- `docs/product/THREAT_MODEL.md` — add TM-N: re-identification via small-cell aggregates

**Resolution status:** PROPOSED — Security + Legal (DPA) sign-off REQUIRED before m18 ships

---

## Group 5 — m03 ImpersonationSession Entity (D2-16, P2-T1)

### Patch P-5.1 — Resolve ImpersonationSession inferred entity

**File:** `docs/product/DOMAIN_MODEL.md`
**Section:** §1 (Identity & Auth)
**Decision required:** CONFIRM (entity exists in mock; add to DOMAIN_MODEL) OR REJECT (remove from m03 mock)

If CONFIRM:
```diff
+ ### impersonation_session
+ | Column | Type | Constraint | Notes |
+ |--------|------|-----------|-------|
+ | id | uuid | PK | |
+ | admin_user_id | uuid | FK persons.id, NOT NULL | who initiated impersonation |
+ | target_user_id | uuid | FK persons.id, NOT NULL | who was impersonated |
+ | started_at | timestamptz | NOT NULL | |
+ | ended_at | timestamptz | nullable | NULL while active |
+ | reason | text | NOT NULL | required for audit |
+ | audit_log_id | uuid | FK audit_log.id | links to audit entry |
```

**Resolution status:** PROPOSED — Engineering + Security sign-off

---

## Group 6 — Stale [INFERRED] Tag Cleanup (D2-17, P2-T5)

### Patch P-6.1 — Update m09 screens.md workflow refs

**File:** `docs/product/modules/m09-training/ui-prototype/screens.md`
**Lines:** 17, 113
**Before:**
```
**Workflow:** Create & Publish Training [INFERRED]
```
**After:**
```
**Workflow:** WF-058 (Create Training) → WF-059 (Publish Training)
```

**Rationale:** Pass 1 H-6 backfilled WF-058..064 into m09 MODULE_SPEC §3. The `[INFERRED]` tag here is stale.

**Resolution status:** PROPOSED — eligible for auto-VERIFIED in interactive mode (deterministic backfill)

---

## Group 7 — BR-42 Orphan (D2-14, C-31p2-7)

### Patch P-7.1 — Reconcile BR-42

**File:** `docs/product/WORKFLOW_MAP.md`
**Issue:** BR-42 cataloged in WORKFLOW_MAP but no MODULE_SPEC §5 references it.
**Options:**
1. Locate the owning module and add BR-42 reference to its §5; OR
2. Delete BR-42 from WORKFLOW_MAP catalog if it represents work-not-yet-needed

**Resolution status:** PROPOSED — Product sign-off to choose disposition

---

## Group 8 — Legacy Flat-MD Hygiene (D2-15, C-31p2-8)

### Patch P-8.1 — Document or archive legacy `m*.md` flat files

**Issue:** 19 legacy flat-file specs (`docs/product/modules/m*.md`) co-exist with folder specs (`docs/product/modules/m*/MODULE_SPEC.md`). Folder specs are 8–30 days newer; flat files are likely the original PRD module sections that were superseded.

**Options:**
1. Move flat files to `docs/archive/modules-flat-v1/` with a README noting the supersession
2. Add a header note to each flat file: "SUPERSEDED — see `docs/product/modules/{name}/MODULE_SPEC.md`"
3. Add a section to `MODULE_MAP.md` documenting both spec generations

**Resolution status:** PROPOSED — DocOps sign-off

---

## Group 9 — UI Consistency Adoption (Phase C decisions D1/D2/D3)

> Source: UI_CONSISTENCY_SPEC.md curation 2026-05-31 (see SPEC_REVIEW.md "Phase C"). These are the CODE diffs that adopt the blessed spec decisions. **Suggest-only — adoption is a separate planned phase, NOT applied by the gate.** Decisions themselves are already written into UI_CONSISTENCY_SPEC.md.

### P-9.1 — D1: Extract canonical `<PageShell>` (NEW component)

**Artifact:** `packages/ui/src/components/page-shell.tsx` (create) + `packages/ui/src/index.ts` (export)

```tsx
// NEW FILE — packages/ui/src/components/page-shell.tsx
import * as React from "react"
import { cn } from "../lib/utils"

interface PageShellProps {
  maxWidth?: "content" | "full" | number   // content = 1200px
  gutter?: string                            // default px-5 md:px-6
  verticalPadding?: string                   // default py-5 md:py-7
  header?: React.ReactNode                    // optional, composes <PageHeader>
  children: React.ReactNode
}

export function PageShell({
  maxWidth = "content",
  gutter = "px-5 md:px-6",
  verticalPadding = "py-5 md:py-7",
  header,
  children,
}: PageShellProps) {
  const widthClass =
    maxWidth === "content" ? "max-w-[1200px]" : maxWidth === "full" ? "max-w-full" : undefined
  const widthStyle = typeof maxWidth === "number" ? { maxWidth } : undefined
  return (
    <div className={cn("mx-auto", widthClass, gutter, verticalPadding)} style={widthStyle}>
      {header}
      {children}
    </div>
  )
}
```

**Adoption edits (separate phase):**
- `apps/memberry/src/routes/_authenticated.tsx:89` — replace inline `<div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-7">…</div>` with `<PageShell>…</PageShell>`.
- `apps/admin/src/routes/__root.tsx:196` — wrap `<Outlet/>` inside `<main>` with `<PageShell>` (admin currently has no shell → parity fix).

**Resolution status:** PROPOSED — adoption phase; genesis floor of 145 routes ratchets after.

### P-9.2 — D2: Extend Button CVA (size xs/xl, variant tonal, fullWidth prop)

**Artifact:** `packages/ui/src/components/button.tsx`

```diff
   const buttonVariants = cva(
     "...base...",
     {
       variants: {
         variant: {
           default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
           ...
           link: "text-primary underline-offset-4 hover:underline",
+          tonal: "bg-primary-subtle text-primary hover:bg-primary-lighter",
         },
         size: {
+          xs: "h-7 rounded-md px-2 text-xs",
           default: "h-9 px-4 py-2",
           sm: "h-8 rounded-md px-3 text-xs",
           lg: "h-10 rounded-md px-8",
+          xl: "h-11 rounded-md px-10 text-base",
           icon: "h-9 w-9",
         },
+        fullWidth: { true: "w-full" },
       },
       defaultVariants: { variant: "default", size: "default" },
     }
   )
```
Add `fullWidth?: boolean` to `ButtonProps` and thread into `buttonVariants({ variant, size, fullWidth, className })`.

**Adoption edits (separate phase):** migrate 101 className overrides across 78 files — w-full → `fullWidth`, bg-* → `variant="tonal"`, h-7/p-1/text-size → `size="xs"|"xl"`. Top offender: `apps/memberry/src/features/booking/components/active-booking-card.tsx` (15).

**Resolution status:** PROPOSED — bless enum first (this diff), then migrate call sites.

### P-9.3 — D3: Reconcile admin tailwind config to memberry shape

**Artifact:** `apps/admin/tailwind.config.ts` + `apps/admin/src/styles/globals.css` (`:root`)

```diff
// apps/admin/tailwind.config.ts
-        border: "hsl(var(--border))",
-        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
+        border: "var(--color-border)",
+        primary: { DEFAULT: "var(--color-primary)", foreground: "#FFFFFF" },
   // …repeat for every key; add missing parity keys:
   //   cream, surface, text-secondary, border-light, success{,-bg}, warning{,-bg}, error{,-bg}, info{,-bg}
-      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
+      borderRadius: { sm: "8px", md: "12px", lg: "18px", full: "9999px" },
```

```diff
// apps/admin/src/styles/globals.css  :root
-  --border: 214 32% 91%;          /* HSL channel triplet */
-  --primary: 262 50% 47%;
+  --color-border: <full color value matching memberry>;
+  --color-primary: <full color value matching memberry>;
   /* …redefine ALL vars as --color-* full values, IN LOCKSTEP with config */
```

**Critical:** config + `:root` must change atomically per token group. A half-migration (config switched, `:root` unchanged) renders admin unstyled.

**Resolution status:** PROPOSED — atomic per-token-group migration in adoption phase.

---

## Application Order (recommended)

1. Group 6 (P-6.1) — deterministic stale-tag cleanup; safe, no semantic change
2. Group 7 (P-7.1) — BR-42 disposition; small, surgical
3. Group 4 (P-4.1) — m18 DPA threshold; **regulatory-priority**
4. Group 5 (P-5.1) — m03 entity decision
5. Group 2 (P-2.1, P-2.2) — m13 backfill
6. Group 3 (P-3.1) — m14 RPM backfill
7. Group 1 (124 endpoint backfills) — bulk; run `/oli-spec-api` per module
8. Group 8 (P-8.1) — cosmetic hygiene; do last

## Audit Trail Note

This patches file is the gate's complete proposal output. Nothing here has been applied. The human MUST:
1. Review each patch
2. Apply (or reject) explicitly
3. Bump the affected artifact's `oli-version`, set `last-modified` / `last-modified-by`, recalc `checksum`
4. Re-run `/oli-spec-gate` (interactive, without `--auto`) to refresh consistency + collect sign-offs
