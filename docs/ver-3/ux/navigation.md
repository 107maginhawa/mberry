# Navigation — Memberry Platform

**Version:** 3.0
**Last Updated:** 2026-04-21
**Layer:** UX / Navigation Architecture

---

## 1. Navigation Architecture Overview

Memberry uses three distinct navigation patterns, each matched to the complexity of the persona it serves.

| Persona | Nav Pattern | Rationale |
|---------|-------------|-----------|
| **Officers** (President, Treasurer, Secretary) | Fixed left sidebar (desktop), full-screen drawer (mobile) | Many features, deep hierarchy, frequent context-switching between modules |
| **Members** (Healthcare Professionals) | Bottom tab bar (mobile), simplified left sidebar (desktop) | Flat structure, 4 primary destinations, mobile-first usage |
| **Platform Admins** | Wide left sidebar (desktop only) | Elevated context, dense operational data, desktop-only workflow |

**Principle:** Navigation complexity matches role complexity. Members get the simplest nav because they have the fewest tasks. Officers get structured sections because they manage many modules. Admins get the widest sidebar because they oversee the entire platform.

---

## 2. Desktop Officer Navigation (President, Treasurer, Secretary)

### Layout

- Fixed left sidebar: **240px** wide
- Background: `--primary` (#554B68)
- Text: white with opacity levels for hierarchy
- Content area fills remaining viewport width

### Sidebar Structure (top to bottom)

```
+------------------------------------------+
| [Berry Icon]  Memberry                   |   <- Logo/branding area
| Metro Manila Chapter                     |   <- Org name, truncated if long
+------------------------------------------+
|                                          |
| DASHBOARD                                |   <- Section: no header, top item
|   [grid icon]    Dashboard               |
|                                          |
| MEMBERS                                  |   <- Section header
|   [users icon]   Roster            (3)   |   <- Notification badge
|   [inbox icon]   Applications      (3)   |
|   [upload icon]  Import                  |
|                                          |
| FINANCES                                 |
|   [settings icon] Dues Config            |
|   [credit-card]  Payment Records         |
|   [pie-chart]    Fund Allocation         |
|   [bar-chart]    Reports                 |
|                                          |
| ACTIVITIES                               |
|   [calendar icon] Events                 |
|   [book icon]    Trainings               |
|                                          |
| COMMUNICATIONS                           |
|   [megaphone]    Announcements           |
|   [mail icon]    Email Templates         |
|                                          |
| DOCUMENTS                                |
|   [id-card icon] Member Cards            |
|   [award icon]   Certificates            |
|                                          |
| SETTINGS                                 |
|   [building icon] Org Profile            |
|   [shield icon]  Officers                |
|   [plug icon]    Integrations            |
|                                          |
+------------------------------------------+
| [Avatar: MS]  Dr. Maria Santos           |   <- User info at bottom
|               President                  |   <- Role label
+------------------------------------------+
```

### States

| State | Treatment |
|-------|-----------|
| **Default** | Text at `rgba(255,255,255,0.65)`, icon at `opacity: 0.7` |
| **Hover** | Background `rgba(255,255,255,0.08)`, text white |
| **Active** | Background `rgba(255,255,255,0.12)`, text white, font-weight 600, left border 3px `--cream` (#F2DEB0), icon `opacity: 1` |
| **Section header** | `10px` uppercase, `letter-spacing: 1.5px`, color `rgba(255,255,255,0.4)` |

### Notification Badges

- Small pill badge (count) right-aligned on the nav item
- Background: `--cream` (#F2DEB0), text: `--primary` (#554B68)
- Shown on: Applications (pending count), Roster (pending corrections), Announcements (drafts), Payment Records (pending reconciliation)
- Badge disappears when count is zero

### Org Name Display

- Displayed below the Memberry logo in the sidebar header area
- Truncated with ellipsis if longer than sidebar width minus padding
- Full name shown on hover (tooltip)

### User Info (Sidebar Footer)

- Avatar circle (34px, initials, `--primary-mid` background)
- Name: 14px, white, font-weight 500
- Role: 12px, `rgba(255,255,255,0.5)`
- Click opens a dropdown: Switch Role (if multi-role), View Profile, Log Out

---

## 2b. Mobile Officer Navigation

### Sticky Header

```
+------------------------------------------+
| [Hamburger]  Metro Manila Chapter  [Bell]|
+------------------------------------------+
```

- Height: 48px
- Background: `--primary`
- Org name centered, white, 16px font-weight 600
- Hamburger icon (left): opens full-screen drawer
- Bell icon (right): opens notification panel, count badge if unread

### Full-Screen Drawer

- Triggered by hamburger tap
- Slides in from left, covers full screen
- Contains the exact same sidebar nav structure as desktop (all sections, all items)
- Close: tap X button (top-right of drawer) or swipe right-to-left
- Background: `--primary`, same styling as desktop sidebar
- User info at bottom of drawer, same as desktop sidebar footer

### Bottom Action Bar

- **Not a bottom navigation** -- this is a contextual action bar
- Fixed to bottom of viewport, height 56px
- Background: `--surface` with top border `--border-light`
- Contains 2-3 context-specific quick action buttons based on current page:

| Current Page | Quick Actions |
|-------------|---------------|
| Dashboard | "+ Member", "Record Payment" |
| Roster | "+ Member", "Import CSV" |
| Finance | "Record Payment", "Send Reminder" |
| Events | "+ Event", "Check In" |
| Trainings | "+ Training", "Check In" |

- Buttons styled as compact primary/outline buttons
- This bar does NOT appear on desktop

### Why No Persistent Bottom Nav for Officers

Officers have too many navigation items (15+ destinations across 7 sections) to fit into a bottom nav bar. A bottom nav with 4-5 items would force arbitrary grouping and hide most features. The hamburger drawer gives full access, and the bottom action bar provides fast access to the most common actions for the current context.

---

## 3. Member Navigation (Mobile-First)

### Bottom Navigation Bar (Mobile)

```
+------------------------------------------+
|                                          |
|           [ Page Content ]               |
|                                          |
+------------------------------------------+
| [Home]    [Activities]  [Credits]  [Me]  |
+------------------------------------------+
```

| Tab | Icon | Destination | Description |
|-----|------|-------------|-------------|
| Home | House/dashboard | `/dashboard` | Status banner, action cards, announcements, upcoming activities |
| Activities | Calendar | `/activities` | Unified feed of events + trainings across all orgs |
| Credits | Chart/pulse | `/credits` | Credit progress, per-org breakdown, history, manual entry |
| Profile | Person circle | `/settings` | Edit profile, privacy, notifications, ID card, dues history |

- Bar height: 68px
- Background: `--surface`, top border `--border-light`
- Active tab: `--primary` color, label visible
- Inactive tab: `--muted` color, label visible
- No notification badges on bottom nav items (notifications live in the header bell)

### Header (Mobile)

```
+------------------------------------------+
| [Berry Icon] Memberry   [PDA Ch.7] [Bell]|
+------------------------------------------+
```

- Height: 48px
- Background: `--primary`
- Left: Memberry logo icon + wordmark
- Center-right: Org context pill (compact, tappable)
- Right: Bell icon with unread count badge

### Org-Switcher (Header Pill)

- Appears when the member belongs to 2+ organizations
- Shows as a compact pill in the header: current org name abbreviated + status dot (green/amber/red)
- Tap opens a dropdown sheet (see Interaction Patterns doc, Section 1)
- If member belongs to only 1 org, the pill is not interactive (just displays org name)

### Desktop Member View

When a member accesses the platform on desktop (viewport > 768px):

- Bottom nav transforms into a simplified left sidebar (180px wide)
- Same 4 items: Home, Activities, Credits, Profile
- Sidebar background: `--surface`, border-right `--border-light`
- Active item: `--primary` text + left border accent
- Header moves to a top bar spanning full width

---

## 4. Platform Admin Navigation (Desktop Only)

### Layout

- Fixed left sidebar: **260px** wide (wider than officer sidebar to accommodate longer labels)
- Background: distinct color treatment to signal elevated context -- uses a darker variant of `--primary` or a separate admin palette (e.g., `#2D2635` background instead of `#554B68`)
- This visual distinction prevents admins from confusing admin context with org context

### Sidebar Structure

```
+------------------------------------------+
| [Berry Icon]  Memberry                   |
| PLATFORM ADMIN                           |   <- Elevated context label
+------------------------------------------+
|                                          |
| OVERVIEW                                 |
|   [activity icon]  Dashboard             |   <- Revenue, health, growth
|                                          |
| ASSOCIATIONS                             |
|   [building icon]  All Associations      |
|   [plus icon]      Onboarding            |
|   [sliders icon]   Configuration         |
|                                          |
| OPERATORS                                |
|   [users icon]     Admin Users           |
|   [mail icon]      Invitations           |
|                                          |
| FEATURE FLAGS                            |
|   [toggle icon]    Flag Management       |
|                                          |
| SUPPORT                                  |
|   [eye icon]       Impersonation         |
|   [inbox icon]     Tickets          (5)  |
|                                          |
| ANALYTICS                                |
|   [bar-chart icon] Operator Dashboard    |
|   [trending icon]  Conversion Funnel     |
|   [heart icon]     Org Health Scores     |
|                                          |
| COMPLIANCE                               |
|   [shield icon]    Data Requests         |
|   [alert icon]     Breach Response       |
|   [file icon]      Audit Logs            |
|                                          |
+------------------------------------------+
| [Avatar: AD]  Admin Name                 |
|               Super Admin                |
+------------------------------------------+
```

### Visual Differentiation from Officer Nav

| Property | Officer Sidebar | Admin Sidebar |
|----------|----------------|---------------|
| Width | 240px | 260px |
| Background | `--primary` (#554B68) | Darker variant (#2D2635) |
| Accent | `--cream` (#F2DEB0) | Different accent (e.g., `--info` blue or keep cream) |
| Context label | Org name | "PLATFORM ADMIN" badge |

### No Mobile Layout

Platform admin is desktop-only. If accessed on mobile, display a message: "Platform administration requires a desktop browser."

---

## 5. Public / Unauthenticated Navigation

### Org Public Page (`/org/{slug}`)

```
+------------------------------------------+
| [Berry Icon] Memberry     [Apply to Join]|
+------------------------------------------+
|                                          |
|   Org profile, activities, member count  |
|                                          |
+------------------------------------------+
```

- Minimal top nav bar
- Left: Memberry logo
- Right: "Apply to Join" button (primary style)
- No sidebar, no bottom nav
- Page scrolls freely

### Auth Pages (`/login`, `/register`, `/forgot-password`)

```
+------------------------------------------+
|                                          |
|         [Berry Icon] Memberry            |
|                                          |
|         [ Auth Form ]                    |
|                                          |
+------------------------------------------+
```

- Logo centered at top of form
- No navigation bar, no sidebar, no footer nav
- Clean, focused layout
- Background: `--bg` (#FAF7F2)

### Member Verification Page (`/verify/{code}`)

```
+------------------------------------------+
| [Berry Icon] Memberry                    |
+------------------------------------------+
|                                          |
|   Verification result                    |
|   (Valid / Invalid / Expired)            |
|                                          |
+------------------------------------------+
```

- Logo in a minimal top bar (left-aligned)
- No other navigation elements
- Verification result is the sole content

---

## 6. Breadcrumbs

### When to Use

- All pages at depth 2+ in officer and admin views
- Format: **Section > Page > Sub-page**
- Separator: `>` (chevron right icon)
- Displayed below the page header, above the page content
- Font: 13px, `--muted` color for ancestors, `--text` for current page

### Examples

| View | Breadcrumb |
|------|------------|
| Officer: Member detail | Members > Roster > Dr. Maria Santos |
| Officer: Create event | Activities > Events > New Event |
| Officer: Financial report | Finances > Reports > Collection Summary |
| Admin: Org detail | Associations > PDA > Metro Manila Chapter |
| Admin: Ticket detail | Support > Tickets > #1234 |

### Not Used

- Member views (flat navigation, no depth beyond 1 level)
- Dashboard pages (top-level, no breadcrumb needed)
- Public pages
- Auth pages

---

## 7. Page Titles

### Convention

| Context | Format | Example |
|---------|--------|---------|
| Officer pages | `[Page Name] -- [Org Name] | Memberry` | `Roster -- Metro Manila Chapter | Memberry` |
| Member pages | `[Page Name] | Memberry` | `Credit Dashboard | Memberry` |
| Platform admin | `[Page Name] -- Platform Admin | Memberry` | `Org Health -- Platform Admin | Memberry` |
| Public pages | `[Org Name] | Memberry` | `Metro Manila Chapter | Memberry` |
| Auth pages | `[Action] | Memberry` | `Log In | Memberry` |

### Notes

- Use em dash (`--`) as separator between page name and context
- Pipe (`|`) separates context from brand name
- Keep page names concise (max ~30 characters before the separator)
- Dynamic pages include the entity name: `Dr. Maria Santos -- Metro Manila Chapter | Memberry`
