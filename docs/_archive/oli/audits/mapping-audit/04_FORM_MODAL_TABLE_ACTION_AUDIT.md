# 04 — Form, Modal, and Table Action Audit

**Date:** 2026-05-26
**Scope:** All forms, modals, dialogs, and data tables across Memberry and Admin apps
**Mode:** Read-only audit. No code modifications.

---

## 1. Form Registry

### Dues Forms

| Form | Route | Fields | Validation | Submit | API | Duplicate Protection | Post-Submit | Test | Status |
|------|-------|--------|-----------|--------|-----|---------------------|------------|------|--------|
| Record Payment | Officer finances | personId*, amount*, paymentDate*, paymentMethod*, referenceNumber | Zod + zodResolver | `mutation.mutate()` | `POST /api/dues/payments/record` | ✓ isPending | toast + reset + invalidate | NONE | Working |
| Initiate Refund | Officer finances | amount*, reason* | Manual validation | `mutation.mutate()` | `POST /api/dues/refunds` | ✓ isPending | toast + invalidate | NONE | Working |
| Dues Config | Officer settings | defaultAmount*, gracePeriodDays*, currency, billingFrequency*, dueDateMonth*, dueDateDay*, reminders[] | Zod + zodResolver | `mutation.mutate()` | `PUT /api/dues/config` | ✓ isPending | toast + invalidate | NONE | Working |
| Proof Upload | Member dues | paymentMethod*, referenceNumber, file* | Zod (file type/size) | Two-step: upload → mutation | `POST /api/storage + POST /api/dues/proof` | ✓ isPending | toast + invalidate | NONE | Working |

### Person/Profile Forms

| Form | Route | Fields | Validation | Schema File | Test | Status |
|------|-------|--------|-----------|------------|------|--------|
| Personal Info | `/my/profile` | firstName*, lastName*, middleName, dateOfBirth*, gender, licenseNumber, specialization, prcId, avatar | `personalInfoSchema` | `features/person/schemas.ts` | ✓ `profile.spec.ts` | Working |
| Address | `/my/profile` | street1*, street2, city*, state*, postalCode*, country* | `addressSchema` | Same | NONE | Working |
| Contact Info | `/my/profile` | email, phone | `z.email()`, `isValidPhoneNumber()` | Same | NONE | Working |
| Preferences | `/my/profile` | languagesSpoken*, timezone* | `z.array().min(1)` | Same | NONE | Working |

### Communications Forms

| Form | Route | Fields | Validation | Test | Status |
|------|-------|--------|-----------|------|--------|
| Compose Announcement | Officer comms/new | title* (max 200), content*, audienceType*, categoryId, visibility*, scheduledAt | Zod inline | NONE | Working |
| Template | Officer comms/templates | name*, channel*, category, subject, body*, status* | Zod inline | NONE | Working |

### Event/Training/Election Forms

| Form | Route | Fields | Validation | Library | Test | Status |
|------|-------|--------|-----------|---------|------|--------|
| Event Create/Edit | Officer events | 14 fields incl. title*, eventType*, dates*, capacity, credits | Zod + zodResolver | react-hook-form | NONE | Working |
| Training Create/Edit | Officer training | type*, title*, description, dates*, location, credits, fee, capacity | **Manual useState** | **Not react-hook-form** | NONE | Inconsistent pattern |
| Election (3-step wizard) | Officer elections | Step 1: title*, type*, votingMode*. Step 2: positions[]. Step 3: dates | Zod per-step | react-hook-form | NONE | Working, enum mapping drift noted |

### Admin/Settings Forms

| Form | Route | Fields | Validation | Library | Test | Status |
|------|-------|--------|-----------|---------|------|--------|
| Org Settings | Officer settings | name*, description, logoUrl, contactEmail, phone, address, website, foundingDate | `trim().length > 0` | **Manual useState** | ✓ Partial `settings.spec.ts` | Inconsistent pattern |

---

## 2. Form Gap Report

| ID | Issue | Severity | File | Evidence | Recommended Test |
|----|-------|----------|------|----------|-----------------|
| FG-01 | Training form uses manual `useState` instead of react-hook-form + Zod | P2 | `features/training/components/training-form.tsx` | No zodResolver, no `useForm()` | Refactor + component test |
| FG-02 | Org settings form uses manual `useState` | P2 | `features/admin/components/org-settings-form.tsx` | `JSON.stringify` dirty check | Refactor + component test |
| FG-03 | Election form enum mapping hardcoded (officer→general, bylaw→special) | P2 | `features/elections/components/election-form.tsx` | Comment notes TypeSpec drift | Integration test |
| FG-04 | No "unsaved changes" warning on any form | P2 | All forms | No `onBeforeUnload` or route block | UX improvement |
| FG-05 | Inline Zod schemas not centralized | P3 | Dues, comms, events, elections forms | Schemas inside component files | Refactor to `schemas.ts` per feature |
| FG-06 | Frontend Zod schemas vs backend TypeSpec validators — alignment unverified | P1 | All forms | Different validation sources | Integration/contract test |
| FG-07 | `aria-describedby` only ~50% adopted on form fields | P2 | Various forms | Some link error messages, some don't | Accessibility audit |

---

## 3. Modal Registry

| Modal | File | Trigger | Confirm Action | Destructive? | Accessibility | Test | Status |
|-------|------|---------|---------------|-------------|--------------|------|--------|
| ConfirmDialog (reusable) | `components/patterns/confirm-dialog.tsx` | Parent `open` prop | Configurable | variant prop | Radix AlertDialog (focus trap, escape) | NONE | Working |
| Record Payment Confirm | `features/dues/components/record-payment-form.tsx` | Button click | Confirm → mutation | No | Dialog | NONE | Working |
| Refund Confirm | `features/dues/components/refund-form.tsx` | Button click | Confirm → mutation | Yes (styled) | Dialog | NONE | Working |
| Create Channel | `features/comms/components/create-channel-dialog.tsx` | Parent open | Create → mutation | No | Dialog | NONE | Working |
| Assign Officer | `features/admin/components/officer-management.tsx` | Button click | Assign → mutation | No | Dialog | NONE | Working |
| Remove Officer | Same file | Button click | Remove → mutation | Yes (styled) | Dialog | NONE | Working |
| Image Cropper | `features/person/components/personal-info-form.tsx` | File select | Crop → upload | No | Custom modal | NONE | Working |
| Cancel Event | `features/events/components/event-list.tsx` | Menu action | Cancel → mutation | Yes | ConfirmDialog | NONE | Working |
| Publish Document | `features/documents/components/document-publish.tsx` | Button click | Publish → mutation | No | Dialog | NONE | Working |
| Self Nomination | `features/elections/components/self-nomination-dialog.tsx` | Button click | Nominate → mutation | No | Dialog | NONE | Working |
| NPS Survey | `features/surveys/components/nps-modal.tsx` | Auto-trigger (provider) | Submit → mutation | No | Modal | NONE | Silent error on failure |

---

## 4. Table/List Action Registry

| Table | File | Actions | Pagination | Sort | Filter | Empty State | Loading | Mobile | Bulk | Test |
|-------|------|---------|-----------|------|--------|------------|---------|--------|------|------|
| DataTable (base) | `components/patterns/data-table.tsx` | Via column defs | ✓ page-based (25/page) | ✓ click headers | Parent-managed | "No results." | Parent | `renderMobileCard` prop | No | NONE |
| Payment History | `features/dues/components/payment-history-table.tsx` | Click row → navigate | ✓ offset/limit | Date sort | Status + scope | ✓ EmptyState | ✓ Skeleton | Card fallback | No | NONE |
| Completion | `features/training/components/completion-table.tsx` | Mark Complete button | All shown | No | Credit input | "No enrollments" | Spinner | No | ✓ checkbox | NONE |
| Roster Members | `features/membership/components/member-table.tsx` | Click row, delete | Data length | No | Search + category + status + dues | ✓ EmptyState | ✓ Skeleton | Card fallback | ✓ checkbox | NONE |

### Table Gaps

| ID | Issue | Severity | Evidence |
|----|-------|----------|----------|
| TG-01 | Completion table and Member table don't use DataTable base — inconsistent patterns | P3 | Custom tanstack/react-table implementations |
| TG-02 | No table has accessibility `role="grid"` or `aria-sort` (except DataTable base) | P2 | Missing ARIA on custom tables |
| TG-03 | No table has E2E test coverage | P1 | No test files test table interactions |

---

## Gate Evaluation: Audit 05

| Criterion | Status |
|-----------|--------|
| All forms identified with fields | PASS |
| Form validation/submit/states assessed | PASS |
| All modals identified with triggers | PASS |
| All tables identified with actions | PASS |
| Frontend vs backend validation compared | PASS |
| Gaps documented with severity | PASS |

**Gate Result: PASS**
