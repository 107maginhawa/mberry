# One-Tap Payment Page

- **Route:** `/pay/[token]`
- **Module:** M06 Dues & Payments
- **Access:** Public (tokenized, no login required — arrived via reminder email link)
- **Desktop:** ✓ | **Mobile:** ✓ (primary surface — most users tap this link from a mobile email or push notification)

## Purpose

Allow a member to pay their dues in one tap from a reminder email or notification link, without needing to log in, by presenting a pre-filled checkout page that forwards to the gateway.

## Layout

### Desktop
Single-page checkout, minimal and focused — no sidebar, no main navigation. Org branding (logo + org name) centered at the top, communicating whose dues are being paid. Below the branding: a summary card with member name, amount due, membership category, and the new expiry date that will result from payment. A prominent "Pay Now" button below the card. A secondary "Already paid? Contact your treasurer." text link below the button. Platform wordmark in the footer.

### Mobile
Same structure, full-width. Org logo and name at the top. Summary card fills the width with generous padding. "Pay Now" is a large, full-width button — easy to tap. "Already paid?" link below with sufficient tap target. No elements that require horizontal scrolling. The page is short enough to show the Pay Now button without scrolling on most phone screen sizes.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Org logo | image | Organization's uploaded logo; falls back to org initials in a circle |
| Org name | text | Organization name sourced from token |
| Member name | text | Member's full name sourced from token — confirms the payment is for the right person |
| Amount due | text (large, prominent) | Currency-formatted dues amount for the member's category |
| Membership category | text | Category name (e.g., Regular, Associate) — explains why this amount applies |
| New expiry date | text | "Your membership will be active until [date]" — shows the concrete outcome of paying now |
| Pay Now | button (primary, large) | Redirects to the org's configured PayMongo or Stripe hosted checkout with amount pre-filled; disabled while redirect is initiating |
| Already paid? Contact your treasurer. | link | Static text link with no navigation — surfaces treasurer contact info from org profile, or directs to login if member wants to view their history |
| Payment processing indicator | full-page overlay | Shown after returning from the gateway checkout while webhook confirmation is pending |
| Status card | full-page | Replaces the payment form after payment is confirmed, failed, or when token is invalid/expired/already paid (see States) |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page loads from QR/email link | Token validated server-side; page server-rendered; skeleton for < 300ms while validating |
| Valid token | Token is valid, member's dues are outstanding | Payment form displayed: org branding, member name, amount, category, new expiry, Pay Now button |
| Already paid | Token is valid but member's dues are already current (Active status, expiry in future) | Payment form replaced with: "Your dues are already current. Your membership is active until [date]." Green checkmark. No Pay Now button shown. |
| Error: Token expired | Token is older than 30 days | Full-page message: "This payment link has expired. Please log in to your account or contact your chapter treasurer for a new link." |
| Error: Token invalid | Token fails HMAC validation | Full-page message: "This payment link is not valid." No payment option shown. |
| Error: Gateway not configured | Org has no connected payment gateway | Full-page message: "Online payment is not available for this organization. Contact your treasurer." Treasurer contact info from org profile shown if available. |
| Redirecting to gateway | User clicks "Pay Now" | Brief spinner on button ("Connecting to payment service..."); page then redirects to PayMongo or Stripe hosted checkout |
| Payment processing | User returns from gateway; webhook not yet confirmed | Full-page message: "Processing your payment..." with a spinner and note: "Your payment is being confirmed. This usually takes a few minutes." Auto-polls for webhook confirmation (every 5 seconds); updates on completion without requiring page refresh. |
| Payment success | Webhook confirms payment completed | Full-page success: large green checkmark; "Payment confirmed! Your membership is active until [date]." Receipt download button. |
| Payment failed | Gateway reports payment failure or user abandons checkout | Full-page error: "Payment failed. [Gateway error message if available]." "Try Again" button reloads the Pay Now flow for the same token. |
| Error: Gateway unavailable | Gateway API is unreachable when initiating checkout | Full-page message: "Payment service is temporarily unavailable. Please try again later or contact your chapter treasurer." No payment record created. |

## Interactions

- No login is required at any point; the signed token in the URL encodes org_id, member_id, amount, and expiry — sufficient to initiate payment without authentication.
- The token is valid for 30 days from generation (M6-R5); after that, the member must log in to pay or receive a new reminder.
- The token is single-use per successful payment — if the first payment attempt fails, the same token can be used to retry (not invalidated on failure, only on success).
- After payment success on the gateway side, the platform receives a webhook (M6-R9); the page polls every 5 seconds and updates automatically when the webhook is processed — the member does not need to refresh.
- If the webhook is delayed beyond the polling window (~2 minutes), the page shows: "Your payment is being confirmed. This usually takes a few minutes." and the member is instructed to check their email for a receipt.
- The "Already paid?" link does not navigate away from the page; it reveals the treasurer's contact email (from org profile) inline so the member can reach out without losing their place.
- Fund allocation is executed server-side on webhook confirmation (M6-R3 algorithm); the member-facing page shows only the total amount and new expiry — no fund breakdown is shown on this public page.
- A PDF receipt is emailed to the member after payment confirmation; a "Download Receipt" button also appears on the success state for immediate access.
- Duplicate webhook events are handled idempotently (M6-R8); if the member somehow reaches the success state and the gateway sends a duplicate webhook, no second payment or membership extension is created.
