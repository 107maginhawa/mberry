# Module 10: Credit Tracking

| Attribute | Value |
|-----------|-------|
| **Module** | M10 |
| **Phase** | 1 |
| **Wave** | 3 |
| **Priority** | P0 |
| **Monetization** | Premium |
| **Category** | Professional Development |
| **Dependencies** | M05 (Membership), M09 (Training) |

---

## Purpose

Track professional development credits (CPD/CE) across organizations and compliance cycles. Members earn credits automatically through platform training attendance and manually through external activities. The module aggregates credits cross-org, manages per-member cycles, and provides compliance visibility for both members and officers.

---

## Capabilities

### 10.1 Credit Cycle Configuration

Association admin (or national body officer) configures the credit cycle:

- **Cycle duration:** 1, 2, or 3 years. Configurable per association.
- **Required credits per cycle:** Numeric value (e.g., 60 credits per 3-year cycle).
- **Cycle start date:** Based on each member's registration date -- NOT a fixed calendar year. Different members within the same org have different cycle dates.
- **Cycle computation:** `cycle_start = registration_date + (N * cycle_duration)`, `cycle_end = cycle_start + cycle_duration - 1 day`.

### 10.2 Credit Entry Types

| Type | Source | Created By | Editable by Member | Approval Required |
|------|--------|------------|-------------------|-------------------|
| **AUTO** | Platform training attendance confirmed (QR check-in or officer completion marking) | System | No | No |
| **MANUAL** | External activity self-reported by member | Member | Yes (until cycle closes) | No |

**AUTO entries** link to a specific Training record and inherit the training's credit value. Created immediately upon attendance confirmation per BR-13.

**MANUAL entries** require the member to provide:
- Activity name (required)
- Provider / organizer (required)
- Date of activity (required)
- Credit value (required, numeric)
- Supporting document upload (optional, PDF or image, max 5 MB per M10-R5)

Manual entries have no approval workflow -- they are accepted immediately and reflected in totals. However, all manual entries are audit-logged per M10-R3.

### 10.3 Cross-Organization Aggregation

A member's credits aggregate across ALL organizations they belong to (per BR-14):

- Credits earned at a society training count toward the same cycle as credits from a chapter training.
- No double-counting -- each CreditEntry is linked to a specific training or manually entered once.
- Aggregation respects each org's credit-tracking toggle (M10-R1): if an org has credit tracking disabled, its trainings do not generate AUTO credits, but the member's credits from other orgs are unaffected.
- The credit transcript shows the source organization for each entry alongside the aggregate total.

### 10.4 Excess Credit Carryover

Per BR-12:

- If a member earns more credits than required in a cycle, excess credits carry over to the next cycle automatically.
- Carryover appears as a line item in the next cycle: "Carryover from previous cycle: X credits."
- Carryover requires no administrative action.
- Example: 70 credits earned in a 60-credit cycle = 10 credits applied as the opening balance of the next cycle.

### 10.5 Credit Tracking Toggle

Per M10-R1:

- Each org can enable or disable credit tracking independently.
- When disabled: credit-related UI is hidden for that org's context, no AUTO credits generated from that org's trainings, manual credit entry is not available in that org's context.
- Members' cross-org credit totals from other orgs are unaffected.
- Default: enabled for societies and national bodies, disabled for chapters.
- Enabling credit tracking later does NOT retroactively award credits for past activities.

### 10.6 Compliance View (Member)

Member sees:
- Current cycle period (start date -- end date)
- Credits required (per association config)
- Credits earned (total, with progress bar or ring)
- Deficit or surplus relative to requirement
- Breakdown by source: AUTO vs. MANUAL
- Breakdown by organization
- List of all credit entries with details (activity name, date, credits, type, source org)

### 10.7 Compliance View (Officer)

Officer sees credit progress for all members in their org:
- Sortable table: member name, credits earned, credits required, percentage complete, cycle end date
- Highlights members below target pace (prorated: if 50% through cycle, members below 50% of requirement are flagged)
- Filterable by membership category
- Exportable as CSV

### 10.8 Credit Transcript / Compliance Report

Member can download a credit transcript as PDF:
- Lists all credit entries across all orgs for the current cycle (and optionally previous cycles)
- Includes: activity name, date, credits, type (AUTO/MANUAL), source organization, certificate number (if AUTO)
- Shows cycle summary: required, earned, carryover, surplus/deficit
- Suitable for submission to regulatory bodies (e.g., PRC for Philippine CPD compliance)

---

## Business Rules

| Rule | ID | Summary |
|------|----|---------|
| Per-member credit cycle | BR-11 | Cycle starts from registration date, not calendar year. Duration configurable per association. |
| Cross-org aggregation | BR-14 | Credits sum across all member orgs. Transcript shows source per entry. |
| Excess carryover | BR-12 | Surplus credits carry over to the next cycle automatically. |
| Toggle per org | M10-R1 | Credit tracking can be enabled/disabled per org. Disabling hides UI but does not affect cross-org totals. |
| Auto credit on attendance | BR-13 | Credits awarded immediately upon attendance confirmation. |
| Duplicate check-in prevention | M10-R2 | No duplicate credits for same member at same training. |
| Officer manual adjustment | M10-R4 | Officers can manually award or deduct credits with mandatory reason. |
| Documented deductions | M10-R3 | Every deduction is immutably audit-logged with reason. |
| File upload constraints | M10-R5 | Supporting documents for manual entries: PDF or image formats, max 5 MB per file. |

### Edge Case Table

| Edge Case | Behavior |
|-----------|----------|
| **Leap year registration date** | If registration date is Feb 29, anniversary in non-leap years uses Feb 28. Cycle end remains consistent (Feb 27 or Feb 28 depending on the target year). |
| **Mid-cycle config change (duration)** | Existing members' earned credits are preserved. Only future cycle duration changes. Current cycle end date is recalculated by extending (or shortening) from the current cycle start. |
| **Mid-cycle config change (required credits)** | New requirement applies immediately to the current cycle. Members see updated deficit/surplus. |
| **Registration date correction** | If an officer corrects a member's registration date, credits recalculate against new cycle boundaries. Credits earned remain but may now fall in a different cycle. Audit-logged. |
| **Member joins mid-cycle** | Gets a full cycle from their registration date. Not prorated. |
| **Org disables credit tracking** | AUTO credits from that org's trainings stop. Existing credits from that org persist in member's record. Member's cross-org total is unaffected. |
| **Org re-enables credit tracking** | Future trainings generate AUTO credits. No retroactive credits for past trainings during disabled period. |
| **Training cancelled after credits awarded** | Per M09: cancellation does NOT auto-revoke credits. Manual correction required via officer adjustment (M10-R4). |
| **Member belongs to zero orgs with credit tracking enabled** | Credit dashboard shows "No organizations with credit tracking enabled." No cycle information displayed. |
| **Cycle ends with insufficient credits** | Warning notification sent to member. No automatic penalty. Officer can view non-compliant members in admin view. |

---

## User Journeys

### Member Journeys

#### M-22: View My Credit Summary and Compliance Status

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens credit dashboard from nav | Shows current cycle: dates, required credits, earned credits, progress visualization | No orgs with credit tracking -> "Credit tracking is not enabled for any of your organizations" |
| 2 | Views breakdown | Credits grouped by source org, by type (AUTO/MANUAL), chronological list | |
| 3 | Views compliance status | Deficit/surplus shown. If surplus: green indicator. If deficit: amber with "X credits needed by [date]" | |
| 4 | Taps a credit entry | Detail view: activity name, date, credits, source org, certificate link (if AUTO) | |

#### M-23: Add Manual Credit Entry

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens credit dashboard, clicks "Add Credit" | Manual entry form | Credit tracking not enabled for any org -> button not shown |
| 2 | Fills in: activity name, provider, date, credit value | Real-time validation | Missing required fields -> field-level errors |
| 3 | Optionally uploads supporting document | Accepts PDF or image, max 5 MB | Wrong format or too large -> "Supported: PDF, JPEG, PNG, WebP. Max 5 MB." |
| 4 | Submits | Credit entry created immediately. No approval needed. Progress bar updates. Audit log entry created. | |
| 5 | Views updated credit dashboard | New entry appears in list with "Manual" tag | |

#### M-24: Download Credit Transcript / Compliance Report

> **Note:** Transcript download is triggered from `/my/credits` via the Export button — generates a PDF download directly. There is no separate transcript page.

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens credit dashboard (`/my/credits`), clicks "Export" / "Download Transcript" | Options: current cycle, previous cycle, all cycles | No credits -> "No credit entries to include in transcript" |
| 2 | Selects scope and clicks download | PDF generated and downloaded immediately: member name, license number, cycle dates, all credit entries, summary totals | |
| 3 | PDF includes per-entry detail | Activity name, date, credits, type, source org, certificate number (if AUTO) | |

### Society Officer Journeys

#### SO-8: View Member Credit Compliance Across Org

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens Credits section in officer sidebar | Table: member name, earned, required, % complete, cycle end | Credit tracking disabled for org -> "Enable credit tracking in org settings to use this feature" |
| 2 | Sorts by % complete (ascending) | Non-compliant members surface to top | |
| 3 | Filters by membership category | Table updates | No members in category -> empty state |
| 4 | Exports as CSV | Downloads CSV with all columns | |

#### SO-9: Review Individual Member Credit Detail

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Clicks member name in credit overview | Member credit detail: cycle info, all entries (AUTO + MANUAL from all orgs), compliance status | |
| 2 | Views manual entries | Can see activity name, provider, date, credits, uploaded document (if any) | |
| 3 | Notes discrepancy | Can use manual credit adjustment (M10-R4) to award or deduct with documented reason | |

#### SO-10: Manually Adjust Member Credits

| Stage | User Action | System Response | Error Path |
|-------|-------------|-----------------|------------|
| 1 | Opens member credit detail, clicks "Adjust Credits" | Form: amount (positive = award, negative = deduct), reason (required) | Not an officer -> option not shown |
| 2 | Enters amount and reason | Validates reason is non-empty | Empty reason -> "Reason is required for all credit adjustments" |
| 3 | Confirms adjustment | Credit entry created. Member notified. Audit trail recorded with officer identity, amount, reason, timestamp. | |

---

## Screens

| Route | Page | Key Functions | Access |
|-------|------|---------------|--------|
| `/my/credits` | Credit Dashboard | Cycle progress, compliance status, entry list, breakdown by org and type. Transcript download is triggered from this screen via the Export button — generates a PDF download, no separate page. | Member |
| `/my/credits/log` | Add Manual Credit | Entry form with document upload | Member |
| `/org/[id]/officer/reports/credits` | Org Credit Overview | All-member credit table, sort, filter, export | Officer |
| `/org/[id]/officer/roster/[id]` | Member Credit Detail | Individual member credit history, adjustment option | Officer |

---

## Data Entities

### CreditEntry

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| member_id | UUID | FK to Member |
| type | Enum: AUTO, MANUAL | How the credit was earned |
| credit_value | Decimal | Number of credits (positive for awards; negative for deductions) |
| activity_date | Date | When the activity occurred |
| created_at | Timestamp | When the entry was recorded |
| source_training_id | UUID (nullable) | FK to Training (populated for AUTO entries) |
| source_org_id | UUID | The org context in which the credit was earned or entered |
| activity_name | String (nullable) | For MANUAL entries: name of external activity |
| provider | String (nullable) | For MANUAL entries: organizer or provider |
| document_url | String (nullable) | For MANUAL entries: uploaded supporting document |
| adjusted_by | UUID (nullable) | For officer adjustments: FK to officer Member |
| adjustment_reason | String (nullable) | For officer adjustments: mandatory reason text |

### CreditCycle

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| member_id | UUID | FK to Member |
| association_id | UUID | FK to Association (cycle config comes from association) |
| cycle_number | Integer | Sequential cycle number for this member (1, 2, 3...) |
| cycle_start | Date | Start of this cycle |
| cycle_end | Date | End of this cycle |
| required_credits | Decimal | Credits required for this cycle (snapshot from association config at cycle creation) |
| carryover_credits | Decimal | Credits carried over from previous cycle |

### CreditSummary (Computed View -- Not Stored)

| Field | Type | Description |
|-------|------|-------------|
| member_id | UUID | Member |
| current_cycle_start | Date | Current cycle start |
| current_cycle_end | Date | Current cycle end |
| required_credits | Decimal | Credits needed this cycle |
| earned_credits | Decimal | Sum of all CreditEntry values in current cycle |
| carryover_credits | Decimal | Credits carried from previous cycle |
| total_credits | Decimal | earned + carryover |
| deficit_surplus | Decimal | total - required (positive = surplus, negative = deficit) |
| compliance_status | Enum: ON_TRACK, AT_RISK, NON_COMPLIANT | Derived from prorated progress |

---

## Acceptance Criteria Summary

- Cycle dates are per-member, not fixed calendar -- two members in the same org may have different cycle end dates.
- Carryover credits appear as a line item in the next cycle's credit list with clear provenance.
- MANUAL entries have no approval gate -- they are immediately reflected in totals.
- AUTO entries fire only after attendance is confirmed, not on registration alone.
- Cross-org aggregation sums credits from all orgs the member belongs to, respecting each org's toggle.
- Officer credit adjustments require a non-empty reason and are immutably audit-logged.
- Leap year registration dates handled gracefully (Feb 29 -> Feb 28 in non-leap years).
- Credit transcript PDF includes all entries across all orgs with source attribution.
- Disabling credit tracking for an org hides UI but preserves existing credit data.

---

*Module 10 -- Memberry v3*
