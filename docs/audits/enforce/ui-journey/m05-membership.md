# UI Journey Audit: m05-membership

oli_version: "Phase B — Enforce"
oli_artifact: UI_JOURNEY_AUDIT
Module: m05-membership
Audited: 2026-05-27
Spec Sources: MODULE_SPEC.md, API_CONTRACTS.md, WORKFLOW_MAP.md, ROLE_PERMISSION_MATRIX.md

---

## R1 — Action Registry

Every interactive element mapped to its handler, API call, and feedback mechanism.

| ID | Screen | Element | Type | Handler/Hook | API Endpoint | Feedback | File |
|----|--------|---------|------|-------------|-------------|----------|------|
| J-M05-001 | Roster | "Add Member" button | button | `setShowAdd(true)` | — (opens dialog) | Dialog opens | `officer/roster/index.tsx` |
| J-M05-002 | Roster > Add Dialog | "Add Member" submit | form submit | `addRosterMemberMutation` | `POST /api/persons` + SDK addRosterMember | `toast.success` / `toast.error` | `officer/roster/index.tsx` |
| J-M05-003 | Roster > Add Dialog | "Cancel" button | button | `onClose()` | — | Dialog closes | `officer/roster/index.tsx` |
| J-M05-004 | Roster | Search input | text input | `setSearch(e.target.value)` | `listRosterMembersOptions` (debounced) | Table re-renders | `member-table.tsx` |
| J-M05-005 | Roster | Category filter (Select) | select | `setCategoryId(v)` | `listRosterMembersOptions` | Table re-renders | `member-table.tsx` |
| J-M05-006 | Roster | Dues Status filter (Select) | select | `setDuesStatusFilter(v)` | `listRosterMembersOptions` | Table re-renders | `member-table.tsx` |
| J-M05-007 | Roster | Training filter (Select) | select | `setTrainingFilter(v)` | `listRosterMembersOptions` | Table re-renders | `member-table.tsx` |
| J-M05-008 | Roster | Status tabs (TabsList) | tabs | `setStatusTab(v)` | `listRosterMembersOptions` | Table re-renders with filtered status | `member-table.tsx` |
| J-M05-009 | Roster | Row checkbox | checkbox | `toggleSelect(id)` | — | Checkbox toggles, bulk action bar appears | `member-table.tsx` |
| J-M05-010 | Roster | "Select All" checkbox | checkbox | `toggleSelectAll()` | — | All row checkboxes toggle | `member-table.tsx` |
| J-M05-011 | Roster | Pagination "Previous" | button | `setPage(p => p - 1)` | `listRosterMembersOptions` (offset) | Table re-renders | `member-table.tsx` |
| J-M05-012 | Roster | Pagination "Next" | button | `setPage(p => p + 1)` | `listRosterMembersOptions` (offset) | Table re-renders | `member-table.tsx` |
| J-M05-013 | Roster | Row click / member link | link | TanStack Router navigate | — | Navigate to `/officer/roster/$memberId` | `member-table.tsx` |
| J-M05-014 | Member Detail | "Change Category" button | button | `setShowChangeCat(true)` | — (opens dialog) | Dialog opens | `member-detail.tsx` |
| J-M05-015 | Member Detail | Change Category confirm | button | `updateMutation.mutate` | `updateRosterMemberMutation` | `toast.success` / `toast.error` | `member-detail.tsx` |
| J-M05-016 | Member Detail | "Record Payment" link | link | TanStack Router | — | Navigate to `/officer/payments/new` | `member-detail.tsx` |
| J-M05-017 | Member Detail | "Suspend" button | button | `setShowSuspend(true)` | — (opens dialog) | Dialog opens | `member-detail.tsx` |
| J-M05-018 | Member Detail | Suspend confirm | button | `updateMutation.mutate({status:'suspended'})` | `updateRosterMemberMutation` | `toast.success` / `toast.error` | `member-detail.tsx` |
| J-M05-019 | Member Detail | "Mark Deceased" button | button | `setShowDeceased(true)` | — (opens dialog) | Dialog opens | `member-detail.tsx` |
| J-M05-020 | Member Detail | Mark Deceased confirm | button | `deceasedMutation.mutate` | `terminateMembershipMutation` | `toast.success` / `toast.error` | `member-detail.tsx` |
| J-M05-021 | Member Detail | "Reinstate" button | button | `reinstateMutation.mutate` | `reinstateMembershipMutation` | `toast.success` / `toast.error` | `member-detail.tsx` |
| J-M05-022 | Member Detail | "Verify License" button | button | `verifyMutation.mutate(licenseId)` | `PATCH /api/association/member/licenses/:id` | `toast.success` / `toast.error` | `officer/roster/$memberId.tsx` |
| J-M05-023 | CSV Import | Drag-and-drop zone / file input | file upload | `handleFile(f)` | — (client-side parse) | CSV parsed, preview table shown | `officer/roster/import.tsx` |
| J-M05-024 | CSV Import | "Change File" button | button | `setParsed(null); setFile(null)` | — | Upload zone reappears | `officer/roster/import.tsx` |
| J-M05-025 | CSV Import | "Import Members" button | button | `handleImport()` | `importRosterMembersMutation` | `toast.success` / `toast.error`, result banner | `officer/roster/import.tsx` |
| J-M05-026 | Applications | Status filter (Select) | select | `setStatusFilter(v)` | — (client-side filter) | List re-renders | `application-list.tsx` |
| J-M05-027 | Applications | Sort filter (Select) | select | `setSortBy(v)` | — (client-side sort) | List re-renders | `application-list.tsx` |
| J-M05-028 | Applications | "Approve" button (per-card) | button | `handleApprove()` | `approveMembershipApplicationMutation` | `toast.success` / `toast.error` | `application-list.tsx` |
| J-M05-029 | Applications | "Deny" button (per-card) | button | `handleDeny()` | `denyMembershipApplicationMutation` | `toast.success` / `toast.error` | `application-list.tsx` |
| J-M05-030 | Applications | Reject reason textarea | textarea | `setRejectReason(v)` | — | Enables "Confirm Deny" button | `application-list.tsx` |
| J-M05-031 | Applications | "Select All" checkbox | checkbox | `toggleSelectAll` | — | All approvable checkboxes toggle | `application-list.tsx` |
| J-M05-032 | Applications | Per-application checkbox | checkbox | `selectedIds.add/delete(id)` | — | Checkbox toggles, bulk approve count updates | `application-list.tsx` |
| J-M05-033 | Applications | "Approve N Selected" button | button | `bulkApprove.mutate` | `POST /api/association/member/applications/bulk-approve` | `toast.success`/`warning`/`error` with counts | `application-list.tsx` |
| J-M05-034 | Directory | Search input | text input | `setSearch(v)` | `searchDirectoryOptions` | Card grid re-renders | `trust-directory.tsx` |
| J-M05-035 | Directory | Specialty filter (Select) | select | `update('specialty', v)` | `searchDirectoryOptions` (via query param) | Card grid re-renders | `directory-filters.tsx` |
| J-M05-036 | Directory | Chapter filter (Select) | select | `update('chapter', v)` | `searchDirectoryOptions` (via query param) | Card grid re-renders | `directory-filters.tsx` |
| J-M05-037 | Directory | Dues Status filter (Select) | select | `update('duesStatus', v)` | `searchDirectoryOptions` (via query param) | Card grid re-renders | `directory-filters.tsx` |
| J-M05-038 | Directory | TrustCard click | link | TanStack Router | — | Navigate to `/directory/$personId` | `trust-card.tsx` |
| J-M05-039 | Directory Profile | "Back to directory" link | link | TanStack Router | — | Navigate to `/org/$orgSlug/directory` | `member-profile.tsx` |
| J-M05-040 | Directory Profile | Email link | anchor | `mailto:` | — | OS mail client | `member-profile.tsx` |
| J-M05-041 | Directory Profile | Phone link | anchor | `tel:` | — | OS phone handler | `member-profile.tsx` |
| J-M05-042 | Directory Profile | Website link | anchor | External URL | — | New tab opens | `member-profile.tsx` |
| J-M05-043 | Directory Profile | Social link | anchor | External URL | — | New tab opens | `member-profile.tsx` |
| J-M05-044 | Categories | "Add Category" button | button | `setShowAdd(true)` | — (opens dialog) | Dialog opens | `category-editor.tsx` |
| J-M05-045 | Categories | Save category submit | button | `saveMutation.mutate` | `upsertMembershipCategoryMutation` | `toast.success` / `toast.error` | `category-editor.tsx` |
| J-M05-046 | Categories | "Edit" button (per-row) | button | `setEditRow(row)` | — (opens dialog) | Edit dialog opens | `category-editor.tsx` |
| J-M05-047 | Categories | "Deactivate" button (per-row) | button | `setConfirmDeactivate(id)` | — (opens confirm dialog) | Confirm dialog opens | `category-editor.tsx` |
| J-M05-048 | Categories | Deactivate confirm | button | `handleDeactivate()` | `upsertMembershipCategoryMutation` ({active:false}) | `toast.success` / `toast.error` | `category-editor.tsx` |
| J-M05-049 | Admin Members | Search input | text input | `setSearch(v)` | — (client-side filter) | Table re-renders | `admin/routes/members/index.tsx` |
| J-M05-050 | Admin Members | Org filter (Select) | select | `setOrgFilter(v)` | `listRosterMembersOptions` per org | Table re-renders | `admin/routes/members/index.tsx` |
| J-M05-051 | Admin Members | Member row click/link | link | TanStack Router | — | Navigate to `/members/$personId` | `admin/routes/members/index.tsx` |
| J-M05-052 | Admin Member Detail | "Back to Members" link | link | TanStack Router | — | Navigate to `/members` | `admin/routes/members/$personId.tsx` |
| J-M05-053 | Membership List | "Renew" button | link button | — (no handler wired) | — | **DEAD INTERACTION** | `membership-list.tsx` |

**Total interactive elements: 53**

---

## R2 — Journey Completion Registry

End-to-end user journeys traced through screens, with entry/exit points and completion criteria.

| Journey ID | Workflow | Persona | Entry Point | Steps | Exit Point | Completion Signal | Status |
|-----------|---------|---------|-------------|-------|------------|-------------------|--------|
| J-M05-J01 | WF-029 | Officer | `/officer/applications` | 1. View application list 2. Filter by status 3. Click Approve/Deny 4. Confirm action | Application status updated | `toast.success("Application approved/rejected")` | COMPLETE |
| J-M05-J02 | WF-029 | Officer | `/officer/applications` | 1. Select multiple applications 2. Click "Approve N Selected" | Bulk approve completes | `toast.success("N applications approved")` | COMPLETE |
| J-M05-J03 | WF-030 | Officer | `/officer/roster` | 1. Search/filter members 2. Browse table 3. Click member row | Member detail page loads | `<MemberDetail>` renders | COMPLETE |
| J-M05-J04 | WF-030 | Officer | `/officer/roster` | 1. Click "Add Member" 2. Fill form 3. Submit | New member created | `toast.success("Name added as member")` | COMPLETE |
| J-M05-J05 | WF-031 | Officer | `/officer/roster/import` | 1. Upload CSV 2. Preview parsed data 3. Click "Import Members" | Import completes | Success banner + `toast.success` | COMPLETE |
| J-M05-J06 | WF-033 | Officer | `/officer/settings/membership-categories` | 1. Click "Add Category" 2. Fill name/description 3. Save | Category created | `toast.success` | COMPLETE |
| J-M05-J07 | WF-033 | Officer | `/officer/settings/membership-categories` | 1. Click "Edit" on row 2. Modify fields 3. Save | Category updated | `toast.success` | COMPLETE |
| J-M05-J08 | WF-033 | Officer | `/officer/settings/membership-categories` | 1. Click "Deactivate" 2. Confirm | Category deactivated | `toast.success` | COMPLETE |
| J-M05-J09 | WF-034 | Member | `/org/$orgSlug/directory` | 1. Search by name 2. Apply filters 3. Click member card | Profile page loads | `<MemberProfile>` renders | COMPLETE |
| J-M05-J10 | WF-034 | Member | `/org/$orgSlug/directory/$personId` | 1. View profile 2. Click contact links | External handler (mail/phone/web) | OS handler opens | COMPLETE |
| J-M05-J11 | — | Officer | `/officer/roster/$memberId` | 1. View member detail 2. Click "Suspend" 3. Enter reason 4. Confirm | Member suspended | `toast.success` | COMPLETE |
| J-M05-J12 | — | Officer | `/officer/roster/$memberId` | 1. View suspended member 2. Click "Reinstate" | Member reinstated | `toast.success` | COMPLETE |
| J-M05-J13 | — | Officer | `/officer/roster/$memberId` | 1. View member 2. Click "Mark Deceased" 3. Confirm | Membership terminated | `toast.success` | COMPLETE |
| J-M05-J14 | — | Officer | `/officer/roster/$memberId` | 1. View member 2. Click "Change Category" 3. Select new category 4. Save | Category changed | `toast.success` | COMPLETE |
| J-M05-J15 | — | Officer | `/officer/roster/$memberId` | 1. View member licenses 2. Click "Verify" | License verified | `toast.success` | COMPLETE |
| J-M05-J16 | — | Admin | `/members` | 1. Search/filter 2. Click member row | Person detail loads | `<MemberDetailContent>` renders | COMPLETE |
| J-M05-J17 | — | Admin | `/members/$personId` | 1. View person info 2. Browse tabs (Profile only) | Information displayed | Data renders | PARTIAL — tabs declared but only Profile implemented |

---

## R3 — Dead Interaction Registry

Interactive elements that produce no meaningful result or are disconnected from backend.

| ID | Element | Location | Issue | Severity | Recommendation |
|----|---------|----------|-------|----------|---------------|
| J-M05-D01 | "Renew" button in MembershipList | `membership-list.tsx` | Button has `variant="link"` but no `onClick` handler or navigation `href`. Clicking does nothing. | P1 | Wire to renewal flow (M06 dues payment) or remove until WF-035 is implemented. |
| J-M05-D02 | "Tier" filter in DirectoryFilters | `directory-filters.tsx` | Filter UI exists (`filters.tier`) and is passed to `searchDirectoryOptions` query, but no tier options are populated in the dropdown — always empty. | P2 | Fetch membership categories and populate tier dropdown, or hide filter until data source available. |
| J-M05-D03 | Specialty filter (client-side only) | `trust-directory.tsx` | Specialty dropdown is populated from *current results only* (`profiles.forEach`). Not a server-side filter — changing specialty does not re-query. Selecting a specialty after server filtering returns stale options. | P2 | Either pass specialty as query param to `searchDirectoryOptions` or document as client-side-only post-filter. |
| J-M05-D04 | Admin member detail tabs | `admin/routes/members/$personId.tsx` | `TABS` array declares 6 tabs (Profile, Credentials, Credits, Certificates, Privacy, Account) but only Profile content is rendered. Tab buttons exist with `activeTab` state but 5/6 show nothing. | P2 | Implement remaining tab panels or hide unimplemented tabs. |
| J-M05-D05 | Bulk actions bar (Roster) | `member-table.tsx` | Checkbox selection state exists (`selected` Set) and select-all works, but no bulk action buttons are rendered in the table UI. Selection has no outcome. | P1 | Add bulk action bar (spec requires: send reminder, export CSV, change category, bulk approve). |
| J-M05-D06 | MembershipList component | `membership-list.tsx` | Entire component appears unused — the Roster page uses `<MemberTable>` instead. `MembershipList` shows raw `personId` instead of names and has no navigation. | P3 | Remove dead component or repurpose for self-service member view. |

---

## R4 — State Coverage Registry

UI states from spec vs. what is actually implemented per screen.

### Screen: Member Roster (`/officer/roster`)

| State | Spec Required | Implemented | Evidence |
|-------|--------------|-------------|----------|
| Loading | YES | YES | Skeleton rows via `<Skeleton>` components (6 rows) | `member-table.tsx` |
| Empty | YES ("No members yet -- import or invite") | PARTIAL | Shows "No members found" but no import/invite CTA | `member-table.tsx` |
| Filtered no results | YES ("No members match filters") | YES | Shows "No members found" with search term in message | `member-table.tsx` |
| Populated (50 per page) | YES | YES | `PAGE_SIZE = 50`, pagination controls | `member-table.tsx` |
| PermissionError | YES ("member sees read-only view") | NO | No permission gating — any authenticated user sees full table | `member-table.tsx` |
| UnexpectedError | YES (retry) | PARTIAL | Error shown but no retry button | `member-table.tsx` |

### Screen: Bulk CSV Import (`/officer/roster/import`)

| State | Spec Required | Implemented | Evidence |
|-------|--------------|-------------|----------|
| Step 1: Upload + template download | YES | PARTIAL | Upload zone exists; **no template download link** | `import.tsx` |
| Step 2: Validation preview (valid/linked/invalid tabs) | YES | PARTIAL | Preview table shows all rows but **no tab separation** by valid/linked/invalid | `import.tsx` |
| Step 3: Confirm | YES | YES | "Import Members" button after preview | `import.tsx` |
| Step 4: Results with skipped rows download | YES | PARTIAL | Success banner with count but **no downloadable skipped-rows report** | `import.tsx` |
| Loading (validating) | YES | NO | Client-side CSV parsing is synchronous — no loading indicator during parse | `import.tsx` |
| ValidationError (file type) | YES | YES | `toast.error("Please upload a CSV file")` on wrong type | `import.tsx` |
| Empty (0 valid rows) | YES | YES | `toast.error("No data rows found in CSV")` | `import.tsx` |
| Processing (progress bar) | YES | PARTIAL | Button shows spinner text ("Importing...") but no progress bar | `import.tsx` |
| Success (summary) | YES | YES | Green banner with count | `import.tsx` |
| PermissionError | YES | NO | No role check — any authenticated org member can access import page | `import.tsx` |

### Screen: Member Directory (`/org/$orgSlug/directory`)

| State | Spec Required | Implemented | Evidence |
|-------|--------------|-------------|----------|
| Loading | YES (skeleton cards) | YES | 6x `<CardSkeleton>` in grid | `trust-directory.tsx` |
| Empty | YES ("No members in directory") | YES | EmptyState: "No directory profiles" | `trust-directory.tsx` |
| NoResults | YES ("No members match search") | YES | EmptyState: "No members found" with "Try a different search" | `trust-directory.tsx` |
| Populated | YES | YES | Card grid with pagination info | `trust-directory.tsx` |
| Error | — | YES | Red alert: "Unable to load directory" | `trust-directory.tsx` |

### Screen: Application Review (`/officer/applications`)

| State | Spec Required | Implemented | Evidence |
|-------|--------------|-------------|----------|
| Loading | YES | YES | `<ListSkeleton rows={4}>` | `application-list.tsx` |
| Empty | YES | YES | EmptyState with description | `application-list.tsx` |
| Populated | YES | YES | Application cards with action buttons | `application-list.tsx` |
| Error | — | YES | "Failed to load applications" message | `application-list.tsx` |
| Filtered empty | — | YES | "Applications matching your filter will appear here" | `application-list.tsx` |

### Screen: Membership Categories (`/officer/settings/membership-categories`)

| State | Spec Required | Implied | Implemented | Evidence |
|-------|--------------|---------|-------------|----------|
| Loading | — | YES | YES | (React Query default) | `category-editor.tsx` |
| Empty | — | YES | YES | "No categories yet" with icon | `category-editor.tsx` |
| Populated | — | YES | YES | Table with name, description, dues, cycle, member count | `category-editor.tsx` |
| Error | — | YES | YES | "Failed to load categories" message | `category-editor.tsx` |

---

## R5 — Spec-to-UI Traceability Matrix

Maps every spec workflow, acceptance criteria, and business rule to UI implementation.

### Workflow Traceability

| WF-ID | Description | UI Route | Component | Status | Gap |
|-------|-------------|----------|-----------|--------|-----|
| WF-029 | Membership Application: submit, review, approve/reject | `/officer/applications` | `ApplicationList` | IMPLEMENTED | No self-service application submit UI (user-facing "Apply" form missing) |
| WF-030 | Member Roster: list, search, filter, bulk actions | `/officer/roster` | `MemberTable` | PARTIAL | Bulk actions bar missing (D05). Spec requires: send reminder, export CSV, change category, bulk approve. |
| WF-031 | Bulk CSV Import | `/officer/roster/import` | `RosterImportPage` | PARTIAL | Missing: template download, valid/linked/invalid tabs, skipped-rows download, progress bar, permission check |
| WF-032 | Membership Status Computation | N/A (backend) | `membership-status.ts` | IMPLEMENTED | Status display in UI via badges. Computation is server-side. |
| WF-033 | Membership Categories CRUD | `/officer/settings/membership-categories` | `CategoryEditor` | IMPLEMENTED | Full CRUD with deactivation |
| WF-034 | Member Directory | `/org/$orgSlug/directory` | `TrustDirectory` | IMPLEMENTED | Privacy filtering done server-side |
| WF-035 | Reinstatement: pay dues to restore Active | `/officer/roster/$memberId` | `MemberDetail` | PARTIAL | Reinstate button exists but does not navigate to dues payment (M06 integration missing) |
| WF-036 | Member Transfer | — | — | NOT IMPLEMENTED | No transfer UI exists. Spec defines inter-org transfer with dual-approval workflow. |
| WF-037 | Cross-Org Matching | — | — | NOT IMPLEMENTED | Backend-only concern but no UI for viewing/resolving match results during import |

### Acceptance Criteria Traceability

| AC ID | Description | UI Evidence | Status |
|-------|-------------|-------------|--------|
| AC-M05-001 | No Duplicate Accounts | Import has cross-org matching (server-side) | BACKEND — no UI feedback for duplicates |
| AC-M05-002 | Status Computation Correctness | `membership-status.ts` maps all statuses to labels/colors | PARTIAL — missing `resigned`, `deceased`, `expelled` from MembershipStatus type |
| AC-M05-003 | Bulk Import Performance | Import exists with CSV parse + API call | IMPLEMENTED (perf is server concern) |
| AC-M05-004 | License Normalization | License display in member detail + verify button | BACKEND — normalization is server-side |
| AC-M05-005 | Directory Privacy | Privacy filtering via `searchDirectoryOptions` | IMPLEMENTED (server-gated) |
| AC-M05-006 | Transfer Preserves History | — | NOT IMPLEMENTED — no transfer UI |
| AC-M05-007 | Bulk Approve with Org Scope | Bulk approve in `application-list.tsx` | IMPLEMENTED |

### Business Rule UI Coverage

| BR | Rule | UI Enforcement | Gap |
|----|------|---------------|-----|
| BR-01 | Status computed from dues_expiry_date | Status badges display computed status | OK |
| BR-03 | Membership status priority ordering | `membership-status.ts` handles display | OK — computation is server-side |
| BR-07 | Lapsed -> Active via payment | "Reinstate" button on member detail | Missing navigation to payment flow |
| BR-22 | Import max 500 rows | **NOT ENFORCED** in frontend | Add client-side row count check before API call |
| M5-R2 | CSV required columns validation | Column header normalization in `parseCSV()` | No error shown if required columns missing after normalization |
| M5-R3 | Cross-org matching during import | Server-side during import | No UI feedback showing matched vs. new |
| M5-R8 | Import tierId required | Hardcoded `tierId: 'default'` | Should use actual tier selection from categories |

---

## R6 — Findings Summary

### Critical Findings (P0)

None.

### High Findings (P1)

| ID | Finding | Impact | Location |
|----|---------|--------|----------|
| J-M05-F01 | **Roster bulk actions missing.** Spec requires send reminder, export CSV, change category, bulk approve. Checkbox selection exists but no action buttons rendered. | Officer cannot perform bulk operations from roster — must act on each member individually. | `member-table.tsx` |
| J-M05-F02 | **"Renew" button is dead.** No onClick/href handler. Clicking does nothing. | Confusing UX — button appears clickable but produces no result. | `membership-list.tsx` |
| J-M05-F03 | **MembershipStatus type incomplete.** Missing `resigned`, `deceased`, `expelled` from the type union. These are valid states per spec (Section 8) and exist in backend `MEMBERSHIP_VALID_TRANSITIONS`. | Status badges for terminal states will show fallback styling. Status-dependent logic may break. | `membership-status.ts` |
| J-M05-F04 | **No permission gating on import page.** Spec requires president (2FA) or secretary (2FA). Any authenticated org member can access `/officer/roster/import`. | Unauthorized users could import members. | `officer/roster/import.tsx` |

### Medium Findings (P2)

| ID | Finding | Impact | Location |
|----|---------|--------|----------|
| J-M05-F05 | **Import missing spec-required UX.** No template download, no valid/linked/invalid preview tabs, no skipped-rows download, no progress bar. | Import flow is functional but does not match spec fidelity. Users cannot download template or review import results granularly. | `officer/roster/import.tsx` |
| J-M05-F06 | **Admin member detail: 5/6 tabs empty.** Tabs declared (Credentials, Credits, Certificates, Privacy, Account) but only Profile renders content. | Admin sees clickable tabs that show blank content. | `admin/routes/members/$personId.tsx` |
| J-M05-F07 | **Directory tier filter always empty.** Filter exists in UI but no data source populates options. | Filter appears but is non-functional. | `directory-filters.tsx` |
| J-M05-F08 | **Self-service application submission missing.** WF-029 specifies `user` role can "Apply to join" but no application form exists in the member-facing app. Only officer review side exists. | Users cannot self-apply — officers must add members manually. | No file — feature not built. |
| J-M05-F09 | **Member Transfer UI not implemented.** WF-036 specifies inter-org transfer with dual-approval. No UI exists. | Transfer workflow cannot be executed from frontend. | No file — feature not built. |
| J-M05-F10 | **Import hardcodes tierId: 'default'.** Should allow officer to select a membership category/tier for imported members. | All imported members get default tier regardless of actual category. | `officer/roster/import.tsx` |
| J-M05-F11 | **BR-22 (500 row limit) not enforced client-side.** Large files will fail only after server validation. | Poor UX — user waits for upload then gets rejection. | `officer/roster/import.tsx` |
| J-M05-F12 | **Specialty filter is client-side post-filter only.** Populated from current page results, not from a complete specialty list. Options change as you filter. | Misleading — filtering by specialty may hide valid options. | `trust-directory.tsx` |

### Low Findings (P3)

| ID | Finding | Impact | Location |
|----|---------|--------|----------|
| J-M05-F13 | **MembershipList component appears unused.** `RosterPage` uses `<MemberTable>`, not `<MembershipList>`. Dead code. | Maintenance burden. | `membership-list.tsx` |
| J-M05-F14 | **Roster empty state missing CTA.** Spec says "No members yet -- import or invite" but UI just shows "No members found" with no action link. | Officer has no guidance on next step when roster is empty. | `member-table.tsx` |
| J-M05-F15 | **Roster error state missing retry button.** Spec mentions retry for UnexpectedError. | User must manually refresh page. | `member-table.tsx` |
| J-M05-F16 | **Admin member list uses client-side search only.** Server-side search not used — fetches all members (limit: 9999) then filters in browser. | Performance issue at scale (500+ members per org, multiple orgs). | `admin/routes/members/index.tsx` |

---

## File Inventory

### Memberry App — Routes

| File | Screen |
|------|--------|
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/directory.tsx` | Member Directory |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/directory/$personId.tsx` | Directory Profile |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster.tsx` | Roster Layout (Outlet) |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/index.tsx` | Member Roster |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/import.tsx` | CSV Import |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/roster/$memberId.tsx` | Member Detail |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/applications.tsx` | Application Review |
| `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/settings/membership-categories.tsx` | Membership Categories |

### Memberry App — Feature Components

| File | Component |
|------|-----------|
| `apps/memberry/src/features/membership/components/member-table.tsx` | MemberTable |
| `apps/memberry/src/features/membership/components/member-detail.tsx` | MemberDetail |
| `apps/memberry/src/features/membership/components/application-list.tsx` | ApplicationList |
| `apps/memberry/src/features/membership/components/category-editor.tsx` | CategoryEditor |
| `apps/memberry/src/features/membership/components/membership-list.tsx` | MembershipList (possibly dead) |
| `apps/memberry/src/features/membership/components/credential-list.tsx` | CredentialList |
| `apps/memberry/src/features/membership/lib/membership-status.ts` | Status helpers |
| `apps/memberry/src/features/directory/components/trust-directory.tsx` | TrustDirectory |
| `apps/memberry/src/features/directory/components/trust-card.tsx` | TrustCard |
| `apps/memberry/src/features/directory/components/member-profile.tsx` | MemberProfile |
| `apps/memberry/src/features/directory/components/directory-filters.tsx` | DirectoryFilters |
| `apps/memberry/src/features/directory/components/directory-search.tsx` | DirectorySearch |

### Admin App

| File | Screen |
|------|--------|
| `apps/admin/src/routes/members/index.tsx` | Admin Members List |
| `apps/admin/src/routes/members/$personId.tsx` | Admin Member Detail |

---

## Health Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Action completeness | 7/10 | 53 actions mapped; 1 dead button, 1 missing bulk action bar |
| Journey completion | 7/10 | 17 journeys; 15 complete, 2 partial. Transfer + self-apply missing entirely. |
| State coverage | 7/10 | Most spec states covered. Import and Roster missing some spec states (permission error, template download). |
| Dead interactions | 6/10 | 6 dead/disconnected interactions found including 2 P1s. |
| Spec traceability | 7/10 | 7/9 workflows implemented. 5/7 ACs have UI evidence. 2 workflows (transfer, cross-org matching UI) absent. |
| **Overall** | **6.8/10** | Solid core functionality. Key gaps: bulk roster actions, transfer workflow, import spec fidelity, missing terminal statuses in type. |
