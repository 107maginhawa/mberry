
# OFFICER & ADMIN INTERACTIVE ELEMENTS AUDIT
## Complete Interactive Inventory with Action Details

Generated: 2026-05-26

---

## MEMBERRY APP - OFFICER ROUTES

### 1. ROSTER MANAGEMENT

#### 1.1 Officer Roster Index
**File:** `/apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/index.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Add Member | Button + Dialog | `setShowAdd(true)` | `api.post('/api/persons')` + `addRosterMemberMutation` | `isSubmitting` | `toast.error(fallback msg)` | `toast.success` + reload | No | `isSubmitting` | ✓ Form validation via zodResolver |
| Cancel Add | Button | `onClick={onClose}` | N/A | N/A | N/A | N/A | N/A | `isSubmitting` | ✓ Proper cleanup |
| Submit Add | Button | `handleSubmit(onSubmit)` | POST /api/persons | `isSubmitting` | catch handler | toast + reload | No | `isSubmitting` | ⚠ Page reload not ideal, consider optimistic update |

**Validation Schema:**
- firstName: required string
- lastName: optional string
- email: required, valid email
- licenseNumber: optional string

---

#### 1.2 Member Detail Page
**File:** `/apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/$memberId.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Verify License | Button | `verifyMutation.mutate(id)` | `api.patch(/api/association/member/licenses/{id})` | `isPending` | `toast.error` | `toast.success` | No | `isPending` | ✓ Good UX for verification |

---

### 2. PAYMENTS & FINANCES

#### 2.1 Officer Payments Index
**File:** `/apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/payments/index.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Send Reminders | Button | `handleSendReminders()` | `generateDuesInvoicesForOrgMutation` | `sending (isPending)` | `toast.error` | `toast.success(count)` | No | `sending` | ✓ Count-aware feedback |
| Record Payment | Link | Navigate | N/A | N/A | N/A | N/A | N/A | N/A | ✓ Clean navigation |

**Logic:** Sends reminders for current fiscal year (Jan 1 - Dec 31)

---

#### 2.2 Payment Refund Component
**File:** `/apps/memberry/src/features/dues/components/refund-form.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Expand Refund | Button | `setExpanded(true)` | N/A | N/A | N/A | N/A | N/A | N/A | ✓ Good UX pattern |
| Initiate Refund | Button | `setShowConfirm(true)` | N/A | N/A | N/A | N/A | No (form only) | `!reason || amountCents <= 0` | ✓ Form validation |
| Confirm Refund | Button | `refundMutation.mutate()` | `refundPaymentMutation` | `isPending` | `toast.error` | `toast.success(amount)` | **YES - Dialog** | `isPending` | ✓✓ TWO-STEP confirmation for destructive action |
| Cancel Refund | Button | `setExpanded(false)` | N/A | N/A | N/A | N/A | N/A | N/A | ✓ |

**Validation:**
- Amount: number, min 0, step 0.01
- Reason: required text
- Fund allocations reversed on success

---

### 3. TRAINING MANAGEMENT

#### 3.1 Training Attendance
**File:** `/apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/training/$trainingId/attendance.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Check-in Member | Button | `checkInMutation.mutate(memberId)` | `checkInCustomTrainingMutation` | `isPending` | Smart: distinguishes 'already checked in' as warning vs error (BR-17) | `toast.success` | No | `isPending` | ✓✓ Excellent error distinction |

**Error Handling Detail:**
```
if message contains 'already': toast.warning('Already checked in')
else: toast.error(message)
```

---

### 4. EVENTS MANAGEMENT

#### 4.1 Event Detail & Attendance
**File:** `/apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/events/$eventId.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Attendance Table | Table | Display only | `listEventAttendanceOptions` | `isLoading` → Skeleton | Error state UI | N/A | N/A | N/A | ℹ Read-only in current view |
| Event Status Badges | Badge | Display only | N/A | N/A | N/A | N/A | N/A | N/A | ✓ Color-coded status |

**Status Colors:**
- confirmed: green
- waitlisted: orange
- cancelled: red
- pending: info

---

### 5. DOCUMENTS MANAGEMENT

#### 5.1 Document Detail
**File:** `/apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/documents/$documentId.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Version History | Table | Display only | `listDocumentVersionsOptions` | `isLoading` → Skeleton | EmptyState | N/A | N/A | N/A | ℹ Read-only view |
| Access Log | Table | Display only | `getDocumentAccessLogOptions` | `isLoading` → Skeleton | EmptyState | N/A | N/A | N/A | ℹ Read-only view |

---

### 6. MEMBER MANAGEMENT - DETAIL ACTIONS

#### 6.1 Member Status Change
**File:** `/apps/memberry/src/features/membership/components/member-detail.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Change Category | Button | `setShowChangeCat(true)` | `updateRosterMemberMutation` | `isPending` | `toast.error` | `toast.success` | No (form only) | `!newCategoryId` | ✓ Proper dropdown selection |
| Reinstate Member | Button | `reinstateMutation.mutate()` | `reinstateMembershipMutation` | `isPending` | `toast.error` | `toast.success` | No | `isPending` | ✓ Conditional: only if suspended/removed |
| Suspend Member | Button | `setShowSuspend(true)` | `updateRosterMemberMutation` | `isPending` | `toast.error` | `toast.success` | No (form only) | `!suspendReason.trim()` | ✓ Requires reason text |
| Confirm Suspend | Button in Dialog | `updateMutation.mutate({status: 'suspended', note})` | PATCH | `isPending` | `toast.error` | `toast.success` | No, but form validated | `!reason || isPending` | ✓ Destructive action properly gated |
| Mark Deceased | Button | `setShowDeceased(true)` | `terminateMembershipMutation` | `isPending` | `toast.error` | `toast.success` | No (confirmation implicit) | `isPending` | ✓ Terminal action with warning text |

**Status Conditions:**
- canReinstate: status === 'suspended' OR 'removed'
- canMarkDeceased: status === 'active' OR 'gracePeriod' OR 'lapsed'

**Status Badges:**
- active: green
- gracePeriod: warning
- suspended: error
- removed: error
- lapsed: warning

---

### 7. ELECTIONS MANAGEMENT

#### 7.1 Election Detail
**File:** `/apps/memberry/src/features/elections/components/election-detail.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Edit Election | Link | Navigate to /edit | N/A | N/A | N/A | N/A | N/A | Conditional: status === 'draft' | ✓ Draft-only edit |
| Open Nominations | Button | `nominationsMutation.mutate()` | `openElectionNominationsMutation` | `isPending` | `toast.error` | `toast.success` | **YES - 2-step** | `confirmAction === nextStatus` | ✓ Confirmation step shown |
| Open Voting | Button | `votingMutation.mutate()` | `openElectionVotingMutation` | `isPending` | `toast.error` | `toast.success` | **YES - 2-step** | BR-33: Disabled if !positionsReady | ✓ Guard against incomplete setup |
| Close Voting | Button | `certifyMutation.mutate()` | `certifyElectionMutation` | `isPending` | `toast.error` | `toast.success` | **YES - 2-step** | `confirmAction !== 'awaiting_confirmation'` | ✓ |
| Publish Results | Button | `certifyMutation.mutate()` | `certifyElectionMutation` | `isPending` | `toast.error` | `toast.success` | **YES - 2-step** | `confirmAction !== 'published'` | ✓ |
| Delete Candidate | Button | `removeNomineeMut.mutate()` | `deleteCandidateMutation` | `isPending` | `toast.error` | `toast.success` | No inline, but modal shows context | `isPending` | ⚠ Could benefit from confirmation |

**Status Machine:**
```
draft → nominations_open → voting_open → awaiting_confirmation → published
  ↓
  cancelled (available anytime)
```

**Confirmation Pattern:** 2-step UI - click action button, then confirm in situ

---

## ADMIN APP ROUTES

### 1. ASSOCIATIONS

#### 1.1 Associations List
**File:** `/apps/admin/src/routes/associations/index.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Create Association | Button | `setDialogOpen(true)` | `createAssociationMutation` | `createMutation.isPending` | `toast.error` | `toast.success` | No | `createMutation.isPending` | ✓ Form-gated |
| Cancel Create | Button in Dialog | `onClose()` | N/A | N/A | N/A | N/A | N/A | N/A | ✓ |
| Submit Create | Button in Dialog | `createMutation.mutate({name, country, currency})` | POST | `isPending` | `toast.error` | `toast.success` | No | `isPending` | ✓ Form validation |

**Validation:**
- name: required string
- country: required string
- currency: required, 3-char code [A-Z]

---

### 2. FEATURE FLAGS

#### 2.1 Feature Flags List
**File:** `/apps/admin/src/routes/feature-flags/index.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Create Flag | Button | `setDialogOpen(true)` | `setFeatureFlagMutation` | `create.isPending` | `toast.error(msg)` | `toast.success` | No | `create.isPending` | ✓ Form validation |
| Submit Flag | Button in Dialog | `create.mutate({targetType, targetId, moduleName, enabled})` | POST | `isPending` | `toast.error` | `toast.success` | No | `isPending` | ✓ |
| Delete Flag | Trash2 Icon Button | `deleteMutation.mutate(id)` | `deleteFeatureFlagMutation` | `isPending` | `toast.error` | `toast.success` | **NO** | `isPending` | 🚨 **FLAG: Destructive action WITHOUT confirmation** |
| Cancel Create | Button | `onClose()` | N/A | N/A | N/A | N/A | N/A | N/A | ✓ |

**Module Options:** person, booking, billing, audit, notifs, comms, storage, email, reviews

---

### 3. OPERATORS (ADMINS)

#### 3.1 Operators List
**File:** `/apps/admin/src/routes/operators/index.tsx`

| Element | Type | Handler | API Call | Loading | Error Handling | Success Feedback | Confirmation | Disabled If | Issues |
|---------|------|---------|----------|---------|----------------|------------------|--------------|-----------|--------|
| Invite Operator | Button | `setDialogOpen(true)` | `inviteAdminMutation` | `inviteAdminMutation.isPending` | `toast.error(msg)` | `toast.success` | No | `inviteAdminMutation.isPending` | ✓ |
| Submit Invite | Button in Dialog | `inviteAdminMutation.mutate({name, email})` | POST | `isPending` | `toast.error` | `toast.success` | No | `isPending` | ✓ Form validation |
| Cancel Invite | Button | `onClose()` | N/A | N/A | N/A | N/A | N/A | N/A | ✓ |
| Revoke Admin | Trash2 Icon Button | `setRevokeTarget(admin)` | Shows confirmation | N/A | N/A | N/A | No (opens dialog) | N/A | ✓ Modal confirmation |
| Confirm Revoke | Button in Confirmation Dialog | `revoke.mutate({path, body})` | `revokeAdminMutation` | `isPending` | `toast.error + reset state` | `toast.success` | **YES - Dialog** | `isPending` | ✓✓ Proper two-step revocation |

**Revoke Error Recovery:**
```javascript
onError: (err) => {
  toast.error(msg)
  setRevokeTarget(null)  // Resets state
}
```

---

## SUMMARY TABLE: CONFIRMATION PATTERNS

| Action | Has Confirmation | Type | File |
|--------|-----------------|------|------|
| Refund Payment | ✓ YES | 2-step Dialog | refund-form.tsx |
| Suspend Member | ✓ PARTIAL | Form validation | member-detail.tsx |
| Mark Deceased | ✓ PARTIAL | Warning text + dialog | member-detail.tsx |
| Revoke Admin | ✓ YES | Confirmation dialog | operators/index.tsx |
| Delete Feature Flag | ✗ NO | Single-click | feature-flags/index.tsx |
| Delete Candidate | ✗ MINIMAL | Modal context | election-detail.tsx |
| Open Nominations | ✓ YES | 2-step UI | election-detail.tsx |
| Election Status Transitions | ✓ YES | 2-step UI | election-detail.tsx |

---

## AUDIT FINDINGS & RISKS

### ✓ STRENGTHS

1. **Destructive Actions Mostly Guarded**
   - Refunds: 2-step confirmation + validation
   - Admin revoke: Proper confirmation dialog
   - Member status changes: Form validation + warnings

2. **Loading States Comprehensive**
   - All mutations use `.isPending` or `.isSubmitting`
   - Button text updates (e.g., "Suspending..." vs "Suspend")
   - Table skeletons for async data

3. **Error Feedback Consistent**
   - Toast notifications for all outcomes
   - Fallback messages on missing error details
   - State reset on error (e.g., setRevokeTarget(null))

4. **Smart Error Distinction**
   - Training attendance: "Already checked in" as warning, not error (BR-17)
   - Good UX for recoverable vs fatal errors

5. **Form Validation Rigorous**
   - React Hook Form + Zod for roster add
   - Field-level validation with error messages
   - Disabled submit button until valid

---

### 🚨 RISKS & ISSUES

1. **Missing Confirmation: Feature Flag Delete**
   - **File:** feature-flags/index.tsx
   - **Issue:** Single-click delete, no confirmation dialog
   - **Impact:** Easy accidental deletion of platform flags
   - **Recommendation:** Add confirmation dialog like admin revoke

2. **Weak Confirmation: Delete Candidate**
   - **File:** election-detail.tsx (removeNomineeMut)
   - **Issue:** Modal shows context but no explicit "Confirm Delete" button
   - **Impact:** Unclear user intent
   - **Recommendation:** Add explicit confirmation step

3. **Page Reload on Member Add**
   - **File:** roster/index.tsx
   - **Issue:** `window.location.reload()` on success
   - **Impact:** Suboptimal UX (flicker, lost state)
   - **Recommendation:** Use optimistic update + query invalidation

4. **Elections Guard BR-33 Not Visible**
   - **File:** election-detail.tsx
   - **Issue:** Tooltip for "Open Voting" disabled state mentioned but not shown in code excerpt
   - **Impact:** Users may not understand why button is disabled
   - **Recommendation:** Ensure tooltip is rendered

5. **Admin Operators Revoke Error Recovery**
   - **File:** operators/index.tsx
   - **Strength:** Resets `revokeTarget` on error
   - **Note:** Good pattern, could be used elsewhere

---

### ⚠ OBSERVATIONS

1. **Election Status Transitions:** Complex state machine with 5 statuses + cancel branch. All transitions properly guarded with confirmAction check.

2. **Member Status Matrix:** Multiple valid state transitions (suspended→active, removed→active, etc.). Conditional rendering correctly gates actions per status.

3. **Two Types of Confirmation:**
   - **In-Situ Confirmation:** Elections (click button → confirm same button)
   - **Modal Confirmation:** Refund, admin revoke (click button → dialog confirms)
   
   Both patterns are used; consistency across similar actions would improve UX.

4. **API Error Messages:** Mostly passed through from server. Toast falls back to generic message when err.message unavailable.

---

## DETAILED ACTION INVENTORY BY CATEGORY

### Mutations with Confirmation
- `refundPaymentMutation` - 2-step dialog ✓
- `revokeAdminMutation` - confirmation dialog ✓
- `openElectionNominationsMutation` - 2-step UI ✓
- `openElectionVotingMutation` - 2-step UI ✓
- `certifyElectionMutation` - 2-step UI ✓

### Mutations without Confirmation
- `deleteFeatureFlagMutation` - 🚨 NO CONFIRMATION
- `deleteCandidateMutation` - Weak confirmation
- `addRosterMemberMutation` - Form validated
- `updateRosterMemberMutation` - Form validated

### Read-Only Views (No Actions)
- Document version history table
- Document access log table
- Event registration table (in current view)
- Payment history table (display + pagination only)

---

## DISABLED STATE CONDITIONS

| Button | Disabled When |
|--------|---------------|
| Add Member | `isSubmitting` |
| Send Reminders | `sending` (isPending) |
| Check-in | `isPending` |
| Verify License | `isPending` |
| Refund (Initial) | `!reason || amountCents <= 0 || !!amountError` |
| Refund (Confirm) | `isPending` |
| Change Category | `!newCategoryId || isPending` |
| Suspend | `!suspendReason.trim() || isPending` |
| Reinstate | `isPending` |
| Mark Deceased | `isPending` |
| Create Election Action | `confirmAction !== expectedStatus` |
| Open Voting | BR-33: !positionsReady (disabled + tooltip) |
| Create Flag | `isPending` |
| Delete Flag | `isPending` |
| Invite Operator | `isPending` |
| Revoke Admin | Shows confirmation first, then `isPending` |

---

## LOADING STATE PATTERNS

### Pattern 1: Button Text Update
```jsx
{isPending ? 'Suspending...' : 'Suspend'}
```
Used in: Suspend, Refund, Reinstate, Mark Deceased

### Pattern 2: Spinner/Icon (Implied)
```jsx
<Bell className="h-4 w-4 mr-2" />
{sending ? 'Sending...' : 'Send Reminders'}
```
Used in: Send Reminders

### Pattern 3: Skeleton Loaders
Used for async data tables: Training attendance, document versions, access logs

### Pattern 4: Inline Validation Errors
```jsx
{errors.firstName && <p role="alert">{errors.firstName.message}</p>}
```
Used in: Roster add, all form fields

---

## ROLE GATE ENFORCEMENT

| Route | Required Role | File |
|-------|---------------|------|
| Feature Flags | 'super' | feature-flags/index.tsx |
| Operators | 'super' | operators/index.tsx |
| Associations (admin app) | 'super' | associations/index.tsx |
| Officer routes | Implicit (authenticated) | officer/* |

---

## ERROR HANDLING PATTERNS

### Pattern 1: Toast with Fallback
```javascript
onError: (err: unknown) => {
  const msg = err instanceof Error ? err.message : 'Failed to...'
  toast.error(msg)
}
```

### Pattern 2: Smart Condition Check
```javascript
if (message.toLowerCase().includes('already')) {
  toast.warning('Already checked in')
} else {
  toast.error(message)
}
``` (BR-17)

### Pattern 3: State Reset on Error
```javascript
onError: () => {
  setRevokeTarget(null)  // Clear pending action
}
```

---

## NEXT STEPS FOR STABILIZATION

1. **Add confirmation to feature flag delete** (high priority)
2. **Strengthen delete candidate confirmation** (medium priority)
3. **Convert roster add to optimistic update** (UX improvement)
4. **Document BR-33 guard in UI** (tooltip or message)
5. **Standardize confirmation pattern** (in-modal vs in-situ)
6. **Add integration tests for mutation error paths**
7. **Audit all remaining admin routes** not covered here

---

End of Report
