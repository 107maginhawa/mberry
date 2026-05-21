<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M17 Marketplace -- Interaction States

## Module-Wide 9 State Patterns

### 1. Empty State

| Screen | Trigger | Display |
|--------|---------|---------|
| M17-S01 (Browse) | No listings match filters | Illustration + "No listings found. Try adjusting your filters." + clear filters button |
| M17-S04 (Vendor Dashboard) | Vendor has no listings | "No listings yet. Create your first listing." + CTA button |
| M17-S06 (My Orders) | Member has no orders | "No orders yet. Browse the marketplace." + browse link |
| M17-S07 (Vendor Orders) | No orders received | "No orders received yet." |
| M17-S08 (Admin Vendors) | No vendors registered | "No vendors registered." |

**ARIA:** `role="status"` with `aria-live="polite"` on empty state container.

### 2. Loading State

| Context | Skeleton Pattern |
|---------|-----------------|
| Listing grid (M17-S01) | 6 skeleton cards in grid layout matching responsive breakpoint |
| Listing detail (M17-S02) | Skeleton for image, title block, description block, price, vendor section |
| Tables (M17-S06, S07, S08) | 5 skeleton rows matching column widths |
| Dashboard (M17-S04) | Status banner skeleton + listing table skeleton |
| Forms (M17-S03, S05) | N/A -- forms render immediately |

**ARIA:** `aria-busy="true"` on container during load. `aria-live="polite"` announces load completion.

### 3. Loaded State

Standard render. All data available, interactive elements enabled.

- Listing cards clickable with hover/focus states
- Tables sortable via header clicks
- Action buttons contextually enabled per role and entity status
- Filter bar fully interactive
- Pagination controls visible when hasMore is true

### 4. Error State

| Error Type | Display | Recovery |
|------------|---------|----------|
| Network error | "Failed to load. Check your connection." | Retry button |
| Server error (5xx) | "Something went wrong. Try again." | Retry button |
| Not found (404) | "Not found." with back navigation | Navigate back |
| Specific API error | Error code mapped to user message | Context-specific CTA |

**ARIA:** `role="alert"` with `aria-live="assertive"` on error container.

**Error Code Mapping:**

| API Error Code | User Message |
|----------------|-------------|
| M17-001 | "Vendor must be verified before creating listings." |
| M17-002 | "This listing is no longer available." |
| M17-003 | "Vendor account is suspended." |
| M17-004 | "Vendor has been rejected." |
| CONFLICT-002 | "A vendor with this email already exists." |
| VALIDATION-001 | Field-level inline errors |
| NOT_FOUND-001 | "Not found." |
| AUTHZ-001 | "You don't have permission to perform this action." |
| AUTH-001 | Redirect to `/auth/sign-in` |

### 5. Partial / Paginated State

| Context | Pattern |
|---------|---------|
| Listing grid | Cards rendered + "Load more" button at bottom. Button disabled during fetch. |
| Order tables | Rows rendered + "Load more" row at bottom of table. |
| Vendor table | Same as order tables. |

**ARIA:** "Load more" button includes `aria-label="Load more listings ({n} shown)"`.

**Cursor pagination**: Uses `after` cursor from API response. No page numbers.

### 6. Submitting / Mutating State

| Mutation | Optimistic? | UI |
|----------|-------------|-----|
| Place order | No | Button spinner, fields disabled. Wait for server response. |
| Vendor registration | No | Button spinner, fields disabled. |
| Create/edit listing | No | Button spinner, fields disabled. |
| Vendor status change (admin) | No | Dialog button spinner. Confirmation dialog stays open. |
| Order status change (vendor) | Yes | Badge updates immediately. Reverts on error. |
| Cancel order (buyer) | No | Confirmation dialog, then spinner. |

**ARIA:** `aria-disabled="true"` on submit buttons during mutation. `aria-busy="true"` on form.

### 7. Success State

All success states use **sonner** toasts (not shadcn useToast).

| Action | Toast Message | Post-Action |
|--------|--------------|-------------|
| Vendor registered | "Registration submitted. Pending admin verification." | Redirect to `/marketplace/vendor` |
| Listing created | "Listing created." | Redirect to vendor dashboard |
| Listing updated | "Listing updated." | Redirect to vendor dashboard |
| Order placed | "Order placed successfully." | Redirect to `/marketplace/orders` |
| Order cancelled | "Order cancelled." | Row status updated inline |
| Order confirmed | "Order confirmed." | Row status updated inline |
| Order fulfilled | "Order marked as fulfilled." | Row status updated inline |
| Vendor verified | "Vendor verified." | Status badge updated inline |
| Vendor rejected | "Vendor rejected." | Status badge updated inline |
| Vendor suspended | "Vendor suspended. Listings hidden." | Status badge updated inline |
| Vendor reinstated | "Vendor reinstated. Listings visible." | Status badge updated inline |

### 8. Validation Error State

| Form | Validation Approach |
|------|---------------------|
| Vendor registration | Client-side: required fields, email format, URL format. Server-side: CONFLICT-002. |
| Listing editor | Client-side: required fields, price > 0, tag count <= 10. Server-side: M17-001, M17-003. |
| Order form | Client-side: quantity >= 1, notes <= 2000. Server-side: M17-002. |

**Pattern:**
- Inline errors below each invalid field: `<p id="error-{field}" role="alert">{message}</p>`
- Field referenced via `aria-describedby="error-{field}"`
- Error summary at form top for server errors: `role="alert"` with `aria-live="assertive"`
- Focus moves to first invalid field on submit attempt

### 9. Unauthorized / Forbidden State

| Condition | Behavior |
|-----------|----------|
| No session (AUTH-001) | Redirect to `/auth/sign-in` with return URL |
| Not active member (M17-R1) | "Active membership required to browse marketplace." + membership CTA |
| Not platform admin (AUTHZ-001 on admin routes) | "Platform admin access required." |
| Vendor not verified (accessing dashboard features) | Pending verification banner, features disabled |
| Vendor suspended | Suspension banner, all write operations disabled |

**ARIA:** Forbidden state uses `role="alert"` with descriptive message.
