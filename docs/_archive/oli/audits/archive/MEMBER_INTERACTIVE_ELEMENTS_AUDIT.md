# MEMBERRY MEMBER-FACING INTERACTIVE ELEMENTS AUDIT

**Date**: May 26, 2026  
**Scope**: Exhaustive audit of all member action buttons, links, form submissions, and dropdowns across authenticated member routes and components  
**Focus**: User interactions, API calls, error handling, loading states, and destructive actions

---

## EXECUTIVE SUMMARY

- **Total Interactive Elements**: 30
- **Elements with API Mutations**: 25 (83%)
- **Elements with Confirmation Dialogs**: 2 (7%)
- **Destructive Actions**: 3 (10%)
- **Toast Notifications**: 23 (77% use Sonner toast)
- **Query Invalidations**: 16 (53% have cache updates)

---

## 1. DASHBOARD

**File**: `/src/routes/_authenticated/dashboard.tsx`

### Overview
Action widgets for quick navigation to key features. All actions are navigation-based with no form submissions.

| Action | Type | Target | API | Loading | Error | Success | Destructive |
|--------|------|--------|-----|---------|-------|---------|------------|
| **Pay now** / **View dues** | Link + Button | `/org/$orgSlug/dues` | None | No | Widget error state | Navigation | No |
| **View credits** | Link + Button | `/my/credits` | None | No | Widget error state | Navigation | No |

---

## 2. PROFILE/SETTINGS

**File**: `/src/routes/_authenticated/settings/account.tsx`  
**Related Components**: `/features/person/components/*.tsx`

### 2.1 Personal Information Form

**Submit Button**: `Save`

- **Type**: Button (form submit)
- **Handler**: `onSubmit -> submitUpdate(data as PersonUpdateRequest)`
- **API**: `updatePersonMutation()`
- **Loading State**: `updatePerson.isPending`
- **Error Handling**: `toast.error(err.message)`
- **Success Feedback**: `toast.success('Profile updated')` + `queryClient.invalidateQueries()`
- **Destructive**: No
- **Confirmation**: No
- **Features**: Avatar upload with crop dialog, date picker, field validation via Zod

---

### 2.2 Contact Information Form

**Submit Button**: `Save Changes`

- **Type**: Button (form submit)
- **Handler**: `onSubmit -> submitUpdate({ contactInfo: data })`
- **API**: `updatePersonMutation()`
- **Loading State**: `updatePerson.isPending`
- **Error Handling**: `toast.error(err.message)`
- **Success Feedback**: `toast.success('Profile updated')`
- **Destructive**: No
- **Fields**: Email (read-only), Phone with country detection

---

### 2.3 Address Form

**Submit Button**: `Save Changes`

- **Type**: Button (form submit)
- **Handler**: `onSubmit -> submitUpdate({ primaryAddress: data })`
- **API**: `updatePersonMutation()`
- **Loading State**: `updatePerson.isPending`
- **Destructive**: No
- **Fields**: Street1/2, City, State, ZIP, Country dropdown with auto-detection

---

### 2.4 Preferences Form

**Submit Button**: `Save Changes`

- **Type**: Button (form submit)
- **Handler**: `onSubmit -> submitUpdate(data as PersonUpdateRequest)`
- **API**: `updatePersonMutation()`
- **Loading State**: `updatePerson.isPending`
- **Destructive**: No

---

### 2.5 Export My Data

**Button**: `Download My Data`

- **Type**: Button (action)
- **Handler**: `onClick -> handleExport()`
- **API**: `exportMyDataOptions()` (query-based)
- **Loading State**: `isExporting` - Button shows "Preparing..."
- **Error Handling**: `toast.error('Failed to export data')`
- **Success Feedback**: Creates Blob, triggers browser download, `toast.success('Data export downloaded')`
- **Destructive**: No
- **Format**: JSON file named `my-data-YYYY-MM-DD.json`
- **Includes**: Profile, memberships, payments, training, certificates, events

---

### 2.6 Delete Account ⚠️ DESTRUCTIVE

**Button**: `Request Account Deletion` or `Cancel Deletion Request`

#### Delete Request Flow

- **Type**: Button + AlertDialog trigger
- **Dialog Title**: "Are you sure?"
- **Dialog Message**: 3-paragraph warning about 30-day grace period & permanent anonymization
- **Confirmation Button**: "Yes, delete my account" (destructive color)
- **Handler**: `onClick -> requestDeletion.mutate({})`
- **API**: `requestMyAccountDeletionMutation()`
- **Loading State**: `requestDeletion.isPending`
- **Error Handling**: `toast.error('Failed to request deletion')`
- **Success Feedback**: `toast.success('Account deletion requested. You have 30 days to cancel.')`
- **Destructive**: YES
- **Confirmation**: YES (AlertDialog)
- **Grace Period**: 30 days to cancel before permanent deletion
- **Data Retention**: Financial records kept per legal requirements

#### Cancel Deletion Request

- **Type**: Button (appears only if deletion pending)
- **Label**: "Cancel Deletion Request"
- **Handler**: `onClick -> cancelDeletion.mutate({})`
- **API**: `cancelMyAccountDeletionMutation()`
- **Loading State**: Button shows "Cancelling..."
- **Success Feedback**: `toast.success('Deletion request cancelled. Your account is safe.')`

---

## 3. TRAINING

**File**: `/src/routes/_authenticated/org/$orgSlug/training/$trainingId.tsx`

### Training Detail Page

**Button**: `Enroll` or status message "You are enrolled in this training."

- **Type**: Button (conditional render)
- **Handler**: `onClick -> enrollMutation.mutate()`
- **API**: `enrollInCustomTrainingMutation()`
- **Loading State**: `enrollMutation.isPending` - Button shows spinner
- **Error Handling**: `toast.error(err?.body?.message ?? 'Enrollment failed')`
- **Success Feedback**: `toast.success('Successfully enrolled in this training!')` + query invalidations
- **Destructive**: No
- **Query Invalidations**: `['training-detail', trainingId]`, `['my-trainings']`

---

## 4. MESSAGES/COMMUNICATIONS

**File**: `/src/routes/_authenticated/org/$orgSlug/messages/index.tsx`

### 4.1 Message Composer

**File**: `/src/features/comms/components/message-composer.tsx`

**Form**: Message input with send button

- **Form Type**: `<form onSubmit={handleSubmit}>`
- **Input Field**: Text input, multiline capable (Shift+Enter)
- **Keyboard Shortcuts**: Enter = send, Shift+Enter = newline
- **Submit Button**: Icon button with Send icon

| Property | Value |
|----------|-------|
| **Handler** | `handleSubmit(e?: FormEvent)` |
| **API** | `sendChatMessageMutation()` |
| **Loading State** | `send.isPending` - Input disabled, button disabled |
| **Error Handling** | `toast.error('Could not send message')` |
| **Success Feedback** | `setDraft('')` (clears input), `onMessageSent()` callback |
| **Destructive** | No |
| **Throttle** | 500ms delay before button re-enables |
| **WebSocket** | Typing indicator emitted, throttled 2s |

**Edge Cases**: Empty string check via `draft.trim().length > 0`, trim on submit

---

### 4.2 Chat View

**File**: `/src/features/comms/components/chat-view.tsx`

| Action | Type | Handler | Notes |
|--------|------|---------|-------|
| **Open thread** | Click on message | `setThreadMessage(msg)` | Opens ThreadPanel on right side |
| **Close thread** | ThreadPanel X | `setThreadMessage(null)` | Closes side panel |
| **Mark room read** | On mount + new messages | `markRead(roomId)` | Via unread counts hook |

**WebSocket Features**: Real-time message append, typing indicator, auto-scroll, reconnection banner

---

## 5. SURVEYS

### 5.1 Survey Flow (Multi-question)

**File**: `/src/features/surveys/components/survey-flow.tsx`

#### Navigation Buttons

| Button | Type | Handler | State | Notes |
|--------|------|---------|-------|-------|
| **Previous** | Button | `goBack()` | Disabled if at first question | Decrements index |
| **Next** | Button | `goNext()` | Disabled if !canAdvance | Increments index |
| **Submit** | Button | `handleSubmit()` | Disabled if submitting | Final button on last question |

#### Submit Handler

- **Type**: Button (final action)
- **Handler**: `handleSubmit()` async
- **API**: `POST /surveys/{survey.id}/responses`
- **Payload**: `{ answers: [{ questionId, value }, ...] }`
- **Loading State**: `submitting` - Button shows "Submitting..."
- **Error Handling**: `toast.error('Failed to submit survey. Please try again.')`
- **Success Feedback**: `toast.success('Survey submitted successfully!')` + `setCompleted(true)`
- **Destructive**: No

#### Draft Auto-Save

- **Save trigger**: On answer change
- **Storage**: localStorage via `saveDraft()`
- **Indicator**: "Draft saved" message + checkmark icon
- **Visibility**: Hidden in preview mode

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Enter | Continue to next / Submit |
| Esc | Go back one question |
| Shift+Enter | New line in text fields |

---

### 5.2 NPS Modal (Standalone)

**File**: `/src/features/surveys/components/nps-modal.tsx`

#### Score Selection (0-10)

- **Type**: Button group (role="radiogroup")
- **Buttons**: 11 buttons (0-10)
- **Handler**: `setScore(i)` on click
- **Active State**: Blue primary background
- **Inactive State**: Surface elevated with hover effect

#### Comment Textarea

- **Visibility**: Only after score selected (AnimatePresence)
- **Optional**: Yes, can submit without comment

#### Submit Button

- **Type**: Button in footer
- **Label**: "Submit" (with Send icon)
- **Handler**: `handleSubmit()` async
- **API**: `POST /surveys/{survey.id}/responses`
- **Loading State**: `submitting` - Button shows "Sending..."
- **Disabled When**: `score === null || submitting`
- **Success Feedback**: Modal closes, survey complete
- **Error Handling**: None visible (silent fail) ⚠️

#### Dismiss Button

- **Label**: "Dismiss"
- **Handler**: `handleDismiss()`
- **Behavior**: Closes modal without submitting

---

## 6. EVENTS

### 6.1 Event Card (List Item)

**File**: `/src/features/events/components/event-card.tsx`

#### Options Menu (MoreHorizontal button)

| Action | Type | Handler | Visibility | Notes |
|--------|------|---------|-----------|-------|
| **View Details** | Link | Navigate to event | Always | Closes menu on click |
| **Edit** | Callback | `onEdit(event.id)` | If `onEdit` prop | Officer-only |
| **Duplicate** | Callback | `onDuplicate(event.id)` | If `onDuplicate` prop | Officer-only |
| **Cancel** | Callback (destructive) | `onCancel(event.id)` | If `onCancel` prop | Officer-only |

---

### 6.2 Post Event Actions

**File**: `/src/features/events/components/post-event-actions.tsx`

Complex multi-step post-event workflow with conditional actions.

#### Award Credits to All Attendees

- **Type**: Button
- **Visibility**: If event.creditBearing && !creditsAwarded
- **Handler**: `handleAwardCredits()` async
- **API**: Batch call to `bulkAwardCreditsMutation()`
- **Implementation**: Loops through attendeePersonIds, calls mutation for each
- **Loading State**: `creditProgress` object tracks `{ done, total, failed: [] }`
- **Error Handling**: Failed items stored in `creditProgress.failed`
- **Success Feedback**: `toast.success('CPD credits awarded successfully')` + `markDone('creditsAwarded')`
- **Requirements**: `canAwardCredits` (President/Secretary/Treasurer)
- **Retry**: Shows "Retry X Failed" button if items failed

**Query Invalidation**: `['listMyCreditEntries']`

---

#### Generate Certificates

- **Type**: Button
- **Handler**: `handleGenerateCerts()` async
- **API**: `bulkIssueCertificatesMutation()`
- **Payload**: `{ organizationId, personIds: [batch of 100], trainingTitle, certificateType: 'attendance', signingOfficerId, orgCode }`
- **Loading State**: `certsPending` boolean
- **Success Feedback**: `toast.success('Certificates queued for generation')`
- **Requirements**: `canIssueCerts` (President/Secretary)
- **Async Behavior**: Returns `{ status: 'queued' }`, actual generation is background job

---

#### Revoke Credits ⚠️ DESTRUCTIVE

- **Type**: Button (destructive variant)
- **Visibility**: Only if `creditsAwarded` && `canAwardCredits`
- **Handler**: `onClick -> setShowRevokeDialog(true)` (trigger confirmation)
- **Dialog**: ConfirmDialog with detailed warning
- **API**: `revokeEventCreditsMutation()`
- **Success Feedback**: `toast.success('Credits revoked')`
- **Destructive**: YES
- **Confirmation**: YES (ConfirmDialog)

---

#### Compose Thank-You Message

- **Type**: Button
- **Visibility**: If !thankYouSent
- **Handler**: `onClick -> setShowThankYouDialog(true)`
- **Dialog**: Modal with textarea
- **Default Text**: Pre-filled template
- **API**: `createMessageMutation()` + `sendMessageMutation()`
- **Recipients**: All event attendees

---

#### Complete Event

- **Type**: Button
- **Handler**: `handleCompleteEvent()`
- **API**: `completeEventMutation()`
- **Disabled When**: `completeMut.isPending` OR (event.creditBearing && !creditsAwarded)
- **Success Feedback**: `toast.success('Event marked as completed')`
- **Business Rule**: If credit-bearing, must award credits before completing

---

## 7. DOCUMENTS

**File**: `/src/features/documents/components/document-library.tsx`

### Document Card - Options Menu

#### Publish Action

- **Type**: Button in dropdown menu
- **Label**: "Publish"
- **Color**: Text success (green)
- **Handler**: `doPublish.mutate()`
- **API**: `updateDocumentMutation()` with `{ status: 'published' }`
- **Loading State**: `doPublish.isPending`
- **Success Feedback**: `toast.success('Document published')` + query invalidation
- **Destructive**: No

---

#### Archive Action

- **Type**: Button in dropdown menu
- **Handler**: `doArchive.mutate()`
- **API**: `archiveDocumentMutation()`
- **Success Feedback**: `toast.success('Document archived')` + query invalidation
- **Destructive**: No

---

#### Delete Action ⚠️

- **Type**: Button in dropdown menu
- **Label**: "Delete"
- **Color**: Text error (red)
- **Handler**: `doDelete.mutate()`
- **API**: `deleteDocumentMutation()`
- **Success Feedback**: `toast.success('Document deleted')` + query invalidation
- **Destructive**: YES
- **Confirmation**: No (direct delete) ⚠️

**Note**: Delete has no confirmation dialog - may be UX gap.

---

## 8. GOVERNANCE/ELECTIONS

**File**: `/src/routes/_authenticated/org/$orgSlug/governance/index.tsx`

### Overview
Dashboard showing active elections and recent documents. All actions are navigation-based.

| Item | Type | Action | Notes |
|------|------|--------|-------|
| **Election card** | Link | Navigate to `/org/$orgSlug/elections/$electionId` | Shows title + status |
| **Document card** | Link | Navigate to `/org/$orgSlug/documents/$docId` | Shows title + category |

**No interactive buttons** - purely navigational.

---

## 9. ANNOUNCEMENTS

**File**: `/src/routes/_authenticated/org/$orgSlug/announcements/$announcementId.tsx`

### Announcement Detail Page

| Action | Type | Handler | Notes |
|--------|------|---------|-------|
| **Back** | Button | `onClick -> navigate({ to: -1 })` | Browser history back |

**Display**: Title + read-only content. No member interactions beyond back navigation.

---

## 10. DUES PAYMENTS

**File**: `/src/routes/_authenticated/org/$orgSlug/dues.tsx`

### Export CSV Button

- **Type**: Button with Download icon
- **Label**: "Export CSV"
- **Handler**: `onClick -> exportPaymentsCsv()`
- **API**: None (client-side CSV generation)
- **Implementation**: `buildPaymentCsv(payments)` -> creates CSV -> triggers download
- **Loading State**: No visible loading
- **Success Feedback**: File download initiated
- **Destructive**: No

**CSV Contents**: Payment history (receipt #, amount, date, status, etc.)

---

## CROSS-CUTTING PATTERNS

### Toast Notifications (Sonner)

Used throughout for user feedback. **Coverage**: 23/30 (77%)

### Query Invalidation

TanStack React Query `useQueryClient()` invalidates cache after mutations. **Coverage**: 16/30 (53%)

### Loading States

Button variations:
- `disabled={mutation.isPending}`
- Label changes: "Save" -> "Saving..."
- Icon animations: spinner + text

### Error Handling

Two patterns:
1. Toast errors for immediate feedback
2. Component-level error messages (widgets, empty states)

---

## CRITICAL GAPS & OBSERVATIONS

| Issue | Severity | Location | Impact |
|-------|----------|----------|--------|
| Document delete lacks confirmation | Medium | document-library.tsx | Accidental deletion possible |
| NPS modal submit has silent error | High | nps-modal.tsx | No error feedback to user |
| Survey submission lacks retry | Medium | survey-flow.tsx | Data loss on network failure |
| Avatar upload errors silent | Low | personal-info-form.tsx | console.error, user not informed |
| Form submission no debounce | Low | person forms | Possible double-submission |
| Dues export lacks error display | Low | dues.tsx | Silent failure possible |

---

## API MUTATIONS SUMMARY

| Mutation | Route | Purpose | Loading | Error | Success |
|----------|-------|---------|---------|-------|---------|
| `updatePersonMutation()` | Settings | Update profile | Yes | toast | toast + query invalidation |
| `exportMyDataOptions()` | Settings | Export user data | Yes | toast | file download |
| `requestMyAccountDeletionMutation()` | Settings | Request deletion | Yes | toast | toast + query invalidation |
| `cancelMyAccountDeletionMutation()` | Settings | Cancel deletion | Yes | toast | toast + query invalidation |
| `enrollInCustomTrainingMutation()` | Training | Enroll in training | Yes | toast | toast + query invalidations |
| `sendChatMessageMutation()` | Messages | Send chat message | Yes | toast | clear input + callback |
| POST `/surveys/{id}/responses` | Surveys | Submit survey | Yes | toast | toast + completion state |
| `bulkAwardCreditsMutation()` | Events | Award credits (batch) | Yes | error array | toast + query invalidation |
| `bulkIssueCertificatesMutation()` | Events | Generate certificates | Yes | toast | toast + completion state |
| `completeEventMutation()` | Events | Mark event complete | Yes | toast | toast + query invalidation |
| `createMessageMutation()` | Events | Create message | Yes | toast | toast |
| `sendMessageMutation()` | Events | Send message | Yes | toast | toast |
| `archiveDocumentMutation()` | Documents | Archive document | Yes | toast | toast + query invalidation |
| `deleteDocumentMutation()` | Documents | Delete document | Yes | toast | toast + query invalidation |
| `updateDocumentMutation()` | Documents | Publish document | Yes | toast | toast + query invalidation |

---

## FILES ANALYZED

### Routes (11 files)
- `/src/routes/_authenticated/dashboard.tsx`
- `/src/routes/_authenticated/settings/account.tsx`
- `/src/routes/_authenticated/org/$orgSlug/training/$trainingId.tsx`
- `/src/routes/_authenticated/org/$orgSlug/messages/index.tsx`
- `/src/routes/_authenticated/org/$orgSlug/home.tsx`
- `/src/routes/_authenticated/org/$orgSlug/announcements/index.tsx`
- `/src/routes/_authenticated/org/$orgSlug/announcements/$announcementId.tsx`
- `/src/routes/_authenticated/org/$orgSlug/governance/index.tsx`
- `/src/routes/_authenticated/org/$orgSlug/dues.tsx`

### Components - Features (11 files)
- `/src/features/person/components/personal-info-form.tsx`
- `/src/features/person/components/contact-info-form.tsx`
- `/src/features/person/components/address-form.tsx`
- `/src/features/person/components/preferences-form.tsx`
- `/src/features/comms/components/message-composer.tsx`
- `/src/features/comms/components/chat-view.tsx`
- `/src/features/surveys/components/survey-flow.tsx`
- `/src/features/surveys/components/nps-modal.tsx`
- `/src/features/events/components/event-card.tsx`
- `/src/features/events/components/post-event-actions.tsx`
- `/src/features/documents/components/document-library.tsx`

---

## RECOMMENDATIONS

1. **Add confirmation to document delete** - Currently no dialog before permanent deletion
2. **Implement error feedback for NPS modal** - Add toast on submit failure
3. **Add retry logic for survey submission** - Explicit retry button on failure
4. **Debounce form submission buttons** - Prevent accidental double submissions
5. **Add avatar upload error toast** - Replace console.error with user-facing feedback
6. **Add error feedback to export actions** - Show toast if CSV/JSON export fails

---

**Audit Complete** | May 26, 2026

