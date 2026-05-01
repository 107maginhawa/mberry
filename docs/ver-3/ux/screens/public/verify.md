# QR Verification Result

- **Route:** `/verify/[token]`
- **Module:** M05 Membership
- **Access:** Public (tokenized, no login required — designed for in-person scanning by a non-member verifier)
- **Desktop:** ✓ | **Mobile:** ✓ (primary surface — scanned from a QR code with a phone)

## Purpose

Instantly show a verifier (event staff, clinic receptionist, another officer) whether a member is in good standing when they scan the member's QR code, without requiring the verifier to have an account.

## Layout

### Desktop
Centered card (max-width 480px) on a clean, minimal background. Large status indicator at the top — a colored circle with an icon (checkmark for active, warning for grace, X for lapsed/invalid). Below the indicator: member name, org name, membership category, and current status label. Below that: membership expiry date. Minimal platform branding in the footer — not full navigation.

### Mobile
Full-width card that fills most of the viewport — optimized for quick at-a-glance reading from arm's length. The status indicator is large (80px+ circle) and uses high-contrast color (green/yellow/red) so it reads immediately before the verifier reads any text. Member name and status label in large type below the icon. Expiry date below in smaller secondary text. No navigation bar; the page is self-contained. Platform wordmark at the bottom as minimal branding.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Status indicator | icon + color | Large circle: green checkmark = Active, yellow warning = Grace, red X = Lapsed or Suspended; color and icon communicate status at a glance before reading text |
| Status label | text (large) | Text equivalent of the status: "Active Member", "Grace Period", "Lapsed", "Suspended", "Not a Member" |
| Member name | text | Full name of the member whose QR code was scanned |
| Organization | text | Org name that issued this membership/QR code |
| Membership category | text | Category name (e.g., Regular, Life, Associate) |
| Expiry date | text | "Valid until [date]" for active memberships; "Expired [date]" for lapsed; "N/A" for Life members |
| Platform wordmark | branding | Minimal "Powered by Memberry" link to `/`; does not distract from verification result |
| Token error card | full-page | Replaces the verification card when the token is invalid or cannot be resolved (see States) |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page loads after QR scan | Brief skeleton (< 500ms target); the token is resolved server-side; page is server-rendered for speed |
| Active | Member's computed status is Active (dues current) | Green circle with checkmark; "Active Member" in large green text; expiry date shown; member name and org displayed |
| Grace | Member's computed status is Grace (dues expired, within grace period) | Yellow circle with warning icon; "Grace Period" label; expiry date shown with note: "Dues expired — within grace period" |
| Lapsed | Member's computed status is Lapsed (past grace period) | Red circle with X; "Lapsed" label; expiry date shown as "Expired [date]"; no renewal action on this page (verifier-facing only) |
| Suspended | Member has a Suspended status override | Red circle with X; "Suspended" label; no expiry date shown; no reason shown publicly |
| Life Member | Member's category is Life | Green circle with checkmark; "Active Member — Life Member" label; expiry shows "Lifetime membership" |
| Error: Token expired | Verification token is past its validity window | Card replaced with: "This verification link has expired. Ask the member to generate a new QR code from their dashboard." No member data shown. |
| Error: Token invalid | Token fails validation (malformed, tampered) | Card replaced with: "This verification link is not valid." No member data shown. |
| Error: Member not found | Token resolves but member record is missing | Card replaced with: "Member not found. This QR code may be from a previous membership." |

## Interactions

- The page is entirely read-only — the verifier has no actions to take other than reading the result.
- No login is required; the token encodes sufficient information to render the verification result securely.
- The status shown reflects the computed membership status at the moment the page loads (real-time, not cached from when the QR code was generated).
- Life members always show as Active regardless of any expiry date (M5-R5 sentinel value of 2099-12-31).
- The page does not expose the member's email, license number, phone, or any other PII — only name, org, category, status, and expiry are shown to the verifier.
- The member generates this QR code from their own dashboard; the token in the URL is signed and time-limited to prevent forgery.
- On mobile, the status color is the first thing visible as the page loads — layout prioritizes the status indicator above member details.
