# New Association

- **Route:** `/admin/associations/new`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Allow a Super Admin to provision a new top-level association tenant with all required configuration — locale, license format, and credit cycle defaults — before any organizations are created within it.

## Layout

Single-column form page with a clear header ("Create Association") and a two-column grid for related field groups on wider viewports. The form is divided into three logical sections separated by section headers: Basic Info, Locale & Compliance, and Credit Cycle Defaults. A sticky footer contains the primary "Create Association" and secondary "Cancel" action buttons. No sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Association name | Text input | Required. Validated unique on blur: shows "An association with this name already exists." if duplicate. |
| Country | Dropdown | Required. Lists countries configured in `/admin/locale`. If a needed country is not listed, shows a note: "Configure country settings first." with a link to `/admin/locale`. |
| Currency | Text input | Auto-populated from country selection; editable. Shows ISO code and symbol. |
| Date format | Read-only display | Pulled from country config; shown so admin can confirm. |
| Language | Dropdown | Pre-populated from country; editable if country supports multiple languages. |
| License format (regex) | Text input | Required. Admin enters a regular expression defining valid license numbers (e.g., `^PRC-\d{7}$`). |
| License format test field | Inline validator | Text input below the regex field labeled "Test with a sample license number." On input, immediately shows "Valid" (green) or "Invalid" (red). If the regex itself is malformed, shows "The license format pattern is invalid. Check your regular expression syntax." |
| Credit cycle period | Radio group | Options: 1 year, 2 years, 3 years. Required. |
| Required credits per cycle | Number input | Integer. Required. |
| Excess carryover | Toggle | On = unused credits roll into the next cycle; Off = they expire at cycle end. Default Off. |
| "Create Association" | Primary button | Disabled until all required fields are valid. On submit: shows loading spinner inline, then redirects to the new association's detail page on success. |
| "Cancel" | Secondary button | Returns to `/admin/associations` without saving. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Form skeleton for one second max; fields render immediately as data (country list) loads. |
| Validation error | Submit with invalid/missing fields | Inline error messages below each invalid field. Form does not submit. |
| Duplicate name | Name already exists | "An association with this name already exists." shown below the name field on blur; submit button remains disabled. |
| Invalid regex | Malformed regular expression | "The license format pattern is invalid." shown below the regex field in real time. |
| Submitting | Create button clicked | Button enters loading state with spinner; form fields are disabled during the request. |
| Success | Association created | Redirect to `/admin/associations/[new-id]`. Success toast: "Association created." |
| Server error | API returns error | Toast: "Could not create association. [specific error message]. Please try again." Form remains editable. |

## Interactions

- Country selection auto-populates Currency and Date Format fields; admin can override currency.
- License regex field and test field are interactive simultaneously — as the admin edits the regex, the test field re-validates any sample value already entered.
- "Cancel" does not prompt for confirmation (no data loss risk until submission).
- After successful creation, the admin lands on the new association's detail page and can immediately proceed to add organizations (capability 3.2 / journey PA-2).
