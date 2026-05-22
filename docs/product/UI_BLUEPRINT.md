# UI Blueprint - Memberry Product App

> Generated from code analysis of `apps/memberry/src/features/` (50 components across 15 modules).
> Date: 2026-05-20

---

## Component Inventory

| Module | Component | Type | States Handled | ARIA | Form Schema |
|--------|-----------|------|---------------|------|-------------|
| **account** | DataExport | page | loading, empty, error, success, rate-limited | -- | -- |
| **admin** | OfficerDashboard | page | loading, error, partial, skeleton, empty (all-clear) | `role="alert" aria-live="polite"` on error | -- |
| **admin** | OfficerManagement | list+dialog | loading, empty, skeleton | -- | -- |
| **admin** | OrgSettingsForm | form | loading, editing, saving, skeleton | -- | inline validation (name required) |
| **certificates** | CertificateList | list | loading, empty, skeleton | -- | -- |
| **certificates** | CertificatePreview | detail | loading, error (not-found) | -- | -- |
| **chapters** | AffiliationList | list | loading, error, empty | `role="alert" aria-live="polite"` on error | -- |
| **communications** | AnnouncementList | list | loading, empty (filtered/unfiltered), skeleton | -- | -- |
| **communications** | ComposeForm | form | loading, error (server), success | `role="alert" aria-live="polite"` on server error; `aria-describedby` on inputs; `role="alert"` on field errors | `composeSchema`: title (1-200), content (required), audienceType (all/by_category), channelPush (bool), channelEmail (bool), visibility (internal/network), scheduledAt (optional) |
| **dashboard** | MemberDashboard | page | loading, empty (per section), skeleton | -- | -- |
| **dashboard** | ActionWidget | widget | error, success, warning, neutral | `role="alert" aria-live="polite"` on error; `role="img" aria-label` on status dot; `sr-only` text | -- |
| **dashboard** | AlertBanner | banner | conditional render (null if no alerts) | `role="alert"`; `aria-hidden="true"` on icons | -- |
| **dashboard** | CreditBreakdown | widget | error, empty | `role="alert" aria-live="polite"` on error; `aria-hidden="true"` on decorative icons | -- |
| **dashboard** | OrgAnnouncements | widget | error, empty | `role="alert" aria-live="polite"` on error; `aria-hidden="true"` on icons | -- |
| **dashboard** | QuickActions | widget | static (always renders) | `aria-hidden="true"` on icons | -- |
| **directory** | DirectorySearch | list | loading, empty, error, skeleton | -- | -- |
| **dues** | DuesConfigForm | form | loading, saving, skeleton | `aria-describedby` on inputs; `role="alert"` on field errors | `duesConfigSchema`: defaultAmount (positive number), gracePeriodDays (int 0-90) |
| **dues** | DuesInvoiceList | list | loading, error, empty, skeleton | `role="alert" aria-live="polite"` on error | -- |
| **dues** | FinancialDashboard | page | loading, error, skeleton | `role="alert" aria-live="polite"` on error | -- |
| **dues** | FundAllocationEditor | editor | validation (total must = 100%) | `aria-label="Move fund up"` on reorder button | -- |
| **dues** | FundAllocationPreview | display | empty (no funds) | -- | -- |
| **dues** | GatewaySetup | form+dialog | loading, connected, not-connected, testing, saving, skeleton | -- | inline validation (publicKey, secretKey required; test must pass before save) |
| **dues** | PaymentHistoryTable | list | loading, empty, skeleton, paginated | -- | -- |
| **dues** | PendingProofsList | list | loading, error, empty, skeleton | `role="alert" aria-live="polite"` on error | -- |
| **dues** | ProofUploadForm | form | loading, uploading, success | `aria-describedby` on select; `role="alert"` on field errors | `proofUploadSchema`: paymentMethod (required), referenceNumber (optional) |
| **dues** | RecordPaymentForm | form+dialog | loading, searching, saving | `aria-describedby` on inputs; `role="alert"` on field errors | `recordPaymentSchema`: amount (positive number), paymentDate (required), paymentMethod (required), referenceNumber (optional) |
| **dues** | RefundForm | form+dialog | expanded/collapsed, saving | -- | inline validation (amount <= max, reason required) |
| **dues** | ReportResults | display | loading, empty (no data/no results), skeleton | -- | -- |
| **dues** | ReportSelector | selector | selected state | -- | -- |
| **elections** | ElectionList | list | loading, error, empty, skeleton | -- | -- |
| **elections** | ElectionDetail | detail | loading, error, skeleton | `role="alert" aria-live="polite"` on error; `aria-label="Remove nominee"` on buttons | -- |
| **elections** | ElectionForm | form (multi-step) | loading, saving, server-error | `aria-describedby` on inputs; `role="alert" aria-live="polite"` on server error; `role="alert"` on field errors; `aria-label="Remove position"` | `electionBasicsSchema`: title (required), type (officer/bylaw), votingMode (online/in_person/hybrid), passageThreshold (optional), nomination/voting dates (optional) |
| **elections** | MemberElectionDetail | detail | loading, error, voted/not-voted | `role="alert" aria-live="polite"` on error | -- |
| **elections** | MemberElectionList | list | loading, error, empty (per tab), skeleton | -- | -- |
| **elections** | NomineePickerDialog | dialog | loading, empty, skeleton | -- | -- |
| **elections** | VotingBallot | form | loading, error, already-voted, voting-closed, submitting | `role="alert" aria-live="polite"` on error; `aria-hidden="true"` on decorative icons | -- |
| **events** | EventList | list | loading, error, empty (filtered/unfiltered), skeleton | `role="alert" aria-live="polite"` on error | -- |
| **events** | EventForm | form | loading, saving, server-error | `role="alert" aria-live="polite"` on server error; `aria-describedby` on inputs; `role="alert"` on field errors | `eventSchema`: title (required), eventType (required), description (optional), startDate (required), endDate (required), location (optional), registrationFee (>=0), capacity (optional positive int), visibility (internal/network), status (draft/published) |
| **events** | EventCard | card | menu-open | `aria-label="Actions"` on menu button | -- |
| **events** | AttendanceView | list | loading, empty, check-in error/success | `role="alert" aria-live="polite"` on check-in error | -- |
| **membership** | MemberTable | list | loading, error, empty, skeleton, paginated, bulk-selected | `role="alert" aria-live="polite"` on error; `aria-label="Select all"` / `aria-label="Select {name}"` on checkboxes | -- |
| **membership** | MemberDetail | detail | loading, error (Alert destructive), skeleton | Alert with AlertDescription on error; status banners per membership state | -- |
| **membership** | ApplicationList | list | loading, error, empty, skeleton, bulk-selected | `aria-label="Select all approvable applications"` / `aria-label="Select {name}"` on checkboxes | -- |
| **membership** | CategoryEditor | list+dialog | loading, error, empty, skeleton | `role="alert" aria-live="polite"` on error | inline form (name required, duesAmount required) |
| **membership** | MembershipList | list | loading, error, empty | `role="alert" aria-live="polite"` on error | -- |
| **notifications** | NotificationInbox | list | loading, error, empty (global/filtered) | -- | -- |
| **training** | TrainingList | list | loading, error, empty, skeleton | `role="alert" aria-live="polite"` on error | -- |
| **training** | TrainingForm | form | saving, error | -- | inline form (title required, startDate required) |
| **training** | TrainingCard | card | menu-open | `aria-label="Actions"` on menu button | -- |
| **training** | CompletionTable | list | loading, empty, bulk-selected | `aria-label` on select-all checkbox (implicit) | -- |

---

## Per-Module Detail

### account

#### DataExport
- **Props:** none (standalone)
- **States:** loading (isRequesting), rate-limited (rateLimited), empty (no previous exports), success (export ready)
- **ARIA:** none
- **Key UI:** GlassCard explanation, rate-limited button with countdown, previous exports Table

---

### admin

#### OfficerDashboard
- **Props:** `{ orgId: string }`
- **States:** loading (3 parallel queries), error (partial results banner), skeleton (CardSkeleton x5), all-clear state
- **ARIA:** `role="alert" aria-live="polite"` on partial error banner
- **Key UI:** 5-metric StaggerGrid, conditional ActionCards (expiring dues, pending apps, grace period, low collection), QuickLinks grid

#### OfficerManagement
- **Props:** `{ orgId: string }`
- **States:** loading (TableSkeleton), empty (EmptyState in table), modal open/close, confirm-remove dialog
- **ARIA:** none explicit (Dialog handles focus trap via radix)
- **Key UI:** Officer table, AssignRoleModal (position Select + debounced member search), destructive remove confirmation Dialog

#### OrgSettingsForm
- **Props:** `{ orgId: string }`
- **States:** loading (Skeleton fields), view mode, edit mode, saving, dirty detection
- **ARIA:** none explicit
- **Key UI:** Two-column grid form with edit/save/cancel toggle, unsaved changes warning, FieldValue read-only display

---

### certificates

#### CertificateList
- **Props:** none (uses useOrgContext)
- **States:** loading (CardSkeleton x3), empty (EmptyState)
- **ARIA:** none
- **Key UI:** StaggerGrid of GlassCards with accent bar, certificate number badge, issued date

#### CertificatePreview
- **Props:** `{ certificateId: string }`
- **States:** loading (CardSkeleton x2), error/not-found
- **ARIA:** none
- **Key UI:** Formal certificate card with gradient accent, verification URL, Download PDF + Copy Verification Link buttons

---

### chapters

#### AffiliationList
- **Props:** `{ orgId: string, tenantId: string }`
- **States:** loading, error, empty
- **ARIA:** `role="alert" aria-live="polite"` on error
- **Key UI:** Simple Table (member, chapter, primary, status, joined)

---

### communications

#### AnnouncementList
- **Props:** `{ orgId: string }`
- **States:** loading (Skeleton x4), empty (filtered vs unfiltered copy), tab filtering
- **ARIA:** none
- **Key UI:** 3 stat cards, status tab bar (all/sent/scheduled/draft/archived), search Input, announcement rows with status badges

#### ComposeForm
- **Props:** `{ orgId: string, existingAnnouncement?: {...} }`
- **Zod Schema:** `composeSchema` - title (1-200 chars), content (required), audienceType (all | by_category), channelPush (bool, default true), channelEmail (bool, default false), visibility (internal | network), scheduledAt (optional string)
- **States:** server error, submitting (3 actions: send/schedule/draft)
- **ARIA:** `role="alert" aria-live="polite"` on server error; `aria-describedby` linking inputs to errors/hints; `role="alert"` on individual field errors
- **Key UI:** Title with char counter, content Textarea, audience toggle buttons, channel Switches, visibility toggle, schedule datetime, 4 action buttons

---

### dashboard

#### MemberDashboard
- **Props:** none
- **States:** loading (per section), empty (per section)
- **ARIA:** none explicit
- **Key UI:** Organization MembershipCards with StatusBadge + officer link + pay dues CTA; 3-column grid (events, trainings, notifications)

#### ActionWidget
- **Props:** `{ icon, label, value, subtitle?, status?, statusLabel?, action?, errorMessage?, children?, className? }`
- **States:** error (errorMessage renders error card), normal (value display)
- **ARIA:** `role="alert" aria-live="polite"` on error variant; `role="img" aria-label` on status dot; `sr-only` for screen reader status text; `aria-hidden="true"` on decorative icons
- **Key UI:** Glass elevated card with status indicator dot, CountUp value, optional CTA link

#### CreditRing (co-located with ActionWidget)
- **Props:** `{ earned: number, required: number, size?: number }`
- **ARIA:** `role="img" aria-label="{earned} of {required} credits earned"`
- **Key UI:** SVG donut ring with animated stroke-dashoffset, color-coded by progress

#### AlertBanner
- **Props:** `{ memberships, invoices, elections }`
- **States:** null (no alerts), renders highest-priority alert
- **ARIA:** `role="alert"`; `aria-hidden="true"` on icons
- **Key UI:** Priority-sorted alert with variant styles (error/warning/info), action link

#### CreditBreakdown
- **Props:** `{ totalCredits: number, requiredCredits: number, isError?: boolean }`
- **States:** error, empty (no credits), data loaded
- **ARIA:** `role="alert" aria-live="polite"` on error; `aria-hidden="true"` on icons
- **Key UI:** GlassCard with CreditRing, CountUp, deficit/requirement text, "Earn more credits" link

#### OrgAnnouncements
- **Props:** `{ announcements: Array<{...}>, orgNames: Record<string,string>, isError?: boolean }`
- **States:** error, empty, data (max 5 items)
- **ARIA:** `role="alert" aria-live="polite"` on error; `aria-hidden="true"` on icons
- **Key UI:** GlassCard with announcement items, relative date formatting, org name display

#### QuickActions
- **Props:** `{ duesOrgId?: string, eventsOrgId?: string }`
- **States:** static (always renders 6 actions)
- **ARIA:** `aria-hidden="true"` on icons
- **Key UI:** 3x6 grid of Link cards (Pay Dues, ID Card, Certificates, Events, Credits, Profile)

---

### directory

#### DirectorySearch
- **Props:** `{ orgId: string, tenantId: string }`
- **States:** loading (CardSkeleton x6), error, empty (with search term)
- **ARIA:** none
- **Key UI:** Search Input, card grid with avatar/name/title/specialty/location

---

### dues

#### DuesConfigForm
- **Props:** `{ orgId: string }`
- **Zod Schema:** `duesConfigSchema` - defaultAmount (positive number), gracePeriodDays (int 0-90)
- **States:** loading (Skeleton x3), saving, unsaved changes indicator
- **ARIA:** `aria-describedby` linking inputs to errors/hints; `role="alert"` on field errors
- **Key UI:** Two-section form (Default Dues + Reminder Schedule), currency/frequency/due-date selects, reminder rows with Switch + Checkbox channels

#### DuesInvoiceList
- **Props:** `{ orgId: string, tenantId: string }`
- **States:** loading (Skeleton x4), error, empty (EmptyState)
- **ARIA:** `role="alert" aria-live="polite"` on error
- **Key UI:** Invoice Table with status badges, "Mark Paid" action button

#### FinancialDashboard
- **Props:** `{ orgId: string }`
- **States:** loading (Skeleton x4), error
- **ARIA:** `role="alert" aria-live="polite"` on error
- **Key UI:** 4-metric StaggerGrid (collection rate, collected, outstanding, pending), conditional action cards (expiring, pending, gateway)

#### FundAllocationEditor
- **Props:** `{ funds: Fund[], onChange: (funds) => void, disabled?: boolean }`
- **States:** validation (total must = 100%)
- **ARIA:** `aria-label="Move fund up"` on reorder button
- **Key UI:** Reorderable fund rows (name Input + percentage Input), Add Fund button, total percentage indicator

#### FundAllocationPreview
- **Props:** `{ amountCents: number, funds: FundSplit[], currency?: string }`
- **States:** empty (no funds)
- **Key UI:** Fund line items with amounts, total row

#### GatewaySetup
- **Props:** `{ orgId: string }`
- **States:** loading (Skeleton), connected (with disconnect option), not-connected (setup form), testing, saving
- **ARIA:** none explicit (Dialog handles focus)
- **Key UI:** Connected/disconnected status cards with badges, provider Select, key inputs with show/hide toggle, test connection flow, destructive disconnect Dialog

#### PaymentHistoryTable
- **Props:** `{ orgId?: string, scope: 'member' | 'org' }`
- **States:** loading (Skeleton x5), empty (EmptyState with filter hint), paginated
- **ARIA:** none
- **Key UI:** Status/method filter Selects, striped Table with click-to-navigate rows, Previous/Next pagination

#### PendingProofsList
- **Props:** `{ orgId: string }`
- **States:** loading (ListSkeleton), error, empty (EmptyState)
- **ARIA:** `role="alert" aria-live="polite"` on error
- **Key UI:** GlassCards per proof with receipt info, proof thumbnail placeholder, Confirm/Reject buttons, rejection reason Input

#### ProofUploadForm
- **Props:** `{ invoiceId: string, invoiceAmount: number, currency?: string, orgId: string, onSuccess?: () => void }`
- **Zod Schema:** `proofUploadSchema` - paymentMethod (required), referenceNumber (optional)
- **States:** uploading, success
- **ARIA:** `aria-describedby` on select; `role="alert"` on field errors
- **Key UI:** Payment method Select (Controller), reference Input, drag-drop-style file upload zone (click to select), file validation (JPEG/PNG/PDF, max 10MB)

#### RecordPaymentForm
- **Props:** `{ orgId: string }`
- **Zod Schema:** `recordPaymentSchema` - amount (positive number), paymentDate (required), paymentMethod (required), referenceNumber (optional)
- **States:** searching members, saving, confirm dialog
- **ARIA:** `aria-describedby` on inputs; `role="alert"` on field errors
- **Key UI:** Two-column layout (form + fund allocation preview), debounced member search with dropdown, confirmation Dialog with amount display

#### RefundForm
- **Props:** `{ paymentId: string, maxAmount: number, currency: string }`
- **States:** collapsed (button only), expanded (form), confirm dialog, saving
- **ARIA:** none explicit
- **Key UI:** Expandable form with amount/reason inputs, max-amount validation, destructive confirmation Dialog

#### ReportResults
- **Props:** `{ type: string, data: any[] | null, summary: any | null, isLoading: boolean }`
- **States:** loading (Skeleton x5), no data (prompt text), empty results, data loaded
- **ARIA:** none
- **Key UI:** Summary Badge metrics, CSV export button, dynamic Table columns per report type (collection/fund_breakdown/dues_status/aging)

#### ReportSelector
- **Props:** `{ selected: string | null, onSelect: (type) => void }`
- **States:** selected highlight
- **Key UI:** 4-card grid (Collection Summary, Fund Breakdown, Dues Status, Aging Report) with icons and descriptions

---

### elections

#### ElectionList
- **Props:** `{ orgId: string }`
- **States:** loading (Skeleton x4), error, empty
- **Key UI:** 4 stat cards, election rows with type/status badges, chevron navigation

#### ElectionDetail
- **Props:** `{ electionId: string, orgId: string }`
- **States:** loading (Skeleton), error, multiple status-dependent views
- **ARIA:** `role="alert" aria-live="polite"` on error; `aria-label="Remove nominee"` on buttons
- **Key UI:** Status badge + type + voting mode, phase advancement button with inline confirmation, timeline grid, position/nominee cards with vote tally bars, NomineePickerDialog integration

#### ElectionForm
- **Props:** `{ orgId: string, electionId?: string, initialData?: ElectionInitialData, onSuccess?, onCancel? }`
- **Zod Schema:** `electionBasicsSchema` - title (required), type (officer/bylaw), votingMode (online/in_person/hybrid), passageThreshold (optional), nomination/voting dates (optional)
- **States:** multi-step (basics/positions/timeline), saving, server error
- **ARIA:** `aria-describedby` on title; `role="alert" aria-live="polite"` on server error; `role="alert"` on field errors; `aria-label="Remove position"` on buttons
- **Key UI:** 3-step wizard with step indicator, type/voting-mode toggle buttons, dynamic position list with add/remove, timeline date inputs

#### MemberElectionDetail
- **Props:** `{ electionId: string, orgId: string, userId?: string }`
- **States:** loading, error, voted/not-voted, voting-open CTA
- **ARIA:** `role="alert" aria-live="polite"` on error
- **Key UI:** Vote CTA banner (primary colored), "already voted" badge, timeline grid, position/nominee cards with vote bars, "Your vote" indicator

#### MemberElectionList
- **Props:** `{ orgId: string }`
- **States:** loading (Skeleton x3), error, empty (per tab)
- **Key UI:** Tabs (Active/Completed/All) with counts, election rows with status/type badges

#### NomineePickerDialog
- **Props:** `{ orgId: string, electionId: string, positionId: string, existingNomineePersonIds: string[], onClose: () => void }`
- **States:** loading (Skeleton x4), empty (no matches / no members)
- **Key UI:** Custom modal overlay (not Dialog), search Input with icon, member list with avatar initials, UserPlus selection icon

#### VotingBallot
- **Props:** `{ electionId: string, orgId: string, userId?: string }`
- **States:** loading (Skeleton), error, already-voted guard, voting-closed guard, submitting
- **ARIA:** `role="alert" aria-live="polite"` on error; `aria-hidden="true"` on decorative icons
- **Key UI:** Position cards with radio button selection, nominee status badges, "Select one" / "Selected" indicators, Submit Ballot button

---

### events

#### EventList
- **Props:** `{ orgId: string }`
- **States:** loading (Skeleton x6), error, empty (filtered/unfiltered/tab-specific)
- **ARIA:** `role="alert" aria-live="polite"` on error
- **Key UI:** 3 stat cards, tab bar (upcoming/past/drafts/cancelled), type Select + search Input, EventCard grid, destructive cancel ConfirmDialog

#### EventForm
- **Props:** `{ orgId: string, event?: {...}, onSuccess?, onCancel? }`
- **Zod Schema:** `eventSchema` - title (required), eventType (required), description (optional), startDate (required), endDate (required), location (optional), registrationFee (>=0, default 0), capacity (optional positive int), visibility (internal/network), status (draft/published)
- **States:** saving, server error
- **ARIA:** `role="alert" aria-live="polite"` on server error; `aria-describedby` on inputs; `role="alert"` on field errors
- **Key UI:** Sectioned form (Basic Info, Date & Time, Location, Registration), event type Select (Controller), visibility Select, dual action buttons (Save Draft / Publish)

#### EventCard
- **Props:** `{ event: {...}, orgId: string, onEdit?, onCancel?, onDuplicate?, linkBase? }`
- **States:** menu-open
- **ARIA:** `aria-label="Actions"` on menu button
- **Key UI:** GlassCard with status badge, title link, date/location/registration meta, dropdown action menu

#### AttendanceView
- **Props:** `{ eventId: string }`
- **States:** loading (Skeleton x5), empty, check-in error/success
- **ARIA:** `role="alert" aria-live="polite"` on check-in error
- **Key UI:** 3 stat cards (total/QR/manual), manual check-in Input with Enter key support, search + filtered attendance list with method badges

---

### membership

#### MemberTable
- **Props:** `{ orgId: string, initialStatus?: string, expiringDays?: number, requiredCredits?: number }`
- **States:** loading (Skeleton x6), error, empty, paginated, bulk-selected
- **ARIA:** `role="alert" aria-live="polite"` on error; `aria-label="Select all"` / `aria-label="Select {name}"` on Checkboxes
- **Key UI:** Search with icon, 4 filter Selects (category, dues status, training), status Tabs (7 tabs), bulk action bar, 9-column Table with AvatarInitials, name link, badges for status/dues/training compliance, Previous/Next pagination

#### MemberDetail
- **Props:** `{ orgId: string, memberId: string }`
- **States:** loading (ProfileSkeleton), error (Alert destructive)
- **ARIA:** Alert + AlertDescription on error; status banner per membership state (grace/lapsed/suspended/removed)
- **Key UI:** PageHeader with breadcrumbs, Avatar + status badges, two-column GlassCards (contact + membership info), actions panel (Change Category, Record Payment, Reinstate, Suspend, Mark Deceased), 3 Dialogs (category change, suspend with reason, deceased confirmation)

#### ApplicationList
- **Props:** `{ orgId: string }`
- **States:** loading (ListSkeleton), error, empty (EmptyState), bulk-selected
- **ARIA:** `aria-label="Select all approvable applications"` / `aria-label="Select {name}"` on Checkboxes
- **Key UI:** Select-all Checkbox + status/sort Selects + bulk approve Button, expandable ApplicationCards with AvatarInitials, approve/deny actions with denial reason Textarea

#### CategoryEditor
- **Props:** `{ orgId: string }`
- **States:** loading (Skeleton x4), error, empty
- **ARIA:** `role="alert" aria-live="polite"` on error
- **Key UI:** Add Category button, Table with name/description/dues/cycle/members/status/actions, Add Category Dialog (name, description, dues amount, billing cycle Select, sort order), deactivate confirmation Dialog

#### MembershipList
- **Props:** `{ orgId: string, tenantId: string }`
- **States:** loading, error, empty
- **ARIA:** `role="alert" aria-live="polite"` on error
- **Key UI:** Simple Table (member#, person, status badge, tier, dues expiry, renew action)

---

### notifications

#### NotificationInbox
- **Props:** none
- **States:** loading (ListSkeleton), error, empty (global/category-filtered)
- **ARIA:** none explicit
- **Key UI:** Unread count badge + "Mark all as read" button, category filter chips (All/Announcements/Payments/Events/Training/System), date-grouped notification list in GlassCard, unread indicator (left border + background), relative time formatting

---

### training

#### TrainingList
- **Props:** `{ orgId: string }`
- **States:** loading (pulse skeleton x6), error, empty
- **ARIA:** `role="alert" aria-live="polite"` on error
- **Key UI:** 4 stat cards, tab bar (Published/Past/Drafts), search + type Select, TrainingCard grid, destructive cancel ConfirmDialog

#### TrainingForm
- **Props:** `{ orgId: string, initial?: any, trainingId?: string }`
- **States:** saving, error (inline text)
- **ARIA:** none explicit
- **Key UI:** 4 sectioned cards (Basic Info, Schedule, Location, Credits), type Select, title/description inputs, date-time inputs, credit/capacity/fee inputs, Save Draft / Publish buttons

#### TrainingCard
- **Props:** `{ training: any, orgId: string, onCancel?, onDuplicate? }`
- **States:** menu-open
- **ARIA:** `aria-label="Actions"` on menu button
- **Key UI:** Accent strip, title link, type/status/CPE badges, date/location/enrollment meta, dropdown action menu

#### CompletionTable
- **Props:** `{ orgId: string, trainingId: string, creditAmount: string | number }`
- **States:** loading, empty, bulk-selected
- **ARIA:** implicit on Checkbox
- **Key UI:** 3 stat cards (enrolled/completed/credits), bulk action bar, Table with checkbox selection, enrollment status badges, mark-complete action per row

---

## Shared Patterns

### Component Library: `@monobase/ui`
All components import from `@monobase/ui`. Primitives used across modules:
- **Button** (variant: default/outline/ghost/destructive/link, size: default/sm/icon)
- **Input**, **Textarea**, **Label**, **Checkbox**, **Switch**
- **Select** (SelectTrigger/Content/Item/Value)
- **Table** (TableHeader/Body/Row/Head/Cell)
- **Dialog** (DialogContent/Header/Title/Footer)
- **Tabs** (TabsList/TabsTrigger)
- **Badge** (variant: default/secondary/outline)
- **Skeleton**, **Separator**, **Alert** (AlertDescription), **Avatar** (AvatarFallback)

### Shared App Components
Located in `apps/memberry/src/components/`:
- **GlassCard** (`@/components/motion/glass-card`) - Glassmorphism card wrapper
- **StaggerGrid/StaggerItem** (`@/components/motion/stagger-grid`) - Animated grid layout
- **CountUp** (`@/components/motion/count-up`) - Animated number counter
- **EmptyState** (`@/components/patterns/empty-state`) - icon + headline + description
- **CardSkeleton, TableSkeleton, ListSkeleton, ProfileSkeleton** (`@/components/patterns/skeleton-loader`)
- **PageHeader** (`@/components/patterns/page-header`) - Title + subtitle + breadcrumbs
- **StatusBadge** (`@/components/patterns/status-badge`)
- **AvatarInitials** (`@/components/patterns/avatar-initials`) - Fallback avatar with initials
- **ConfirmDialog** (`@/components/patterns/confirm-dialog`) - Reusable destructive confirmation

### Form Patterns
- All forms use `react-hook-form` + `zod` via `@/lib/zod-resolver`
- Controller pattern used for Select components (not natively compatible with register)
- Error display: `role="alert"` on error messages, `aria-describedby` linking inputs to errors
- Loading/submit states: Button disabled + "Saving..."/"Submitting..." text

### Accessibility Summary
- **51 `role="alert"`** across components for error states and validation
- **`aria-live="polite"`** paired with most `role="alert"` instances
- **`aria-describedby`** linking form inputs to error messages and hint text
- **`aria-hidden="true"`** on decorative icons (lucide-react)
- **`aria-label`** on icon-only buttons (Actions, Remove, Select all)
- **`sr-only`** class used for screen-reader-only status text (ActionWidget)
- **`role="img" aria-label`** on data visualizations (CreditRing SVG)
- **Focus management** handled by Radix Dialog/Select primitives (via @monobase/ui)
- **Keyboard:** Enter key support on AttendanceView check-in input; Radio inputs for VotingBallot; native form submission on forms

### Missing States (Gaps)
The following states from the 9-state model are NOT currently handled by any component:
- **offline** - No offline detection or offline-mode UI
- **permission-denied** - No explicit permission-denied state (errors show generic messages)
- **stale** - No stale data indicators (TanStack Query handles refetching silently)

### Destructive Actions Inventory
| Action | Component | Confirmation Method |
|--------|-----------|-------------------|
| Remove officer | OfficerManagement | Dialog (Cancel/Remove destructive) |
| Cancel event | EventList | ConfirmDialog (destructive) |
| Cancel training | TrainingList | ConfirmDialog (destructive) |
| Disconnect gateway | GatewaySetup | Dialog (Cancel/Disconnect destructive) |
| Refund payment | RefundForm | Dialog (Cancel/Confirm Refund destructive) |
| Deny application | ApplicationList | Inline textarea + Confirm Deny (destructive) |
| Suspend member | MemberDetail | Dialog with reason textarea |
| Mark deceased | MemberDetail | Dialog (outline confirm) |
| Deactivate category | CategoryEditor | Dialog (Cancel/Deactivate destructive) |
| Reject payment proof | PendingProofsList | Inline reason input + Confirm Rejection (destructive) |
| Remove nominee | ElectionDetail | Inline confirm (Remove destructive / Cancel) |
| Cast ballot (irreversible) | VotingBallot | No confirmation (direct submit - by design, ballot is final) |
