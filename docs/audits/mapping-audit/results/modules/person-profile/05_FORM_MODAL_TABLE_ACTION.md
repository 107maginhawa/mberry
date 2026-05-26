# 05 — Form/Modal/Table Action Audit: Person/Profile Module

**Audit Date**: 2026-05-26  
**Module**: Person/Profile

---

## Forms

### ProfileEditForm (`/my/profile`)

**File**: `apps/memberry/src/routes/_authenticated/my/profile.tsx`  
**Schema**: `profileEditSchema` (Zod)  
**Submit**: `handleSubmit(onSubmit)` → `updatePersonMutation` → `PATCH /persons/:person`

#### Field Validation vs Backend

| Field | Frontend (Zod) | Backend Handler | Alignment |
|-------|---------------|----------------|-----------|
| `firstName` | `z.string().min(1)` | `varchar(50) NOT NULL` | Partial — frontend min:1, backend NOT NULL. No max length check in frontend. |
| `lastName` | `z.string().optional()` | `varchar(50)` nullable | OK |
| `middleName` | `z.string().optional()` | `varchar(50)` nullable | OK |
| `specialization` | `z.string().optional()` | `text` nullable | OK |
| `licenseNumber` | `z.string().optional()` | `text` nullable | OK |
| `prcId` | `z.string().optional()` | `text` nullable | OK |
| `bio` | `z.string().optional()` | `text` nullable | OK |
| `phone` | `z.string().optional()` | `contactInfo.phone` (JSONB) | OK — no phone format validation on either side |
| `timezone` | `z.string().optional()` | `varchar` nullable | OK — no IANA timezone validation |
| `preferredLanguage` | `z.string().optional()` | `varchar` nullable | OK — no locale validation |
| `street1/street2/city/state/postalCode/country` | `z.string().optional()` | `primaryAddress` JSONB | OK |

**Gap**: `firstName` has no `max(50)` in frontend Zod schema. DB enforces `varchar(50)` — long names will be rejected at DB level without a user-friendly validation message.

**Gap**: Phone number accepts any string — no format enforcement on either frontend or backend.

---

### Account Deletion Confirm Flow (`/my/settings`, Security tab)

**Type**: Inline confirm UI (not a modal dialog)  
**Evidence**:
```tsx
// Step 1: Show confirm section on button click
onClick={() => setShowConfirm(true)}

// Step 2: Require exact text
<Input value={confirmText} onChange={...} placeholder="DELETE" />
<Button disabled={confirmText !== 'DELETE' || deleting}>Confirm Delete</Button>
```

**Assessment**: Proper double-confirmation pattern. User must:
1. Click "Delete Account"
2. Type "DELETE" literally
3. Click "Confirm Delete"

This is sufficient for a destructive action with a 30-day grace period. No issues.

---

### Notification Preference Toggles (`/my/settings`, Notifications tab)

**Type**: Per-category push/email toggles (Switch component)  
**Submit**: Optimistic update + `PATCH /api/persons/me/notification-preferences`  
**No form submit button** — each toggle fires immediately on change.

**Backend validation**:
- `category` must be in `NOTIFICATION_CATEGORIES` (validated in handler)
- `pushEnabled`, `emailEnabled` are booleans (cast from body)

**Assessment**: No alignment issues. Optimistic UI + revert on error.

---

### Privacy Toggle Switches (`/my/settings`, Privacy tab)

**Type**: Per-field per-org visibility toggles  
**Submit**: Optimistic update + `PATCH /api/persons/me/privacy`  
**Gap**: `orgId` is required by backend (`updatePrivacySettings` uses `body['organizationId']`). Frontend sends `orgId` from selected org. If user has no org memberships, toggles are disabled and show "Join an organization" message. Correct behavior.

**Backend validation**:
- Handler reads `orgId` from body
- Validates user is a member of the org (via memberships join)
- If not a member → `ForbiddenError`

**Assessment**: Alignment OK. One concern: if toggle fires before org loads (race), `orgId` could be undefined → silent no-op (frontend guard `if (!orgId) return`).

---

## Modals

**No modal dialogs found in person/profile module.** All confirmations use inline expand/collapse patterns (account deletion confirmation) or direct action (notification toggles).

**Assessment**: Account deletion uses inline confirm instead of a modal. This is acceptable but lower discoverability — user must scroll to find it in the Security tab.

---

## Tables / Lists

### Memberships List (Profile page)

Rendered inline from `GET /api/persons/me/memberships` result. No table actions — display only.

### Credits List (`/my/credits`)

Uses `GET /api/persons/me/credits` (missing auth middleware — P0). Display table of credit entries.

**Action**: Add credit entry button → `POST /api/persons/me/credit-entries`  
**Auth on create route**: `authMiddleware(["user"])` — OK

---

## Destructive Actions Checklist

| Action | Confirmation? | Reversible? | Backend Grace? | Status |
|--------|--------------|-------------|---------------|--------|
| Delete Account | YES — "Type DELETE" input | YES — 30-day grace | YES | OK |
| Cancel Deletion | NO confirmation | N/A — cancels deletion | N/A | Acceptable |
| Update Privacy | NO confirmation | YES — toggle back | N/A | OK |
| Update Notifications | NO confirmation | YES — toggle back | N/A | OK |
| Update Profile | NO confirmation | YES — edit again | N/A | OK |
| Export Data | NO confirmation | N/A — read only | N/A | OK |

---

## Summary

| ID | Severity | Finding |
|----|----------|---------|
| FINDING-PP-P2-003 | P2 | `firstName` missing `max(50)` in Zod — DB error instead of friendly message |
| FINDING-PP-P3-001 | P3 | Phone field has no format validation on frontend or backend |
| FINDING-PP-P3-002 | P3 | Privacy toggle fires no-op if orgId undefined — silent failure, no user feedback |
| FINDING-PP-P3-003 | P3 | No modal for account deletion — inline confirm buried in Security tab |
