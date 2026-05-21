<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Interaction States: National Dashboard (M14)

---

## Loading State

**When it appears:** Initial dashboard load, date range change, chapter drill-down navigation, export initiation
**Expected UI behavior:**
- Dashboard load: 4 skeleton KPI cards, 2 skeleton chart placeholders, skeleton table with 5-8 rows
- Date range change: KPI cards and charts show skeleton overlay while refreshing (preserve layout)
- Chapter drill-down: full page skeleton matching drill-down layout
- Export: button shows spinner, "Exporting..." label; for large datasets: progress indicator with estimated time
- aria-busy="true" on main content during load
- aria-live="polite" region announces "Dashboard data loading"

---

## Empty State

**When it appears:** No chapter data available, newly created association, chapter with zero members
**Expected UI behavior:**
- Dashboard home (no chapters): "No chapter data available yet. Chapters with active members will appear here." No CTA (admin-managed).
- Dashboard home (no data for date range): "No data found for the selected period. Try a wider date range." with "Reset to This Year" link
- Chapter drill-down (empty chapter): "This chapter has no data yet. Data will appear once members are added and activities recorded."
- KPI cards show "0" or "--" for missing metrics
- Charts show empty state placeholder (dotted border rectangle)
- aria-live="polite" announces empty state

---

## Success State

**When it appears:** Export completed, data refreshed after date range change
**Expected UI behavior:**
- CSV export: browser triggers file download, sonner toast "Report exported as CSV" (3s)
- PDF export: browser triggers file download, sonner toast "Report exported as PDF" (3s)
- Async export (large datasets): sonner toast "Export is being prepared. You'll be notified when ready." (persistent until complete), followed by "Export ready — downloading now" on completion
- Date range change: smooth transition, KPI values animate to new values
- No persistent success state (dashboard is always in "default" after load)

---

## Validation Error State

**When it appears:** Invalid custom date range
**Expected UI behavior:**
- Start date after end date (M14-002): inline error below date picker "Start date must be before end date"
- Invalid format (VALIDATION-005): inline error "Please select a valid export format"
- Focus moves to first invalid field
- aria-invalid="true" on invalid input
- aria-describedby links to error message

---

## Permission Error State

**When it appears:** Unauthorized role accesses dashboard route, cross-association access attempt
**Expected UI behavior:**
- Non-authorized role navigates to /admin/national: redirect to /admin with sonner toast "National officer or platform admin access required" (M14-001)
- Cross-association access denied (AUTHZ-006): sonner toast "You don't have access to this association's data" (error variant, 5s)
- National officer attempts to use association switcher: switcher not rendered (server-side guard)
- Page content not rendered for unauthorized users (no flash of content)

---

## Unexpected Error State

**When it appears:** Server 500, network failure, aggregation timeout
**Expected UI behavior:**
- Dashboard load failure: centered error card "Unable to load dashboard data. Please try again." with "Retry" button
- Aggregation timeout (M14-003): "Data aggregation timed out. Try a smaller date range or fewer chapters." with "Retry with This Month" shortcut
- Export failure: sonner toast "Export failed. Please try again." (error variant, 5s) with "Retry" action
- Partial load failure: affected sections show individual error states, unaffected sections still display
- Correlation ID displayed in small text for support escalation
- aria-live="assertive" announces error

---

## Conflict / Duplicate Warning State

**When it appears:** N/A for read-only dashboard
**Expected UI behavior:**
- Not applicable. Dashboard is entirely read-only with no user-modifiable data.

---

## Confirmation / Warning State

**When it appears:** Large export that may take significant time
**Expected UI behavior:**
- Export of large dataset: "This export contains data from {N} chapters and may take a few minutes. Continue?" with "Export" and "Cancel" buttons
- No destructive actions in this module, so minimal confirmation needed

---

## Offline / Sync State

**When it appears:** Network unavailable while viewing dashboard
**Expected UI behavior:**
- Banner at top: "You're offline. Dashboard data may be stale." with last-loaded timestamp
- KPI cards and charts retain last-loaded data (cached)
- Export button disabled with tooltip: "Export unavailable while offline"
- Date range changes disabled with tooltip: "Cannot refresh data while offline"
- Online restore: banner dismissed, data refreshed automatically
- aria-live="polite" announces connectivity changes

---

## Per-Screen Completeness Score

| Screen | States Defined | States Missing | Score |
|--------|---------------|---------------|-------|
| National Dashboard Home | 9/9 | none | COMPLETE |
| Chapter Drill-Down | 9/9 | none | COMPLETE |
