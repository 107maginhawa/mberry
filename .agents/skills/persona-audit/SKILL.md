---
name: persona-audit
description: Validate module user journeys against defined personas before implementation. Finds dead ends, missing states, role confusion, and unreachable features. Use before /develop, "audit persona journey", "who uses this", "journey audit", or when starting a new module.
---

# persona-audit

Persona-first journey validation. Before writing code, verify that the module's user flows make sense for each persona who will use it. Catches dead ends, missing error recovery, role confusion, and features nobody can navigate to.

## Triggers

- Before `/develop` Phase 1 (design validation gate)
- "Audit persona journey for {module}", "who uses this"
- "Journey audit", "user flow check"
- When starting implementation of a new module or feature

## Source Files

- **Personas**: `docs/ver-3/business/personas-and-roles.md`
- **Business rules**: `docs/ver-3/business/business-rules.md`
- **Route structure**: `apps/account/src/routes/` and `apps/admin/src/routes/`
- **PRD/specs**: `docs/ver-3/` (module-specific specs if they exist)
- **OpenAPI spec**: `specs/api/dist/openapi/openapi.json` (available actions)

## Workflow

### Step 1: Identify Personas

Read `docs/ver-3/business/personas-and-roles.md`. For the target module, identify:
- **Primary personas** — who uses this module daily
- **Secondary personas** — occasional users (admin, auditor)
- **Edge personas** — new users, deactivated users, users with partial permissions

For each persona, note:
- Role and permissions
- Technical comfort level
- Primary goals with this module
- Context of use (mobile? desktop? time pressure?)

### Step 2: Map User Journeys

For each persona × module interaction, trace the complete journey:

```
PERSONA: Association Admin
MODULE: Dues Collection

Journey: "Collect annual dues from members"
1. ENTRY: Where does this persona START? (sidebar nav? notification? dashboard card?)
2. DISCOVERY: How do they find the feature? (menu label? search? direct URL?)
3. ACTION: What do they do? (create invoice, set amount, select members)
4. FEEDBACK: What confirms success? (toast, redirect, email sent indicator)
5. ERROR: What happens when it fails? (validation error, payment declined, network timeout)
6. RECOVERY: How do they fix errors? (retry button, edit form, contact support)
7. EXIT: Where do they go after? (back to list, next task, dashboard)
```

### Step 3: Find Gaps

For each journey, check for:

**Dead Ends** (no way forward):
- Action completes but no indication of next step
- Error state with no recovery path
- Empty state with no guidance ("No items" with no "Create" button)

**Unreachable Features**:
- Feature exists in API but no route/button leads to it
- Feature requires navigation path that doesn't exist
- Feature visible to wrong role (member sees admin-only action)

**Missing States**:
- Loading state absent (user sees flash of empty)
- Error state not designed (what if API returns 500?)
- Partial data state (member has profile but no photo — what shows?)
- First-use state (brand new user, zero data)

**Role Confusion**:
- Same page shows different actions for different roles but layout unclear
- Permissions not communicated (button exists but click returns 403)
- Admin can see member's data but member can't tell

**Broken Context**:
- User loses position after action (form submit resets scroll)
- Bulk action with no progress indicator
- Long operation with no cancel option

### Step 4: Check Route Structure

Verify against actual routes in `apps/account/src/routes/` and `apps/admin/src/routes/`:

```bash
# Does the route exist?
ls apps/account/src/routes/{module}*
ls apps/admin/src/routes/{module}*

# What navigation exists?
grep -r "{module}" apps/*/src/components/navigation/
grep -r "{module}" apps/*/src/components/sidebar/
```

For each journey entry point:
- Route exists? → CHECK
- Navigation link exists? → CHECK
- Route protected by correct role? → CHECK
- Route has loading/error boundaries? → CHECK

### Step 5: Check API Completeness

Cross-reference journeys against OpenAPI spec:
- Every user action maps to an API endpoint? → CHECK
- Endpoint supports needed query params (filters, search)? → CHECK
- Response includes all fields the UI needs? → CHECK
- Error responses are structured enough for UI error messages? → CHECK

### Step 6: Produce Journey Audit Report

```
PERSONA JOURNEY AUDIT: {module}
═══════════════════════════════════════

PERSONAS IDENTIFIED: 3
  - Association Admin (primary) — manages dues, views reports
  - Member (primary) — pays dues, views history
  - Treasurer (secondary) — generates reports, issues refunds

═══════════════════════════════════════
JOURNEY: Admin → "Collect annual dues from members"

  Entry:       ✓ Sidebar nav "Dues" link exists
  Discovery:   ✓ Clear page title, "New Collection" button visible
  Action:      ✓ Form with member selection, amount, due date
  Feedback:    ⚠ PARTIAL — toast on success, but no email confirmation indicator
  Error:       ✗ MISSING — no handling for partial batch failure
  Recovery:    ✗ MISSING — if 3/50 payments fail, no retry mechanism
  Exit:        ✓ Redirects to dues list with new entry highlighted

GAPS:
  1. [DEAD END] Batch payment — if some fail, user stuck with no retry option
  2. [MISSING STATE] Empty state — first-time admin sees blank page, no onboarding
  3. [UNREACHABLE] Refund action exists in API but no button in member dues detail

═══════════════════════════════════════
JOURNEY: Member → "Pay my dues"

  Entry:       ✓ Dashboard card "Dues pending" with amount
  Discovery:   ✓ Click card → dues detail page
  Action:      ✓ "Pay Now" button → payment flow
  Feedback:    ✓ Success page with receipt number
  Error:       ⚠ PARTIAL — shows "Payment failed" but no next steps
  Recovery:    ✗ MISSING — no "try again" or "use different method" option
  Exit:        ✓ Back to dashboard, card updates to "Paid"

GAPS:
  4. [BROKEN CONTEXT] Payment error shows generic message, no actionable guidance
  5. [MISSING STATE] What if member has no payment method on file?

═══════════════════════════════════════
SUMMARY:
  Journeys traced: 5
  Gaps found: 8 (2 dead ends, 3 missing states, 2 broken context, 1 unreachable)
  
  BLOCKING (fix before implementation):
    - #1 Batch failure recovery (dead end for admin)
    - #5 No payment method state (dead end for member)
  
  IMPORTANT (fix during implementation):
    - #2 Empty state onboarding
    - #4 Payment error guidance
    - #6-8 (listed above)
  
  IMPLEMENT ORDER:
    1. Member payment journey (most users, simplest flow)
    2. Admin collection journey (fewer users, more complex)
    3. Treasurer reporting (secondary, depends on 1+2 data)
```

## Rules

- NEVER skip error/recovery analysis — that's where real UX bugs hide
- Check BOTH apps (account + admin) — features may span both
- Include first-use/empty states — don't assume data exists
- Flag role confusion explicitly — "admin sees X but member sees Y on same URL" is a bug
- Implementation order recommendation MUST be persona-driven (most users first)
- If personas doc is missing or incomplete, flag it as blocker (don't invent personas)
- Cross-reference with BRs — some business rules define journey constraints
- Don't just check routes exist — check they're REACHABLE via navigation
