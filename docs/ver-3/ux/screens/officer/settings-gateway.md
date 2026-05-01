# Payment Gateway Setup

- **Route:** `/org/[id]/officer/settings/gateway`
- **Module:** M06 Dues & Payments
- **Access:** Treasurer
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Lets the Treasurer connect, test, and manage the org's payment gateway (PayMongo or Stripe) so members can pay dues and activity fees online.

## Layout

### Desktop
Desktop-only screen. Not accessible on mobile devices. Sidebar navigation visible. Main content opens with a status card at the top showing current connection state, then the configuration form below it. A breadcrumb links back to the settings area.

### Mobile
Desktop-only screen. Not accessible on mobile devices.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Status card | Card with badge | Connected state: green "Connected" badge, gateway name (PayMongo / Stripe), last test date, "Disconnect" button (opens disconnect confirmation dialog) and "Run Test Transaction" button. Not connected state: red "Not Connected" badge, "Connect Gateway" prompt message. |
| Gateway Provider selector | Select dropdown | PayMongo / Stripe. Changing provider resets the key fields and shows provider-specific documentation link. |
| Secret Key field | Password input (masked) | Masked with show/hide toggle. Never stored in browser history. Never exposed in API responses — only the last 4 characters are shown after saving. |
| Public Key field | Text input | Visible input. Used for client-side gateway initialization. |
| Test Connection button | Secondary button | Validates API credentials by making a test API call to the gateway (no charge). Does not require all form fields to be saved first. Shows inline result. |
| Run Test Transaction button | Secondary button (connected state only) | Charges PHP 1.00 (or equivalent in org currency) to the gateway account and immediately initiates a refund. Confirms the account is live and can process transactions. |
| Save & Activate button | Primary button | Saves credentials encrypted at rest (per BR-30). Enables online payments for the org. Only active when both keys are entered and a test connection has been verified. |
| Disconnect confirmation dialog | Modal | "Disconnect gateway? Members will not be able to pay online until a new gateway is configured. Pending payments are unaffected." Cancel / Disconnect buttons. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton shimmer on status card and form |
| Not connected | No gateway configured | Red "Not Connected" badge in status card; full configuration form visible; Save & Activate disabled until test passes |
| Testing | Test Connection clicked | "Testing connection..." spinner on button; form fields disabled during test |
| Test success | Gateway credentials validated | Green checkmark inline: "Connection verified." Save & Activate button enables. |
| Test failed | Invalid credentials or gateway error | Red X inline: "Connection failed: [error message]." Form remains editable. Save & Activate remains disabled. |
| Connected | Gateway saved and active | Green "Connected" badge; keys shown masked (last 4 characters only); configuration form hidden; Disconnect and Run Test Transaction buttons visible. |
| Test transaction running | Run Test Transaction clicked | Spinner; "Charging PHP 1.00 and refunding..." message |
| Test transaction success | Test charge succeeded | "Test transaction successful. Your gateway is processing payments correctly." |
| Test transaction failed | Test charge failed | "Test transaction failed. Check your gateway account status and try again." |
| Disconnecting | Disconnect confirmed | Gateway deactivated; status card switches to Not Connected; form reappears for new configuration. |
| Error: save failed | API error on Save & Activate | Toast (error): "Failed to save gateway configuration. Please try again." |

## Interactions

- Changing the Gateway Provider selector resets both the Secret Key and Public Key fields to blank and updates the provider-specific documentation link shown below the selector. Any prior test-connection result is also cleared, and Save & Activate is re-disabled until a new successful test is completed.
- "Test Connection" can be clicked at any time after both key fields are non-empty — it does not require the form to be saved first. During the test the button shows a spinner and both key fields are disabled. On success, a green checkmark and "Connection verified." appear inline and the Save & Activate button enables. On failure, a red X and the specific error message appear inline; the form remains fully editable for correction.
- Save & Activate is only clickable when both key fields are non-empty AND a successful test connection has been verified in the current session. The button is disabled (grayed) in all other states — no tooltip needed since the test-connection result area makes the requirement clear.
- After saving, the configuration form is hidden and the status card switches to the Connected state. Key values are shown masked (only the last 4 characters of each key are visible). The full key values cannot be retrieved from the UI after saving — re-entering and re-testing is required to change them.
- "Run Test Transaction" is only available in the Connected state. Clicking it triggers a PHP 1.00 (or org-currency equivalent) charge and immediate refund on the live gateway account. A spinner and "Charging PHP 1.00 and refunding..." message display during the test. Success and failure results are shown inline in the status card.
- "Disconnect" opens a modal confirmation dialog: "Disconnect gateway? Members will not be able to pay online until a new gateway is configured. Pending payments are unaffected." Clicking "Disconnect" in the dialog deactivates the gateway immediately, switches the status card to Not Connected, and reveals the configuration form for setting up a new gateway. Clicking "Cancel" in the dialog dismisses it without action.
- This screen is desktop-only. Attempting to access it on a mobile device redirects to a "This page is only available on desktop" message with a link back to settings.
