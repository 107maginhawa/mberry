# INTERACTIVE ELEMENTS - QUICK REFERENCE CHECKLIST

## OFFICER ROUTES - ACTION CHECKLIST

### ✓ ROSTER (Officer Roster Index)
- [x] Add Member - Dialog form + API + toast
  - API: POST /api/persons
  - Validation: firstName, email required
  - Issue: Page reload on success (consider optimistic update)

### ✓ MEMBER DETAIL 
- [x] Verify License - Inline button in table
  - API: PATCH /api/association/member/licenses/{id}
  - Loading: isPending
  - Success: toast + query invalidate

- [x] Change Category - Dialog selector
  - API: PATCH /api/membership/categories
  - Validation: categoryId required
  - Gate: All statuses

- [x] Reinstate Member - Direct button
  - API: reinstateMembershipMutation
  - Gate: Only if suspended OR removed
  - Success: toast + invalidate

- [x] Suspend Member - Dialog with reason
  - API: PATCH with status='suspended'
  - Validation: Reason text required (non-empty)
  - Disabled: !suspendReason.trim()
  - Status: Destructive action, form-gated

- [x] Mark Deceased - Dialog with warning
  - API: terminateMembershipMutation
  - Status: Terminal action
  - Warning: "This action cannot be undone without manual reinstatement"
  - Gate: Only if active, gracePeriod, or lapsed

### ✓ PAYMENTS
- [x] Send Reminders - Direct button
  - API: generateDuesInvoicesForOrgMutation
  - Disabled: sending (isPending)
  - Feedback: toast.success with count
  - Logic: Current fiscal year (Jan 1 - Dec 31)

- [x] Record Payment - Navigation link
  - No action, just link to /payments/new

- [x] Refund - Expandable form + 2-step confirm
  - Step 1: Click Refund → setExpanded(true)
  - Step 2: Click "Initiate Refund" → setShowConfirm(true)
  - Step 3: Dialog confirms with "Confirm Refund" button
  - API: refundPaymentMutation
  - Validation: amount > 0, reason required
  - Disabled: !reason || amountCents <= 0 || !!amountError
  - Status: ✓✓ EXCELLENT - Proper destructive action flow
  - Effect: Fund allocations reversed

### ✓ TRAINING
- [x] Check-in Member - Inline button per row
  - API: checkInCustomTrainingMutation
  - Loading: isPending
  - Error Handling: Smart - BR-17 distinguishes "already checked in" as warning
  - Success: toast.success, update checkedIn set

### ✓ EVENTS
- [x] View Registrations - Table display only
  - Status badges: confirmed, waitlisted, cancelled, pending
  - Read-only in current view

### ✓ DOCUMENTS
- [x] Version History - Table display only
  - Loading: Skeleton
  - Empty state: EmptyState component
  - Read-only

- [x] Access Log - Table display only
  - Columns: User, Action, Date, IP Address
  - Read-only

### ✓ ELECTIONS
- [x] Edit Election - Link (draft only)
  - Route: /elections/{id}/edit
  - Gate: status === 'draft'

- [x] Open Nominations - 2-step button
  - Step 1: Click button
  - Step 2: Click again (confirmAction check)
  - API: openElectionNominationsMutation
  - Status: nominations_open
  - Confirmation: 2-step UI

- [x] Open Voting - 2-step button
  - Step 1: Click button
  - Step 2: Click again (confirmAction check)
  - API: openElectionVotingMutation
  - Status: voting_open
  - Gate: BR-33 - Disabled if !positionsReady (tooltip)
  - Confirmation: 2-step UI

- [x] Close Voting - 2-step button
  - API: certifyElectionMutation
  - Status: awaiting_confirmation
  - Confirmation: 2-step UI

- [x] Publish Results - 2-step button
  - API: certifyElectionMutation
  - Status: published
  - Confirmation: 2-step UI

- [x] Delete Candidate - Trash2 button
  - API: deleteCandidateMutation
  - Status: ⚠ Weak confirmation (implicit in modal)
  - Recommendation: Add explicit confirmation dialog

---

## ADMIN ROUTES - ACTION CHECKLIST

### ✓ ASSOCIATIONS
- [x] Create Association - Dialog form
  - API: createAssociationMutation
  - Fields: name (required), country (required), currency (required, [A-Z]{3})
  - Loading: isPending
  - Success: toast.success + dialog close

### ✓ FEATURE FLAGS
- [x] Create Flag - Dialog form
  - API: setFeatureFlagMutation
  - Fields: targetType, targetId, moduleName, enabled
  - Modules: person, booking, billing, audit, notifs, comms, storage, email, reviews
  - Loading: isPending
  - Success: toast.success + query invalidate

- [x] Delete Flag - Trash2 icon button
  - API: deleteFeatureFlagMutation
  - Status: 🚨 NO CONFIRMATION
  - Risk: Easy accidental deletion
  - Recommendation: Add confirmation dialog

### ✓ OPERATORS
- [x] Invite Operator - Dialog form
  - API: inviteAdminMutation
  - Fields: name (required), email (required)
  - Loading: isPending
  - Success: toast.success + query invalidate

- [x] Revoke Admin - Trash2 icon button
  - Step 1: Click Trash2 → setRevokeTarget(admin)
  - Step 2: Confirmation dialog opens
  - Step 3: Click "Revoke" button
  - API: revokeAdminMutation
  - Loading: isPending
  - Error: toast.error + state reset (setRevokeTarget(null))
  - Success: toast.success + query invalidate
  - Status: ✓✓ EXCELLENT - Proper destructive action flow

---

## CONFIRMATION PATTERN REFERENCE

### Pattern A: 2-Step In-Situ UI (Elections)
```
User clicks button
→ confirmAction state set
→ Same button text changes to "Confirm?"
→ User clicks again to execute
```
Examples: Open Nominations, Open Voting, Close Voting, Publish Results

### Pattern B: Dialog Confirmation (Refund, Revoke)
```
User clicks button
→ Step 1 dialog/form opens
→ User fills/confirms
→ Step 2 dialog opens with "Confirm" button
→ User clicks Confirm
→ API call executes
```
Examples: Refund payment, Revoke admin

### Pattern C: Form Validation (Status changes, Create)
```
User clicks button
→ Dialog/form opens
→ Required fields enforced
→ Submit button disabled until valid
→ User submits
```
Examples: Suspend (requires reason), Change Category (requires selection)

---

## LOADING STATE PATTERNS

| Pattern | Usage | Example |
|---------|-------|---------|
| Text Update | Most buttons | "Suspending..." vs "Suspend" |
| Button Disabled | All mutations | disabled={isPending} |
| Skeleton Loader | Async tables | <ListSkeleton rows={5} /> |
| Inline Error | Form fields | {errors.field && <Alert>} |

---

## DISABLED CONDITIONS QUICK REF

| Action | Disabled If | Type |
|--------|-----------|------|
| Add Member | isSubmitting | Form field |
| Send Reminders | sending | Button |
| Verify License | isPending | Button |
| Refund (Step 1) | !reason OR amountCents <= 0 OR !!amountError | Button |
| Refund (Step 2) | isPending | Button |
| Change Category | !newCategoryId OR isPending | Button + Select |
| Suspend | !suspendReason.trim() OR isPending | Button + Text field |
| Reinstate | isPending | Button |
| Mark Deceased | isPending | Button |
| Check-in | isPending | Button |
| Create Flag | isPending | Button |
| Delete Flag | isPending | Button |
| Invite Operator | isPending | Button |
| Revoke Admin | (Dialog) OR isPending | Button |
| Election Status | confirmAction !== nextStatus | Button |
| Open Voting | !positionsReady (BR-33) | Button |

---

## ERROR HANDLING PATTERNS

### Standard Toast Pattern
```javascript
onError: (err: unknown) => {
  const msg = err instanceof Error ? err.message : 'Failed to perform action'
  toast.error(msg)
}
```

### Smart Distinction Pattern (BR-17)
```javascript
onError: (err: any) => {
  const message = err?.body?.message ?? err?.message ?? 'Check-in failed'
  if (message.toLowerCase().includes('already')) {
    toast.warning('Already checked in')
  } else {
    toast.error(message)
  }
}
```

### State Reset on Error
```javascript
onError: () => {
  setRevokeTarget(null)  // Clears modal/dialog
}
```

---

## RISK MATRIX

| Risk | Severity | Action | File |
|------|----------|--------|------|
| Feature flag delete no confirmation | HIGH | Add confirmation dialog | feature-flags/index.tsx |
| Delete candidate weak confirmation | MEDIUM | Add explicit confirm button | election-detail.tsx |
| Roster add uses page reload | LOW | Convert to optimistic update | roster/index.tsx |
| BR-33 guard UI not visible | LOW | Ensure tooltip displays | election-detail.tsx |

---

## RECOMMENDED PATTERNS FOR NEW ACTIONS

### For Destructive Actions (Delete, Revoke, Refund)
```jsx
// Use Pattern B: Dialog Confirmation
<ConfirmDialog 
  title="Confirm {Action}"
  description="This cannot be undone."
  confirmText="Confirm {Action}"
  onConfirm={() => mutation.mutate()}
  isPending={mutation.isPending}
/>
```

### For Status Changes (Suspend, Terminate)
```jsx
// Use Pattern C: Form Validation
<Dialog>
  <form onSubmit={handleSubmit(onSubmit)}>
    <RequiredField name="reason" label="Reason" />
    <Button disabled={!formValid || isPending}>
      {isPending ? 'Processing...' : 'Confirm'}
    </Button>
  </form>
</Dialog>
```

### For State Transitions (Elections)
```jsx
// Use Pattern A: 2-Step In-Situ UI
{confirmAction === nextStatus ? (
  <div>
    <span>Confirm?</span>
    <Button onClick={() => mutation.mutate()}>Yes</Button>
  </div>
) : (
  <Button onClick={() => setConfirmAction(nextStatus)}>
    {nextAction.label}
  </Button>
)}
```

---

## ROLE-GATED ROUTES

| Route | Required Role |
|-------|---------------|
| /feature-flags/ | 'super' |
| /operators/ | 'super' |
| /associations/ | 'super' |
| /officer/* | authenticated |

---

## VALIDATION LIBRARY STACK

- **React Hook Form:** Form state management
- **Zod:** Schema validation
- **Sonner:** Toast notifications
- **TypeScript:** Type safety

---

End of Quick Reference
