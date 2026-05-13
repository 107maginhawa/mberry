# Memberry Design System

Authoritative design reference for the Memberry product. All values extracted from the approved Variant D preview. This document is technology-agnostic -- it describes design decisions, not implementation details.

---

## 1. Design Philosophy

**Classification:** Calm surface, dense but readable, utility language, minimal chrome.

Memberry is a membership management tool used by healthcare professionals -- doctors, dentists, nurses -- who volunteer as chapter officers between patient appointments. The interface must never compete for cognitive attention with their clinical work.

**Principles:**

- **Trust through clarity.** Healthcare professionals expect precision. Every number, status, and label must be unambiguous. Subtle depth and translucency reinforce hierarchy. Animation serves comprehension (stagger reveals reading order, CountUp draws attention to changes). Decoration that could be mistaken for data is still prohibited.
- **Security UX is intentional.** Authentication, org switching, and sensitive data actions (payments, member suspensions) use deliberate friction -- confirmation steps, clear destructive-action styling -- not just technical gates.
- **Non-technical users.** Every action must be self-explanatory. Officers are elected volunteers, not software professionals. Labels describe what will happen, not system concepts.
- **Empty states are features.** When there is no data, show a warm message, a primary call-to-action, and enough context so the user understands why the screen is empty and what to do next. Never show a blank page or a raw "No results" string.
- **Warm professionalism.** The palette combines muted purple with cream accents. The result feels approachable without being playful -- appropriate for an organization that handles dues, compliance, and credentials.

---

## 2. Color System

### 2.1 Primary Palette (Light Mode)

| Token Name | Role | Hex | Usage |
|---|---|---|---|
| color.primary | Brand anchor | #554B68 | Buttons, sidebar, headings, active indicators |
| color.primary.mid | Hover / secondary | #675D78 | Button hover states, secondary avatars |
| color.primary.light | Muted accent | #9E8890 | Placeholder text role, muted labels, tertiary avatars |
| color.primary.lighter | Soft accent | #C8B4BC | Input placeholder text, disabled borders |
| color.primary.subtle | Tint background | #F0E8EC | Focus rings, hover backgrounds, code snippet backgrounds |
| color.cream | Warm accent | #F2DEB0 | Accent buttons, active nav indicator, accent badges, logo highlight |
| color.cream.light | Cream tint | #F9F0D8 | Accent card backgrounds |
| color.cream.dark | Deep cream | #D4BA82 | Cream button hover, warm heading accent text |

### 2.2 Surface and Background (Light Mode)

| Token Name | Role | Hex | Usage |
|---|---|---|---|
| color.bg | Page background | #FAF7F2 | Body background, main content area |
| color.surface | Card surface | #FFFFFF | Cards, modals, table cells, dropdowns |
| color.surface.warm | Warm surface | #FDF9F3 | Table header rows, hero sections, hover rows |

### 2.3 Text Colors (Light Mode)

| Token Name | Role | Hex | Usage |
|---|---|---|---|
| color.text | Primary text | #2D2635 | Headings, body copy, member names, table data |
| color.text.secondary | Secondary text | #554B60 | Subtitles, descriptions, form labels |
| color.muted | Muted text | #9E8890 | Timestamps, captions, nav section labels, helper text |

### 2.4 Border Colors (Light Mode)

| Token Name | Role | Hex | Usage |
|---|---|---|---|
| color.border | Default border | #E4D8DC | Input borders, card borders, dividers |
| color.border.light | Subtle border | #EDE5E8 | Table row dividers, light card borders, bottom nav border |

### 2.5 Semantic Colors (Light Mode)

| Token Name | Hex | Background Hex | Usage |
|---|---|---|---|
| color.success | #5A8A6B | #EDF5F0 | Active status, payment confirmed, positive trends, CPD on track |
| color.warning | #C4960A | #FDF8E8 | Grace period, due soon, expiring items |
| color.error | #B85454 | #FDF0F0 | Lapsed status, failed payments, negative trends, destructive actions |
| color.info | #5B7EB5 | #EDF2F8 | Pending status, informational notices, upcoming dates |

### 2.6 Membership Status Colors

| Status | Meaning | Foreground | Background | Token |
|---|---|---|---|---|
| Active | Member in good standing, dues current | #5A8A6B (success) | #EDF5F0 | status.active |
| Grace | Dues within grace period, not yet lapsed | #C4960A (warning) | #FDF8E8 | status.grace |
| Lapsed | Dues expired, membership inactive | #B85454 (error) | #FDF0F0 | status.lapsed |
| Pending | Awaiting approval or payment confirmation | #5B7EB5 (info) | #EDF2F8 | status.pending |

### 2.7 Dark Mode Palette

All tokens remap in dark mode. The strategy is inversion with warmth preservation -- dark purple-grey backgrounds, lighter text, and adjusted semantic colors for legibility on dark surfaces.

| Token Name | Light Value | Dark Value |
|---|---|---|
| color.primary | #554B68 | #9E8890 |
| color.primary.mid | #675D78 | #C8B4BC |
| color.primary.light | #9E8890 | #675D78 |
| color.primary.lighter | #C8B4BC | #554B68 |
| color.primary.subtle | #F0E8EC | #2D2635 |
| color.cream | #F2DEB0 | #D4BA82 |
| color.cream.light | #F9F0D8 | #3D3520 |
| color.cream.dark | #D4BA82 | #F2DEB0 |
| color.bg | #FAF7F2 | #1E1A22 |
| color.surface | #FFFFFF | #2A2530 |
| color.surface.warm | #FDF9F3 | #302A36 |
| color.text | #2D2635 | #F0E8EC |
| color.text.secondary | #554B60 | #C8B4BC |
| color.muted | #9E8890 | #8A7E88 |
| color.border | #E4D8DC | #3D3644 |
| color.border.light | #EDE5E8 | #342E3A |
| color.success | #5A8A6B | #6BA87E |
| color.success.bg | #EDF5F0 | #1E2D22 |
| color.warning | #C4960A | #D4AA30 |
| color.warning.bg | #FDF8E8 | #2D2A1A |
| color.error | #B85454 | #D47070 |
| color.error.bg | #FDF0F0 | #2D1E1E |
| color.info | #5B7EB5 | #7B9ED5 |
| color.info.bg | #EDF2F8 | #1E222D |

### 2.8 Shadow

Primary shadow for elevated surfaces (cards, modals, dashboard container):

- Soft: 0 2px 12px rgba(85, 75, 104, 0.10)
- Medium: 0 4px 24px rgba(85, 75, 104, 0.08)
- Deep: 0 8px 32px rgba(85, 75, 104, 0.12)

Note: Shadow base color is derived from primary (#554B68) at varying opacities.

---

## 3. Typography

### 3.1 Font Families

| Role | Family | Fallback Stack | Usage |
|---|---|---|---|
| Display | General Sans | system sans-serif | Page titles, section headings (H1-H4), stat values, greeting headlines, logo text, navigation labels (active) |
| Body | Plus Jakarta Sans | system sans-serif | Body paragraphs, form labels, table data, button labels, alert text, captions, descriptions |
| Mono | JetBrains Mono | system monospace | Numeric data in tables (dues amounts, credit scores), dates when displayed in tabular format, code/system identifiers, hex color labels |

### 3.2 Type Scale

| Level | Family | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|---|
| Hero Title | General Sans | 52px | 700 (Bold) | 1.08 | Normal | Landing pages, marketing hero |
| H1 / Page Title | General Sans | 30px | 700 (Bold) | 1.2 | Normal | Stat card large values |
| H2 / Section Title | General Sans | 26px | 700 (Bold) | 1.2 | Normal | Dashboard greeting, page headings |
| H3 / Card Title | General Sans | 20px | 700 (Bold) | 1.2 | Normal | Logo text, sidebar brand |
| H4 / Subsection | General Sans | 16px | 600 (Semibold) | 1.3 | Normal | Table container titles, card section headings |
| Section Label | General Sans | 13px | 600 (Semibold) | 1.4 | 1.5px uppercase | Section dividers, component group labels |
| Body | Plus Jakarta Sans | 16px | 400 (Regular) | 1.75 | Normal | Paragraphs, descriptions |
| Body Small | Plus Jakarta Sans | 14px | 400-600 | 1.6 | Normal | Table cells, nav items, button text, alert text, form inputs |
| Caption | Plus Jakarta Sans | 13px | 500-600 | 1.5 | Normal | Stat labels, input labels, helper text |
| Micro | Plus Jakarta Sans | 12px | 600 (Semibold) | 1.4 | Normal | Badges, stat change indicators, member email/subtitle |
| Overline | Various | 10-11px | 600 (Semibold) | 1.3 | 1-1.5px uppercase | Nav section headers, type specimen labels, table headers (12px at 0.8px) |
| Mono Data | JetBrains Mono | 13px | 400-500 | 1.5 | Normal | Code identifiers, system tokens |
| Mono Label | JetBrains Mono | 11px | 500 | 1.3 | 1px uppercase | Type labels, hex values, swatch codes |

### 3.3 Numeric Display

All monetary values and numeric statistics use `tabular-nums` (font-variant-numeric: tabular-nums) so digits align vertically in columns. This applies to:

- Stat card values (member counts, dues totals, percentages)
- Table amount columns
- Credit scores and progress numbers
- Dues amounts on mobile cards

### 3.4 Heading Accent Pattern

Display headings may use the cream-dark color (#D4BA82 light / #F2DEB0 dark) on a secondary word for visual warmth. Example: "Healthcare," in primary color followed by "organized." in cream-dark. Use sparingly -- one accent word per hero heading maximum.

---

## 4. Spacing System

### 4.1 Base Unit

4px grid. All spacing values are multiples of 4.

### 4.2 Scale

| Token | Value | Common Usage |
|---|---|---|
| space.1 | 4px | Tight inline gaps (badge internal padding vertical, icon-to-text micro gap) |
| space.2 | 8px | Badge horizontal padding base, small gaps between inline elements, type label bottom margin |
| space.3 | 12px | Badge horizontal padding, color grid gap, mobile card bottom margin, nav section padding |
| space.4 | 16px | Card internal padding (mobile), input padding horizontal, alert padding, type grid gap |
| space.5 | 20px | Card padding (desktop), stat card padding, mobile content padding, table cell padding |
| space.6 | 24px | Section title bottom margin, sidebar logo padding, component card padding, nav item padding horizontal |
| space.8 | 32px | Palette strip bottom margin, mobile section gap |
| space.10 | 40px | (Reserved for larger internal separations) |
| space.12 | 48px | Section vertical padding, hero internal padding, page footer padding |
| space.16 | 64px | (Reserved for major section breaks) |
| space.20 | 80px | (Reserved for page-level vertical rhythm) |
| space.24 | 96px | (Reserved for maximum section separation) |

### 4.3 Component Internal Padding

| Component | Padding |
|---|---|
| Button (medium) | 10px vertical, 22px horizontal |
| Button (small) | 7px vertical, 16px horizontal |
| Input field | 11px vertical, 16px horizontal |
| Alert | 12px vertical, 16px horizontal |
| Badge / Status pill | 4px vertical, 12px horizontal |
| Card (desktop) | 20-24px all sides |
| Card (mobile) | 16px all sides |
| Stat card | 20px all sides |
| Table header cell | 10px vertical, 20px horizontal |
| Table body cell | 14px vertical, 20px horizontal |
| Sidebar nav item | 10px vertical, 24px horizontal |
| Mobile bottom nav | 0px vertical, 8px horizontal (container); items use flex centering |

### 4.4 Section Spacing

| Context | Spacing |
|---|---|
| Between page sections | 48px vertical padding |
| Between section title and content | 24px |
| Between stat cards (grid gap) | 14px |
| Between component cards (grid gap) | 20px |
| Dashboard topbar to content | 28px |
| Mobile card stack gap | 12px |

---

## 5. Border Radius

| Token | Value | Usage |
|---|---|---|
| radius.sm | 8px | Buttons, inputs, alerts, badges (non-pill), code snippets |
| radius.md | 12px | Cards, stat cards, table containers, mobile action buttons, mobile cards |
| radius.lg | 18px | Hero panels, palette strips, dashboard wrapper |
| radius.full | 9999px (or 100px / 50%) | Status pill badges, avatar circles, progress bars, variant badges |

Note: Badges and status pills use full radius (pill shape). Avatars use 50% (circle).

---

## 6. Component Catalog

### 6.1 Buttons

**Purpose:** Trigger actions. Every button label describes the outcome ("Pay Dues", "Export CSV", "Add Member"), never the mechanism.

**Anatomy:** Label text, optional leading icon. No trailing icons.

**Variants:**

| Variant | Background | Text Color | Border | Usage |
|---|---|---|---|---|
| Primary | color.primary (#554B68) | White | None | Primary page action: pay dues, save, confirm |
| Cream | color.cream (#F2DEB0) | color.primary (#554B68) | None | Secondary warm action: view credits, view details |
| Outline | Transparent | color.primary (#554B68) | 1.5px solid color.border (#E4D8DC) | Tertiary actions: export, edit, view all |
| Ghost | Transparent | color.muted (#9E8890) | None | Dismissive actions: cancel, close, skip |
| Danger | color.error (#B85454) | White | None | Destructive actions: suspend, remove, revoke |

**Sizes:**

| Size | Vertical Padding | Horizontal Padding | Font Size |
|---|---|---|---|
| Small (sm) | 7px | 16px | 13px |
| Medium (md, default) | 10px | 22px | 14px |
| Large (lg) | 14px | 28px | 16px |

**States:**

- Default: As specified per variant.
- Hover (Primary): Background shifts to color.primary.mid (#675D78).
- Hover (Cream): Background shifts to color.cream.dark (#D4BA82), text becomes white.
- Hover (Outline): Border shifts to color.primary, background fills with color.primary.subtle.
- Disabled: Reduced opacity (50%), no pointer events.
- Loading: Label replaced with a centered shimmer or pulsing dots. Button width preserved to prevent layout shift.

**Typography:** Plus Jakarta Sans, 600 weight. All transitions are 150ms.

### 6.2 Inputs

**Purpose:** Collect user data. Every input has a visible label above it.

**Anatomy:** Label (above), input field, optional hint/error text (below).

**Specifications:**

- Label: 13px, 600 weight, color.text.secondary, 6px margin below.
- Field: Full width, 11px vertical / 16px horizontal padding, 1.5px solid border in color.border, radius.sm (8px), 14px text, Plus Jakarta Sans.
- Placeholder: color.primary.lighter (#C8B4BC).

**States:**

- Default: Border color.border (#E4D8DC), white background.
- Focus: Border shifts to color.primary (#554B68), gains a 4px focus ring in color.primary.subtle (#F0E8EC).
- Error: Border shifts to color.error (#B85454), error message appears below in color.error, 13px.
- Disabled: Background shifts to color.bg (#FAF7F2), text becomes color.muted, no interaction.

**Search Variant:** Same as text input with a leading search icon inside the field (left-padded to accommodate icon). Placeholder reads contextually (e.g., "Search members...").

### 6.3 Badges / Status Pills

**Purpose:** Display membership or transaction status at a glance. Always pill-shaped (full border radius).

**Anatomy:** Text label only. No icons, no dismiss button.

**Specifications:** 4px vertical / 12px horizontal padding, 12px font size, 600 weight, full border radius (pill).

**Variants:**

| Variant | Label | Foreground | Background | Meaning |
|---|---|---|---|---|
| Active | "Active" or "Confirmed" | color.success (#5A8A6B) | color.success.bg (#EDF5F0) | Member in good standing, payment confirmed |
| Grace | "Grace" or "Due Soon" | color.warning (#C4960A) | color.warning.bg (#FDF8E8) | Dues within grace period, not yet expired |
| Lapsed | "Lapsed" | color.error (#B85454) | color.error.bg (#FDF0F0) | Dues expired, membership inactive |
| Pending | "Pending" | color.info (#5B7EB5) | color.info.bg (#EDF2F8) | Awaiting approval or payment verification |

### 6.4 Alerts

**Purpose:** System-level feedback messages. Shown inline, not as popups.

**Anatomy:** Leading icon (unicode character or icon glyph), message text.

**Specifications:** 12px vertical / 16px horizontal padding, radius.sm (8px), 14px text, 8px bottom margin between stacked alerts.

**Variants:**

| Variant | Icon | Text Color | Background |
|---|---|---|---|
| Success | Checkmark | color.success (#5A8A6B) | color.success.bg (#EDF5F0) |
| Warning | Warning triangle | color.warning (#C4960A) | color.warning.bg (#FDF8E8) |
| Error | X mark | color.error (#B85454) | color.error.bg (#FDF0F0) |
| Info | Info circle | color.info (#5B7EB5) | color.info.bg (#EDF2F8) |

**Dismiss:** Optional dismiss button (X) aligned to the right edge, same color as the alert text, with ghost-button-style hit area.

### 6.5 Cards

**Purpose:** Primary content container. Everything in Memberry lives inside a card.

#### Stat Card

**Anatomy:** Label (top), large numeric value (middle), change indicator (bottom).

- Label: 13px, 500 weight, color.muted.
- Value: General Sans, 30px, 700 weight, color.primary. Uses tabular-nums.
- Change indicator: 12px, 600 weight. Green (#5A8A6B) with up arrow for positive, red (#B85454) with down arrow for negative.
- Container: color.surface background, 1px color.border.light border, radius.md (12px), 20px padding.

**Accent Variant:** Background shifts to color.cream.light (#F9F0D8), border shifts to color.cream (#F2DEB0). Value text remains color.primary. Used for the most important stat (e.g., dues collected).

#### Member Card (inline row)

**Anatomy:** Avatar (left), name + subtitle stacked (center), status badge (right).

- Avatar: 34px circle, color.primary background, white initials at 12px/700 weight.
- Name: 14px, 500 weight, color.text.
- Subtitle: 12px, color.muted (chapter + member type).
- Badge: aligned to end, as specified in Badges section.

#### Mobile Card

**Anatomy:** Header row (title left, badge right), content area, optional footer with action.

- Container: color.surface, radius.md, 16px padding, 1px color.border.light border, 12px bottom margin.
- Title: General Sans, 14px, 600 weight, color.text.
- Accent variant: color.cream.light background, color.cream border.

#### Empty State Card

**Anatomy:** Icon or illustration (top center), headline (below), supporting text (below), primary CTA button (bottom).

- Headline: General Sans, 20px, 600 weight, color.primary.
- Supporting text: Plus Jakarta Sans, 14px, color.muted, max-width 400px, centered.
- CTA: Primary button variant.
- Vertical spacing: 16px between elements.

### 6.6 Tables

**Purpose:** Dense data display for officers reviewing member lists, payment records, event attendance.

**Anatomy:**

- Container: color.surface background, radius.md, 1px color.border.light border, overflow hidden.
- Header bar: 16px vertical / 20px horizontal padding, title (General Sans, 16px, 600 weight, color.primary) left-aligned, action button right-aligned, separated from table by 1px color.border.light.
- Column headers: 12px, 600 weight, uppercase, 0.8px letter spacing, color.muted, color.surface.warm background, 10px vertical / 20px horizontal padding.
- Body cells: 14px, 14px vertical / 20px horizontal padding, separated by 1px color.border.light. Last row has no bottom border.
- Hover: Row background shifts to color.surface.warm.
- Amount/numeric columns: Right-aligned, 600 weight, tabular-nums.

**Action Column:** Right-aligned, contains small outline or ghost buttons.

**Pagination:** Below the table, outside the container. Displays page info and prev/next controls using small outline buttons.

### 6.7 Navigation

#### Desktop Sidebar

**Specifications:**

- Width: 250px fixed.
- Background: color.primary (#554B68).
- Logo area: 24px horizontal padding, 20px bottom padding, separated by 1px border at rgba(255,255,255,0.12). Logo icon (32x32) + brand text (General Sans, 20px, 700 weight, white with cream accent on "berry").
- Nav section label: 10px, 600 weight, uppercase, 1.5px letter spacing, white at 40% opacity, 18px top / 8px bottom padding.
- Nav item: 14px, white at 65% opacity, 10px vertical / 24px horizontal padding, icon (18x18 at 70% opacity) + 10px gap + label.
- Nav item hover: Background rgba(255,255,255, 0.08), text white.
- Nav item active: Background rgba(255,255,255, 0.12), text white, 600 weight, 3px left border in color.cream, left padding reduced to 21px (compensating for border), icon at 100% opacity.

#### Mobile Bottom Navigation

**Specifications:**

- Height: 68px.
- Background: color.surface.
- Border top: 1px color.border.light.
- Position: Fixed to bottom of viewport.
- Items: 4 items distributed evenly (space-around). Each item is a column-flex of icon (22x22) + 3px gap + label (11px, 500 weight).
- Default: color.muted.
- Active: color.primary.

#### Breadcrumbs

Horizontal trail using color.muted text, separator character between items, final item in color.text with 600 weight. Font size 13px.

### 6.8 Member Avatar

**Purpose:** Visual identifier for a member. Always shows initials when no photo is available.

**Sizes:**

| Size | Dimensions | Font Size | Usage |
|---|---|---|---|
| Small (sm) | 30-34px | 12px | Table rows, mobile header, inline mentions |
| Medium (md) | 42px | 16px | Dashboard topbar, card headers |
| Large (lg) | 56px | 22px | Member profile page, detail views |

**Specifications:**

- Shape: Circle (50% border radius).
- Background: Cycles through primary palette colors (color.primary, color.primary.mid, color.primary.light) for visual variety in lists.
- Text: White, General Sans, 700 weight, centered.
- Initials: First letter of first name + first letter of last name, uppercase.

**Status Ring:** For contexts where the avatar must also communicate membership status, add a 2-3px border ring in the appropriate status color (success green for active, warning amber for grace, error red for lapsed, info blue for pending). Ring is outside the avatar circle with a 2px gap.

### 6.9 Progress Bar

**Purpose:** Show completion toward a goal (CPD credits, dues collection targets).

**Specifications:**

- Track: 8px height, color.border.light background, full border radius.
- Fill: Same height, color.primary background, full border radius. Width set as percentage.
- Container: Full width of parent card.

---

## 7. Layout Patterns

### 7.1 Desktop Officer Layout

- Structure: Fixed sidebar (250px) + scrollable main content area.
- Sidebar: Full viewport height, color.primary background, does not scroll with content.
- Main area: color.bg background, 28px internal padding.
- Top bar: Flex row, greeting/page title left, avatar right, 28px bottom margin.
- Content below top bar: Stat grid, then cards/tables stacked vertically.
- Stat grid: 4 columns on wide screens, 2 columns below 1100px.

### 7.2 Mobile Member Layout

- Structure: Fixed header (48px) + scrollable content + fixed bottom nav (68px).
- Header: color.primary background, logo left, avatar right, 20px horizontal padding.
- Content area: 20px padding, fills space between header and bottom nav. Cards stack vertically with 12px gaps.
- Bottom nav: 4 items (Home, Dues, Credits, Profile), fixed to bottom.
- Action grid: 2-column grid for quick action buttons, 10px gap.

### 7.3 Platform Admin Layout

- Desktop only (see Responsive Strategy).
- Wider sidebar: 260px.
- Dense data tables with more columns.
- Multi-panel layouts for side-by-side comparison views.

### 7.4 Maximum Content Width

- Content area: 1200px maximum, centered with auto margins, 24px horizontal padding.

---

## 8. Responsive Strategy

### 8.1 Breakpoints

| Name | Range | Target |
|---|---|---|
| Mobile | Below 768px | Member app, officer on-the-go |
| Tablet | 768px to 1024px | Officers at events with iPads |
| Desktop | Above 1024px | Officers at desk, platform admins |

### 8.2 Role-Based Responsive Rules

- **Platform Admin:** Desktop only, minimum 1024px. Intentional decision -- complex administrative operations (org configuration, billing management, platform analytics) require a full desktop environment. Show a friendly message on smaller screens directing the user to a desktop browser.
- **Chapter Officers:** Desktop primary, mobile supported. Same feature set, adapted layout. Desktop uses sidebar navigation; mobile collapses sidebar into a hamburger menu and adds a bottom action bar for primary actions.
- **Members:** Mobile-first, desktop supported. Designed for phones first. The desktop version expands cards into a wider layout but does not introduce new navigation patterns.

### 8.3 Responsive Behaviors

- Sidebar hides below 900px (dashboard grid becomes single-column).
- Stat grid: 4 columns on desktop, 2 columns below 1100px, 1 column below 768px.
- Type grid (typography showcase): 2 columns on desktop, 1 column below 768px.
- Component grid: 2 columns on desktop, 1 column below 768px.
- Tables: Horizontal scroll on mobile with sticky first column (member name).

### 8.4 Touch Targets

Minimum 44x44px for all interactive elements on touch devices. This applies to:

- Buttons (already meet this with padding)
- Nav items (already meet this with 10px vertical + text height)
- Table row action buttons (ensure hit area, not just visible button)
- Mobile bottom nav items
- Mobile action grid buttons (already 14px padding + content)

---

## 9. Dark Mode

### 9.1 Trigger

Two mechanisms, both supported:

1. **System preference:** Automatically follows the operating system's `prefers-color-scheme: dark` setting.
2. **Manual toggle:** User can override system preference with an in-app toggle. Preference persists across sessions.

### 9.2 Strategy

- Backgrounds invert to deep purple-grey tones (#1E1A22 for page, #2A2530 for cards).
- Text lightens to near-white (#F0E8EC).
- Borders darken and desaturate (#3D3644, #342E3A).
- Semantic colors shift to lighter, more saturated versions for readability on dark backgrounds (e.g., success #5A8A6B becomes #6BA87E).
- Semantic backgrounds become very dark tinted versions (e.g., success-bg becomes #1E2D22).
- Cream accent mutes slightly (#F2DEB0 becomes #D4BA82) while its "light" variant becomes a dark warm tone (#3D3520).
- Shadows should reduce opacity or be removed entirely on dark backgrounds.

### 9.3 Full Token Mapping

See Section 2.7 for the complete light-to-dark value table. All components automatically inherit dark mode values through the token system -- no component-level dark mode overrides are needed.

### 9.4 Transition

Background and text color transitions use 300ms ease for a smooth mode switch. No flash of unstyled content.

---

## 10. Interaction States

### 10.1 Loading

- **Content areas:** Skeleton shimmer pattern (animated gradient sweep over placeholder shapes that match the expected content layout). Not spinners. Shimmer communicates that content is coming and preserves layout stability.
- **Buttons:** Inline shimmer or pulsing dots replacing the label. Button dimensions remain fixed to prevent layout shift.
- **Tables:** Skeleton rows (5 placeholder rows with shimmer blocks matching column widths).
- **Payment processing:** Dedicated shimmer state with a subtle progress indicator (e.g., pulsing text "Processing payment...") and clear messaging that the user should not navigate away.
- **3G consideration:** Skeleton states are designed to feel natural even during slow loads. No timeout errors for the first 15 seconds.

### 10.2 Empty States

Every list, table, and data view has a designed empty state:

- Icon or illustration: Contextual, simple line art in color.primary.lighter.
- Headline: General Sans, 20px, 600 weight. Warm and specific ("No members yet", not "No data").
- Supporting text: Plus Jakarta Sans, 14px, color.muted. Explains why this might be empty and what to do.
- Primary CTA: Button with the most logical next action ("Add your first member", "Record a payment").
- All text is centered within the card.

### 10.3 Error States

- **Inline errors (forms):** Red border on input, error message below in color.error, 13px.
- **Alert errors (system):** Red alert banner with specific error message + retry action button + support link.
- **Page-level errors:** Full card with error icon, headline, description, retry button, and a "Contact support" ghost button.

### 10.4 Success States

- Green alert with confirmation message and the logical next action.
- For multi-step flows (payment), show a success card with: checkmark icon, confirmation headline, transaction details, and a "Done" or "View receipt" button.

### 10.5 Hover and Focus

- All interactive elements have a visible hover state (color shift, background fill, or border change) with 150ms transition.
- Focus indicators: 4px ring in color.primary.subtle around the element, visible on keyboard navigation. Never remove focus indicators for accessibility.
- Active/pressed: Slight darkening of background (imperceptible but present for tactile feedback).

---

## 11. Accessibility

### 11.1 Color Contrast

- WCAG AA minimum compliance (4.5:1 ratio for normal text, 3:1 for large text and UI components).
- All semantic color pairs (foreground on their background) meet AA. Verified: success green on success-bg, warning amber on warning-bg, error red on error-bg, info blue on info-bg.
- Primary text (#2D2635) on page background (#FAF7F2) exceeds 4.5:1.
- Muted text (#9E8890) on white surface: verify meets 3:1 minimum for its usage contexts (used at larger sizes or as supplementary info only).

### 11.2 Keyboard Navigation

- All interactive elements (buttons, inputs, links, nav items, table actions) reachable via Tab key.
- Logical tab order follows visual layout (top-to-bottom, left-to-right).
- Focus indicators are always visible (never hidden by outline:none without a replacement).
- Escape key closes modals and drawers.
- Arrow keys navigate within grouped controls (radio groups, dropdown menus, tab sets).

### 11.3 Screen Reader Support

- All form inputs have associated labels (not just visual, but programmatically linked).
- Images and icons carry alt text or are marked decorative.
- Status badges and alerts communicate their semantic meaning (not just color -- the text "Active", "Grace", "Lapsed", "Pending" is always present).
- Dynamic content changes (loading states, alerts) announced via live regions.
- Table headers are properly associated with their columns.
- Navigation landmarks are identified (sidebar nav, main content, footer).

### 11.4 Touch Accessibility

- 44px minimum touch targets on all interactive elements.
- Adequate spacing between touch targets to prevent mis-taps (minimum 8px gap).
- No hover-only interactions -- everything triggered by hover must also be accessible by tap/click.

---

## 12. Org-Switcher Pattern

### 12.1 Context

A member can belong to multiple organizations (e.g., PDA Chapter 7 and PDA Chapter 12) with independent membership statuses, dues records, and CPD progress in each.

### 12.2 Org Context Indicator

Every screen that displays org-specific data shows a compact org indicator in the header area. On the desktop officer dashboard, this appears in the greeting subtitle (e.g., "PDA Chapter 12 -- Metro Manila"). On mobile, it appears below the greeting heading.

**Indicator format:** Organization name + location, displayed as a compact text string or pill. Tapping/clicking opens the org switcher.

### 12.3 Member Dashboard (Aggregate View)

When a member belongs to multiple organizations, their home dashboard shows:

- A summary card per organization, each with: org name, membership status badge, key stats (dues status, CPD progress).
- Tapping an org card navigates into that org's context for detailed views.
- The aggregate view does not combine data across orgs -- each org's data stays in its own card.

### 12.4 Switching Mechanism

- **Trigger:** Tap/click the org context indicator in the header.
- **UI:** Dropdown (desktop) or bottom drawer (mobile) listing all orgs the user belongs to.
- **Each item shows:** Org name, location, current membership status badge.
- **Selection:** Selecting an org updates the context across all navigation. The indicator updates to reflect the new org. The page content refreshes to show the selected org's data.
- **Persistence:** Selected org persists across page navigation within the same session. On return visits, defaults to the most recently active org.

### 12.5 Visual Differentiation

To help users distinguish which org context they are in:

- The org indicator is always visible and prominent enough to scan at a glance.
- Consider using a subtle color accent or avatar/icon per org in the switcher list to aid quick recognition.
- When viewing org-specific data, breadcrumbs include the org name as the first segment.

---

*Memberry Design System v3 -- April 2026*
*Extracted from Variant D: Custom Palette preview. This is the authoritative design reference for all implementations.*
