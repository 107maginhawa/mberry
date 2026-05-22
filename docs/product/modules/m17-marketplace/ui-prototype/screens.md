<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M17 Marketplace -- Screen Specifications

## Screen Index

| Screen ID | Name | Route | Primary Actor | Workflow |
|-----------|------|-------|---------------|----------|
| M17-S01 | Marketplace Browse | `/marketplace` | Member | WF-098 |
| M17-S02 | Listing Detail | `/marketplace/listings/:listingId` | Member | WF-098 |
| M17-S03 | Vendor Registration | `/marketplace/vendors/register` | Vendor | WF-097 |
| M17-S04 | Vendor Dashboard | `/marketplace/vendor` | Vendor | WF-097 |
| M17-S05 | Vendor Listing Editor | `/marketplace/vendor/listings/new` | Vendor | WF-097 |
| M17-S06 | My Orders | `/marketplace/orders` | Member | WF-098 |
| M17-S07 | Vendor Orders | `/marketplace/vendor/orders` | Vendor | WF-097 |
| M17-S08 | Admin Vendor Management | `/admin/marketplace/vendors` | Platform Admin | WF-099 |
| M17-S09 | Admin Vendor Detail | `/admin/marketplace/vendors/:vendorId` | Platform Admin | WF-097, WF-099 |

---

## M17-S01: Marketplace Browse

**Route:** `/marketplace`
**Workflow:** WF-098 (Browse Marketplace)
**Auth:** GA (active member)

### ARIA Landmark Structure

```
<header role="banner">             -- App header
<nav role="navigation">            -- Breadcrumb: Home > Marketplace
<main role="main">
  <section aria-label="Search and filters">
    <form role="search">           -- Search + category filter
  <section aria-label="Marketplace listings">
    <div role="status" aria-live="polite">  -- Result count
    <ul role="list">               -- Listing cards
  <nav aria-label="Pagination">    -- Cursor pagination
<footer role="contentinfo">
```

### Layout

| Zone | Content | Responsive |
|------|---------|------------|
| Top bar | Search input, category dropdown, price range, sort selector | Collapses to filter sheet on mobile |
| Result count | "{n} listings" live region | Always visible |
| Grid | Listing cards (3-col desktop, 2-col tablet, 1-col mobile) | CSS grid |
| Pagination | "Load more" button with cursor | Sticky bottom on mobile |

### Fields & Controls

| Element | Type | ARIA | Constraints | Maps To |
|---------|------|------|-------------|---------|
| Search input | `<input type="search">` | `aria-label="Search marketplace"` | min 2 chars | `?search` |
| Category filter | `<select>` | `aria-label="Filter by category"` | emr, supplies, insurance, telehealth, other | `?filter[category]` |
| Price min | `<input type="number">` | `aria-label="Minimum price"` | >= 0 | `?filter[priceMin]` |
| Price max | `<input type="number">` | `aria-label="Maximum price"` | >= priceMin | `?filter[priceMax]` |
| Sort | `<select>` | `aria-label="Sort listings"` | title, -title, price, -price, createdAt, -createdAt | `?sort` |
| Listing card | `<article>` | `aria-labelledby="listing-title-{id}"` | -- | GET listings response |
| Load more | `<button>` | `aria-label="Load more listings"` | Disabled when no more | `?after` cursor |

### Listing Card Layout

| Zone | Content |
|------|---------|
| Image | Listing image (placeholder if none) |
| Title | `<h3 id="listing-title-{id}">` linked to detail |
| Vendor | Vendor name + verified badge |
| Price | Formatted price with currency |
| Category | Badge(s) from categoryTags |

### Role-Variant Matrix

| Role | Visible | Hidden | Altered |
|------|---------|--------|---------|
| Active member | Full browse, order button | Admin controls | -- |
| Grace/Lapsed | -- | Entire screen (redirect to membership) | -- |
| Vendor (verified) | Browse + "My Dashboard" link | Order button on own listings | -- |
| Platform admin | Browse + admin link in nav | -- | -- |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px (desktop) | 3-column grid, inline filters |
| 768-1023px (tablet) | 2-column grid, collapsible filter bar |
| < 768px (mobile) | 1-column stack, bottom sheet filters |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | "No listings found. Try adjusting your filters." illustration |
| Loading | Skeleton cards (6) in grid layout |
| Loaded | Listing cards rendered |
| Error | "Failed to load listings. Try again." with retry button |
| Partial (pagination) | Cards rendered + "Load more" button |
| Filtering | Skeleton overlay on grid, filters stay interactive |
| Unauthorized | Redirect to `/auth/sign-in` |
| Forbidden | "Active membership required to browse marketplace." with CTA |
| Offline | Cached results with stale banner |

---

## M17-S02: Listing Detail

**Route:** `/marketplace/listings/:listingId`
**Workflow:** WF-098
**Auth:** GA (active member)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > Marketplace > {title}
<main role="main">
  <article aria-labelledby="listing-title">
    <section aria-label="Listing details">
    <section aria-label="Vendor information">
    <section aria-label="Place order">
      <form aria-label="Order form">
<footer role="contentinfo">
```

### Fields & Controls

| Element | Type | ARIA | Constraints | Maps To |
|---------|------|------|-------------|---------|
| Title | `<h1 id="listing-title">` | -- | -- | data.title |
| Description | `<div>` | -- | -- | data.description |
| Price | `<span>` | `aria-label="Price"` | -- | data.price + data.currency |
| Category tags | Badge list | `aria-label="Categories"` | -- | data.categoryTags |
| Vendor name | `<a>` | -- | -- | data.vendorName |
| Verified badge | `<span>` | `aria-label="Verified vendor"` | Always true on browse | data.vendorVerified |
| Quantity input | `<input type="number">` | `aria-label="Quantity"` | >= 1 | request.quantity |
| Notes | `<textarea>` | `aria-label="Order notes"` | Max 2000 chars | request.notes |
| Place order button | `<button>` | -- | Disabled during submit | POST orders |

### Role-Variant Matrix

| Role | Visible | Hidden | Altered |
|------|---------|--------|---------|
| Active member | Full detail + order form | Admin actions | -- |
| Vendor (own listing) | Full detail | Order form | "Edit listing" button added |
| Platform admin | Full detail | Order form | "Admin actions" dropdown |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | N/A (404 redirect) |
| Loading | Skeleton for title, description, price, vendor section |
| Loaded | Full listing detail rendered |
| Error | "Failed to load listing." with retry and back link |
| Submitting | Order button shows spinner, fields disabled |
| Success | sonner toast "Order placed successfully", redirect to orders |
| Validation error | Inline errors on quantity/notes fields |
| Not found | "Listing not found or no longer available." |
| Listing inactive | "This listing is currently unavailable." |

---

## M17-S03: Vendor Registration

**Route:** `/marketplace/vendors/register`
**Workflow:** WF-097
**Auth:** GA (any authenticated user)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > Marketplace > Register as Vendor
<main role="main">
  <section aria-label="Vendor registration">
    <form aria-label="Vendor registration form">
<footer role="contentinfo">
```

### Fields & Controls

| Element | Type | ARIA | Required | Constraints | Maps To |
|---------|------|------|----------|-------------|---------|
| Business name | `<input type="text">` | `aria-required="true"` | Yes | 1-300 chars | businessName |
| Category | `<select>` | `aria-required="true"` | Yes | emr, supplies, insurance, telehealth, other | category |
| Description | `<textarea>` | `aria-required="true"` | Yes | 1-5000 chars | description |
| Contact email | `<input type="email">` | `aria-required="true"` | Yes | Valid email | contactEmail |
| Website URL | `<input type="url">` | -- | No | Valid URL | websiteUrl |
| Submit | `<button type="submit">` | -- | -- | Disabled during submit | POST register |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | Blank form, all fields empty |
| Loading | N/A (static form) |
| Loaded | Form ready for input |
| Submitting | Button spinner, fields disabled |
| Success | sonner toast "Registration submitted. Pending admin verification." |
| Validation error | Inline errors per field |
| Conflict | "A vendor with this email already exists." alert |
| Already registered | "You are already registered as a vendor." with link to dashboard |
| Unauthorized | Redirect to `/auth/sign-in` |

---

## M17-S04: Vendor Dashboard

**Route:** `/marketplace/vendor`
**Workflow:** WF-097
**Auth:** Verified vendor

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">            -- Breadcrumb: Home > Marketplace > Vendor Dashboard
<main role="main">
  <section aria-label="Vendor status">
    <div role="status" aria-live="polite">
  <section aria-label="My listings">
    <div role="toolbar" aria-label="Listing actions">
    <table role="table" aria-label="Listings">
  <section aria-label="Orders received">
    <table role="table" aria-label="Vendor orders">
<footer role="contentinfo">
```

### Layout

| Zone | Content |
|------|---------|
| Status banner | Verification status badge (pending/verified/suspended) |
| Listings section | Table of own listings with status, actions |
| Orders section | Recent orders with status, buyer info |
| Actions | "Add Listing" button (disabled if not verified) |

### Role-Variant Matrix

| Role | Visible | Hidden | Altered |
|------|---------|--------|---------|
| Verified vendor | Full dashboard, add listing enabled | -- | -- |
| Pending vendor | Status banner only | Listings, orders | "Awaiting verification" message |
| Suspended vendor | Status banner, read-only listings | Add listing, order actions | "Account suspended" alert |

### 9 States

| State | Behavior |
|-------|----------|
| Empty (no listings) | "No listings yet. Create your first listing." CTA |
| Loading | Skeleton table rows |
| Loaded | Listings table + orders table |
| Error | "Failed to load dashboard." retry |
| Pending verification | Banner: "Your vendor application is under review." |
| Suspended | Alert: "Your vendor account has been suspended. Contact support." |
| No orders | Orders section: "No orders yet." |
| Partial | Listings loaded, orders loading (independent queries) |
| Offline | Cached data with stale indicator |

---

## M17-S05: Vendor Listing Editor

**Route:** `/marketplace/vendor/listings/new` or `/marketplace/vendor/listings/:listingId/edit`
**Workflow:** WF-097
**Auth:** Verified vendor (own listings) or PA (super, admin)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">
<main role="main">
  <section aria-label="Listing editor">
    <form aria-label="Create listing" or "Edit listing">
<footer role="contentinfo">
```

### Fields & Controls

| Element | Type | ARIA | Required | Constraints | Maps To |
|---------|------|------|----------|-------------|---------|
| Title | `<input type="text">` | `aria-required="true"` | Yes | 1-300 chars | title |
| Description | `<textarea>` | `aria-required="true"` | Yes | 1-5000 chars | description |
| Price | `<input type="number">` | `aria-required="true"` | Yes | > 0, step 0.01 | price |
| Currency | `<select>` | -- | No | ISO 4217 | currency |
| Category tags | Tag input | `aria-label="Category tags"` | No | Max 10 tags, each max 50 chars | categoryTags |
| Status | Radio group | `aria-label="Listing status"` | No | draft, active | status |
| Save | `<button type="submit">` | -- | -- | -- | POST/PUT listing |

### 9 States

| State | Behavior |
|-------|----------|
| Empty (create) | Blank form, defaults applied (currency: USD, status: draft) |
| Loading (edit) | Skeleton form fields |
| Loaded (edit) | Populated form |
| Submitting | Button spinner, fields disabled |
| Success | sonner toast "Listing saved." redirect to dashboard |
| Validation error | Inline errors per field |
| Vendor not verified | Redirect with "Vendor must be verified to create listings." |
| Vendor suspended | Redirect with "Suspended vendors cannot create listings." |
| Not found (edit) | "Listing not found." redirect to dashboard |

---

## M17-S06: My Orders

**Route:** `/marketplace/orders`
**Workflow:** WF-098
**Auth:** GA (active member)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">
<main role="main">
  <section aria-label="My orders">
    <table role="table" aria-label="Order history">
<footer role="contentinfo">
```

### Table Columns

| Column | Content | Sortable |
|--------|---------|----------|
| Order date | createdAt formatted | Yes |
| Listing | title (linked) | No |
| Vendor | vendorName | No |
| Quantity | quantity | No |
| Total | totalPrice + currency | Yes |
| Status | Badge: pending/confirmed/fulfilled/cancelled/refunded | Yes |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | "No orders yet. Browse the marketplace." CTA |
| Loading | Skeleton table rows (5) |
| Loaded | Order table rendered |
| Error | "Failed to load orders." retry |
| Partial | Paginated with "Load more" |
| Cancelling | Confirmation dialog, then optimistic update |
| Cancel success | sonner toast "Order cancelled." row status updated |
| Unauthorized | Redirect to `/auth/sign-in` |
| Forbidden | "Active membership required." |

---

## M17-S07: Vendor Orders

**Route:** `/marketplace/vendor/orders`
**Workflow:** WF-097
**Auth:** Verified vendor

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">
<main role="main">
  <section aria-label="Vendor orders">
    <div role="toolbar" aria-label="Order filters">
    <table role="table" aria-label="Orders received">
<footer role="contentinfo">
```

### Table Columns

| Column | Content | Sortable |
|--------|---------|----------|
| Order date | createdAt | Yes |
| Listing | title | No |
| Buyer | buyerPersonId (resolved name) | No |
| Quantity | quantity | No |
| Total | totalPrice | Yes |
| Status | Badge with action buttons | Yes |
| Actions | Confirm / Fulfill / Cancel based on status | -- |

### Action Rules per Status

| Current Status | Available Actions |
|----------------|-------------------|
| pending | Confirm, Cancel |
| confirmed | Fulfill, Cancel |
| fulfilled | -- (terminal for vendor) |
| cancelled | -- (terminal) |
| refunded | -- (terminal) |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | "No orders received yet." |
| Loading | Skeleton rows |
| Loaded | Order table with action buttons |
| Error | Retry prompt |
| Confirming | Confirmation dialog for status change |
| Updating | Optimistic status badge update, spinner on action button |
| Update success | sonner toast "Order {action}." |
| Update error | Revert optimistic update, sonner error toast |
| Suspended | Read-only view with suspension banner |

---

## M17-S08: Admin Vendor Management

**Route:** `/admin/marketplace/vendors`
**Workflow:** WF-099
**Auth:** PA (super, admin)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">
<main role="main">
  <section aria-label="Vendor management">
    <div role="toolbar" aria-label="Vendor filters">
    <table role="table" aria-label="Vendor list">
<footer role="contentinfo">
```

### Table Columns

| Column | Content | Sortable |
|--------|---------|----------|
| Business name | businessName (linked to detail) | Yes |
| Category | category | Yes |
| Contact email | contactEmail | No |
| Status | Badge: pending/verified/suspended/rejected | Yes |
| Registered | createdAt | Yes |
| Actions | View detail link | -- |

### Filters

| Filter | Type | Options |
|--------|------|---------|
| Status | `<select>` | All, pending, verified, suspended, rejected |
| Category | `<select>` | emr, supplies, insurance, telehealth, other |

### 9 States

| State | Behavior |
|-------|----------|
| Empty | "No vendors registered." |
| Loading | Skeleton rows |
| Loaded | Vendor table rendered |
| Error | Retry prompt |
| Filtering | Skeleton overlay on table |
| Partial | Paginated |
| Unauthorized | Redirect to `/auth/sign-in` |
| Forbidden | "Platform admin access required." |
| Offline | Cached data with stale banner |

---

## M17-S09: Admin Vendor Detail

**Route:** `/admin/marketplace/vendors/:vendorId`
**Workflow:** WF-097, WF-099
**Auth:** PA (super, admin)

### ARIA Landmark Structure

```
<header role="banner">
<nav role="navigation">           -- Breadcrumb: Admin > Vendors > {businessName}
<main role="main">
  <section aria-label="Vendor details">
  <section aria-label="Verification actions">
    <div role="toolbar" aria-label="Vendor actions">
  <section aria-label="Vendor listings">
    <table role="table" aria-label="Listings">
<footer role="contentinfo">
```

### Vendor Detail Fields

| Field | Display |
|-------|---------|
| businessName | `<h1>` |
| category | Badge |
| description | `<p>` |
| contactEmail | `<a href="mailto:">` |
| websiteUrl | `<a>` (if present) |
| verificationStatus | Status badge |
| createdAt | Formatted date |

### Action Buttons per Status

| Current Status | Available Actions |
|----------------|-------------------|
| pending | Verify, Reject |
| verified | Suspend |
| suspended | Reinstate (verify) |
| rejected | -- (terminal) |

### Confirmation Dialogs

| Action | Dialog |
|--------|--------|
| Verify | "Verify {businessName} as a marketplace vendor?" |
| Reject | "Reject vendor application for {businessName}? This cannot be undone." |
| Suspend | "Suspend {businessName}? All listings will be hidden from members." (M17-R3) |
| Reinstate | "Reinstate {businessName}? Listings will become visible again." |

### 9 States

| State | Behavior |
|-------|----------|
| Loading | Skeleton for detail + listings table |
| Loaded | Full vendor detail with actions |
| Error | "Failed to load vendor." retry |
| Not found | "Vendor not found." back link |
| Action confirming | Confirmation dialog open |
| Action submitting | Dialog button spinner |
| Action success | sonner toast "Vendor {action}." status badge updated |
| Action error | sonner error toast, dialog dismissed |
| Unauthorized | Redirect |
