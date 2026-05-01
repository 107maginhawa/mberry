# Association Billing

- **Route:** `/admin/associations/[id]/billing`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super, Analyst read-only)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give operators a complete view of an association's platform subscription billing — current plan, payment history, outstanding balances, and trial conversion status — and allow Super Admins to take billing actions.

## Layout

Full-width page with a breadcrumb ("Associations > [Name] > Billing"). A summary header card shows the current plan, billing status, and next billing date. Below the summary, two side-by-side panels: a billing actions panel on the left (narrower) and a payment history table on the right (wider). Below both panels: a per-org trial conversion tracker table listing all orgs in this association with their subscription status. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Breadcrumb | Navigation | Links back to association detail and list. |
| Current plan summary card | Display card | Plan tier name, member count bracket, monthly price, billing cycle start/end dates, subscription status (Trial / Active / Past Due / Cancelled). |
| Next billing date | Display | Date + "in N days" countdown. Red if past due. |
| Payment method on file | Display | Card type + last 4 digits, or "No payment method on file" in amber if missing. |
| Billing action: Retry Payment | Button | Available when latest invoice status is "Failed." Triggers immediate gateway retry; outcome shown as toast. |
| Billing action: Change Plan | Button | Super only. Opens a modal to select a different pricing tier. Shows a note: "Plan changes apply at next renewal. Current tier remains active until [date]." |
| Billing action: Cancel Subscription | Button | Super only. Destructive. Requires confirmation dialog with reason field. |
| Payment history table | Table | Columns: Date, Invoice Number (downloadable PDF link), Amount, Status (Paid/Failed/Refunded/Pending). Sortable by date. |
| Failed payment row | Highlighted row | Amber background. Shows error message from gateway (truncated, expandable). "Retry" inline button. |
| Per-org trial tracker | Table | Columns: Org Name, Org Status, Trial Expiry, Days Remaining, Conversion Status. "Extend Trial" button per org in Trial status. Sorted by soonest expiry. |
| "Extend Trial" modal | Modal | Date picker for new end date (minimum = tomorrow, maximum = 180 days from org creation). Required reason field. "Save" logs the extension in the audit trail and notifies the org officer. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton for summary card and both panels. |
| No billing history | New association, no invoices | Payment history table shows: "No billing activity yet. History will appear once the first invoice is generated." |
| Past due | Subscription status = Past Due | Summary card border turns red. Banner: "This association has an outstanding payment. Resolve to restore full access." |
| No payment method | Payment method missing | Summary card shows amber warning: "No payment method on file. The association officer must add one to continue service." |
| All trials expired | All orgs cancelled or converted | Trial tracker table shows: "No active trial organizations." |
| Error | Fetch fails | Inline error per section with retry. |

## Interactions

- "Retry Payment" is disabled while a retry is in flight; re-enables after the result (success or failure) is returned.
- Payment method changes are made by the org/association officer through their own billing portal; admins can view but not edit the card details (PCI compliance).
- "Change Plan" modal shows all configured pricing tiers with their member count ranges and prices; admin selects one, confirms, and a note is added to the audit trail.
- Invoice PDF links download directly from the payment gateway; they open in a new tab.
- "Extend Trial" sends an automated email to the org's founding officer confirming the extension.
