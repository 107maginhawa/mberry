<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint — Screens: Member Profile & Settings (M02)

---

## S01: Profile Overview (`/my/profile`)

**Purpose:** Read-only profile view with all org memberships (WF-010).
**Primary Users:** Member (all authenticated).
**Related Workflow:** WF-010 (View & Update Profile).
**App:** account (port 3002).

### ARIA Landmark Structure

```
<header role="banner">
  <nav aria-label="Application navigation">...</nav>
</header>
<main role="main" aria-label="My profile">
  <section aria-label="Profile header">
    <img alt="Profile photo of {firstName} {lastName}" />
    <h1>{firstName} {lastName}</h1>
    <p>License: {licenseNumber}</p>
    <p>{specialization}</p>
    <a href="/my/profile/edit" aria-label="Edit profile">Edit Profile</a>
  </section>
  <section aria-label="Organization memberships">
    <h2>My Organizations</h2>
    <ul role="list" aria-label="Organization membership cards">
      <li role="listitem"><!-- OrgMembershipCard --></li>
    </ul>
  </section>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | "Edit Profile" link |
| Return from edit | "Edit Profile" link with sonner toast "Profile updated" |
| No memberships | "Join an organization" CTA |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| firstName | Yes | `GET /my/profile` → data.firstName | Display only |
| lastName | No | `GET /my/profile` → data.lastName | Display only |
| email | Yes | `GET /my/profile` → data.email | Display only |
| licenseNumber | Yes | `GET /my/profile` → data.licenseNumber | Display only |
| specialization | No | `GET /my/profile` → data.specialization | Display only |
| subSpecialization | No | `GET /my/profile` → data.subSpecialization | Display only |
| yearsOfPractice | No | `GET /my/profile` → data.yearsOfPractice | Display only |
| affiliation | No | `GET /my/profile` → data.affiliation | Display only |
| photoUrl | No | `GET /my/profile` → data.photoUrl | Fallback to default avatar |
| memberships | Array | `GET /my/profile` → data.memberships[] | Per-org cards |
| memberships[].orgName | Yes | Nested | Org display name |
| memberships[].status | Yes | Nested | Computed from duesExpiryDate (BR-01) |
| memberships[].category | Yes | Nested | e.g., "Regular", "Life" |
| memberships[].duesExpiryDate | Yes | Nested | ISO date |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Edit profile | Navigate to /my/profile/edit | GA (all authenticated) | — |
| View ID card | Navigate to /my/id-card | GA | — |
| View settings | Navigate to /my/settings | GA | — |

### Role-Variant Matrix

| Element | Member | Platform Admin (impersonating) |
|---------|--------|-------------------------------|
| Profile data | Own data | Target user's data |
| Edit button | Visible | Visible (edits as impersonated user) |
| Memberships | Own orgs | Target user's orgs |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Profile header (left sidebar) + memberships (right 2-col grid) |
| Tablet (768-1024px) | Profile header (full width) + memberships (2-col grid) |
| Mobile (<768px) | Stacked: photo, name, details, then membership cards (single column) |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton: circle avatar, text bars, card placeholders |
| Empty | Profile shows but zero org cards: "Not a member yet. Browse organizations." |
| Success | Full profile displayed with org membership cards |
| Validation Error | N/A (read-only screen) |
| Permission Error | 401 → redirect to /auth/sign-in |
| Unexpected Error | Retry banner: "Failed to load profile. Try again." |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | N/A |
| Offline/Sync | Cached profile shown (if available), "Showing cached data" badge |

---

## S02: Profile Edit (`/my/profile/edit`)

**Purpose:** Edit personal information (WF-010).
**Primary Users:** Member (all authenticated).
**Related Workflow:** WF-010.
**App:** account (port 3002).

### ARIA Landmark Structure

```
<header role="banner">
  <nav aria-label="Application navigation">...</nav>
</header>
<main role="main" aria-label="Edit profile">
  <form aria-label="Profile edit form">
    <fieldset aria-label="Personal information">
      <input aria-label="First name" aria-required="true" />
      <input aria-label="Last name" />
      <input aria-label="Specialization" />
      <input aria-label="Sub-specialization" />
      <input aria-label="Years of practice" type="number" min="0" />
      <input aria-label="Affiliation" />
    </fieldset>
    <fieldset aria-label="Profile photo">
      <!-- PhotoCropUpload component -->
    </fieldset>
    <fieldset aria-label="Email address">
      <input aria-label="Email address" aria-required="true" />
      <p aria-live="polite">Changing email requires OTP verification (M2-R1)</p>
    </fieldset>
    <button type="submit">Save Changes</button>
    <a href="/my/profile">Cancel</a>
  </form>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | firstName input |
| Save success | Navigate to /my/profile |
| Validation error | First invalid field |
| Email change | OTP modal opens, focus on code input |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| firstName | Yes | `PUT /my/profile` → body.firstName | varchar(50) |
| lastName | No | `PUT /my/profile` → body.lastName | varchar(50) |
| email | Yes | `PUT /my/profile` → body.email | OTP required if changed (M2-R1) |
| specialization | No | `PUT /my/profile` → body.specialization | Free text |
| subSpecialization | No | `PUT /my/profile` → body.subSpecialization | Free text |
| yearsOfPractice | No | `PUT /my/profile` → body.yearsOfPractice | Integer >= 0 |
| affiliation | No | `PUT /my/profile` → body.affiliation | Free text |
| photoUrl | No | `PUT /my/profile` → body.photoUrl | Upload via /storage |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Save changes | PUT /my/profile | GA | Ctrl/Cmd+S |
| Cancel | Navigate back to /my/profile | GA | Escape |
| Upload photo | Open photo crop dialog | GA | — |
| Remove photo | Clear photo URL | GA | — |

### Role-Variant Matrix

| Element | Member | Platform Admin |
|---------|--------|----------------|
| All fields | Editable (own) | Editable (impersonated user) |
| License number | Read-only | Editable (PA override) |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Two-column: photo upload left, fields right |
| Tablet (768-1024px) | Single column, photo at top |
| Mobile (<768px) | Single column, sticky save button at bottom |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton form fields pre-filling |
| Empty | Form with current values pre-filled |
| Success | sonner toast "Profile updated", navigate to /my/profile |
| Validation Error | Inline per-field errors, first error focused |
| Permission Error | 401 → redirect to /auth/sign-in |
| Unexpected Error | "Save failed. Try again." banner, data preserved |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | Email change: "You'll need to verify your new email." |
| Offline/Sync | Save button disabled, "You're offline" banner |

### Validation Behavior

- firstName: required, max 50.
- email: valid format, unique (server-side). If changed, OTP flow triggered (M2-R1).
- yearsOfPractice: integer >= 0.
- Photo: JPEG/PNG/WebP only, max 5MB (M2-R9). SVG sanitized (BR-31).

---

## S03: Digital ID Card (`/my/id-card`)

**Purpose:** View and download verifiable digital ID (WF-012).
**Primary Users:** Member (all authenticated).
**Related Workflow:** WF-012 (Digital ID Card).
**App:** memberry (port 3004).

### ARIA Landmark Structure

```
<header role="banner">
  <nav aria-label="Application navigation">...</nav>
</header>
<main role="main" aria-label="Digital ID card">
  <aside aria-label="Organization selector">
    <select aria-label="Select organization">
      <option>Manila Dental Chapter</option>
    </select>
  </aside>
  <section aria-label="ID card preview">
    <div role="img" aria-label="Digital ID card for {name} at {orgName}">
      <!-- Card visual -->
    </div>
  </section>
  <footer aria-label="ID card actions">
    <button>Download PDF</button>
    <button>Share Verification Link</button>
  </footer>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | Org selector (if multiple orgs) or card preview |
| Org change | Card preview updates |
| PDF download | Focus remains on download button |

### Fields / Displayed Data

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| photoUrl | No | `GET /my/id-card/:orgId` → data.photoUrl | Default avatar if missing |
| fullName | Yes | `GET /my/id-card/:orgId` → data.fullName | firstName + lastName |
| licenseNumber | Yes | `GET /my/id-card/:orgId` → data.licenseNumber | — |
| orgName | Yes | `GET /my/id-card/:orgId` → data.orgName | — |
| membershipStatus | Yes | `GET /my/id-card/:orgId` → data.membershipStatus | Computed from duesExpiryDate (BR-01) |
| membershipCategory | Yes | `GET /my/id-card/:orgId` → data.membershipCategory | — |
| duesExpiryDate | Yes | `GET /my/id-card/:orgId` → data.duesExpiryDate | ISO date |
| qrCodeUrl | Yes | `GET /my/id-card/:orgId` → data.qrCodeUrl | HMAC-signed (BR-18) |
| verificationUrl | Yes | `GET /my/id-card/:orgId` → data.verificationUrl | Public verification link |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Switch org | Change org selector | GA | — |
| Download PDF | GET /my/id-card/:orgId/pdf | GA | Ctrl/Cmd+P |
| Share link | Copy verification URL to clipboard | GA | — |

### Role-Variant Matrix

| Element | Active Member | Grace Period | Lapsed |
|---------|--------------|-------------|--------|
| Status badge | Green "ACTIVE" | Amber "GRACE" | Red "LAPSED" |
| Download PDF | Enabled | Enabled | Enabled (with lapsed stamp) |
| QR code | Valid | Valid | Valid (status included in scan) |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Card preview centered, actions below, org selector top-right |
| Tablet (768-1024px) | Same layout, card slightly smaller |
| Mobile (<768px) | Full-width card, stacked actions below, org selector as dropdown at top |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton card shape |
| Empty | "No active membership found. Join an organization first." |
| Success (Active) | Card with green status badge |
| Success (Grace) | Card with amber status badge |
| Success (Lapsed) | Card with red "LAPSED" stamp overlay |
| Validation Error | N/A (read-only) |
| Permission Error | 401 → redirect to /auth/sign-in |
| Unexpected Error | "Failed to load ID card. Try again." |
| Conflict/Duplicate | N/A |
| Confirmation/Warning | N/A |
| Offline/Sync | "ID card requires internet to verify." Cached card shown (no QR). |

### Edge Cases

- No photo: default avatar silhouette on card (M2-R7).
- Multiple orgs: org selector visible, each card generated independently (BR-21, M2-R14).
- PDF generating: spinner overlay on card, download auto-starts.

---

## S04: Settings (`/my/settings`)

**Purpose:** Privacy, notifications, data export, account deletion (WF-011, WF-014).
**Primary Users:** Member (all authenticated).
**Related Workflow:** WF-011 (Account Deletion), WF-014 (Data Export).
**App:** account (port 3002).

### ARIA Landmark Structure

```
<header role="banner">
  <nav aria-label="Application navigation">...</nav>
</header>
<main role="main" aria-label="Account settings">
  <nav aria-label="Settings sections">
    <ul role="tablist">
      <li role="tab" aria-selected="true">Privacy</li>
      <li role="tab">Notifications</li>
      <li role="tab">Data & Security</li>
    </ul>
  </nav>
  <section role="tabpanel" aria-label="Privacy settings">
    <!-- PrivacySettingsForm -->
  </section>
  <section role="tabpanel" aria-label="Notification preferences" hidden>
    <!-- NotificationPreferencesForm -->
  </section>
  <section role="tabpanel" aria-label="Data and security" hidden>
    <!-- DataExport + AccountDeletion -->
  </section>
</main>
```

### Focus Management

| Scenario | Focus Target |
|----------|-------------|
| Page load | First tab (Privacy) |
| Tab switch | First interactive element in new panel |
| Save settings | Same tab, sonner toast confirmation |

### Tab: Privacy Settings

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| emailVisible | No | `PUT /my/privacy` → body.settings[].emailVisible | Per-org, default false |
| phoneVisible | No | `PUT /my/privacy` → body.settings[].phoneVisible | Per-org, default false |
| photoVisible | No | `PUT /my/privacy` → body.settings[].photoVisible | Per-org, default true |
| addressVisible | No | `PUT /my/privacy` → body.settings[].addressVisible | Per-org, default false |

### Tab: Notification Preferences

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| category | Yes | `PUT /my/notifications` → body.preferences[].category | dues/events/trainings/announcements/credits |
| pushEnabled | No | Per category | Default true |
| emailEnabled | No | Per category | Default false |

### Tab: Data & Security

| Field | Required | API Source | Notes |
|-------|----------|-----------|-------|
| Export button | — | `POST /my/data-export` | 1 per 24h (M2-R4) |
| Export status | — | `GET /my/data-export/:id` → data.status | requested/processing/ready/expired |
| Delete account | — | `POST /my/delete-account` | 30-day grace (M2-R5) |
| Cancel deletion | — | `DELETE /my/delete-account` | Only during grace period |
| Change password | — | Separate flow | Invalidates all sessions (M2-R2) |

### Actions

| Action | Description | Permission | Keyboard Shortcut |
|--------|-------------|-----------|-------------------|
| Save privacy | PUT /my/privacy | GA | Ctrl/Cmd+S |
| Save notifications | PUT /my/notifications | GA | Ctrl/Cmd+S |
| Export data | POST /my/data-export | GA | — |
| Download export | Link to export ZIP | GA | — |
| Request deletion | POST /my/delete-account | GA | — |
| Cancel deletion | DELETE /my/delete-account | GA | — |
| Change password | Navigate to password change | GA | — |

### Role-Variant Matrix

| Element | Member | Platform Admin |
|---------|--------|----------------|
| Privacy (per-org) | Shows all member's orgs | Shows impersonated user's orgs |
| Account deletion | Available | Hidden (PA cannot delete others) |
| Data export | Available | Available (for impersonated user) |

### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| Desktop (>1024px) | Vertical tabs (left sidebar) + panel (right) |
| Tablet (768-1024px) | Horizontal tabs (top) + panel below |
| Mobile (<768px) | Accordion sections (expandable) |

### Interaction States

| State | Behavior |
|-------|----------|
| Loading | Skeleton toggles and buttons |
| Empty | Default toggle states from API |
| Success | sonner toast: "Settings saved" / "Export requested" / "Deletion scheduled" |
| Validation Error | N/A (toggles and buttons only) |
| Permission Error | 401 → redirect to /auth/sign-in |
| Unexpected Error | "Failed to save. Try again." per section |
| Conflict/Duplicate | Export: "An export is already in progress." |
| Confirmation/Warning | Deletion: modal "This will permanently delete your account in 30 days." with password confirmation |
| Offline/Sync | Save buttons disabled, "You're offline" banner |

### Edge Cases

- Pending deletion: show countdown banner "Account scheduled for deletion on {date}. Cancel?"
- Sole officer: deletion blocked (M2-R5) — "Transfer your officer role before deleting."
- Pending payments: deletion blocked (M2-R5) — "Complete pending payments before deleting."
- Export ready: "Download" button appears, expires in 7 days.
- In-app notifications: category toggles disabled for in-app (M2-R8, always on).
