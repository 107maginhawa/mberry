# Cluster A — Member self-service

Static UI journey audit. Read-only. No execution. Scope = member self-service sub-modules (dashboard, profile/account/person, billing, notifications, onboarding, id-card).

## Scan Manifest

| Metric | Value |
|---|---|
| Files inventoried | 30 (source `.tsx`/`.ts`, test files excluded from element scan) |
| Files scanned | 30 / 30 (COMPLETE) |
| Files skipped | 0 |
| `.test.*` siblings | excluded per Registry allowlist (not interactive surfaces) |

Interactive elements (totals, by type):

| Type | Count (approx) |
|---|---|
| `<Button onClick>` | 31 |
| `<Button type="submit">` | 6 |
| `<form onSubmit>` | 5 |
| `<Link to=>` / `href` | 18 |
| `useNavigate/navigate()` | 7 |
| `useMutation` | 7 |
| `useQuery` | 22 |
| Dialog/AlertDialog actions | 6 |
| **Total interactive** | **~102** |

UI-relevant WFs traced: 9 / 9 touching cluster (WF-005, WF-006, WF-010, WF-011, WF-012/WF-071, WF-013, WF-014, WF-027, WF-038).
Routes verified: all 12 in-scope routes resolve (TanStack file-based). All API paths cross-checked against `services/api-ts/src/generated/openapi/routes.ts` + hand-wired `services/api-ts/src/app.ts`. **0 DEAD_API_CALL** (id-card PDF `/persons/me/id-card/:orgId/pdf` confirmed hand-wired at `app.ts:503`).

---

## Sub-module: dashboard

Files: `routes/_authenticated/dashboard.tsx`, `features/dashboard/components/{member-dashboard,quick-actions,action-widget,alert-banner,org-announcements,credit-breakdown}.tsx`.

### Registry 1 — Action Registry

| Module | Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|---|---|---|---|---|---|---|---|---|---|
| dashboard | dashboard.tsx | "Find Organizations" | Button onClick | Find Organizations | `navigate('/my/organizations')` | — | none | WF-027 | high |
| dashboard | dashboard.tsx | dues action card | Link | Pay now / View dues | `to:/org/$orgSlug/dues` | — | none | WF-038 | high |
| dashboard | dashboard.tsx | credit/event cards | Link | View credits / View events | `to:/my/credits`, `/my/events` | — | none | WF-027 | high |
| dashboard | dashboard.tsx | data loads | useQuery x8 | — | — | GET `/persons/me`, `/persons/me/memberships`, `/persons/me/credit-summary`, `/association/member/dues-invoices`, `/communications/announcements/:org`, `/credit-compliance/:org`, `/persons/me/officer-role/:org` | none | WF-027 | high |
| dashboard | member-dashboard.tsx | section links | Link x3 | — | `to:` various | — | officer cards gated on `officerQuery.data.isOfficer` | WF-027 | high |
| dashboard | quick-actions / action-widget / alert-banner / credit-breakdown | nav links | Link | — | `to:` various | — | none | WF-027 | high |

Registry 2/4/5/9: all PASS. All dashboard mutations are read-only `useQuery` (no failable writes → no onError required). Navigation links resolve. No NOOP/orphan/dead. Officer cards correctly conditionally rendered (member sees member set).

---

## Sub-module: profile / account / person

Files: `routes/_authenticated/my/profile.tsx`, `my/settings.tsx`, `settings/account.tsx`, `settings/security.tsx`, `features/profile/**`, `features/account/components/data-export.tsx`, `features/person/components/{contact-info,address,personal-info,preferences}-form.tsx`, `features/person/schemas.ts`.

### Registry 1 — Action Registry (key rows)

| Module | Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|---|---|---|---|---|---|---|---|---|---|
| person | profile.tsx | Edit | Button onClick | Edit | `setEditing(true)` | — | none | WF-010 | high |
| person | profile.tsx | Save (edit form) | form submit | Save | `onSave.mutate` → updatePerson | PATCH `/persons/:person` (SDK) | none | WF-010 | high |
| person | profile.tsx | Publish visibility | Button onClick x3 | public/memberOnly/hidden | `publishMutation.mutate` | POST/PATCH `/association/member/directory/profiles` | none | WF-010 | high |
| person | profile.tsx | (auto) create person | useMutation | — | `createPerson.mutate` on isError | POST `/persons` (SDK) | none | WF-006 | med |
| person | settings.tsx | Delete account | Button onClick | Delete My Account | `handleDelete` | POST `/persons/me/delete` | none | WF-011 | high |
| person | settings.tsx | Cancel deletion | Button onClick | Cancel | `handleCancel` | POST `/persons/me/cancel-delete` | none | WF-011 | high |
| person | settings.tsx | notif prefs toggle | Switch onChange | — | `togglePref` | PATCH `/persons/me/notification-preferences` | none | WF-013 | high |
| person | settings.tsx | privacy toggle | Switch onChange | — | `togglePrivacy` | PATCH `/persons/me/privacy` | none | WF-010 | high |
| account | settings/account.tsx | 4 section forms | form submit x4 | Save | `updatePerson.mutateAsync` | PATCH `/persons/:person` (SDK) | none | WF-010 | high |
| account | settings/account.tsx | Request deletion | Button + AlertDialog | Request Account Deletion | `requestDeletion.mutate` | POST (SDK) | none | WF-011 | high |
| account | settings/account.tsx | Cancel deletion | Button onClick | Cancel | `cancelDeletion.mutate` | POST (SDK) | none | WF-011 | high |
| account | settings/account.tsx | Export | Button onClick | Export | `handleExport` → fetchExport | GET `/persons/me/export` | none | WF-014 | high |
| account | data-export.tsx | Request Export | Button onClick | Request Export | `handleRequestExport` | POST `/persons/me/export` | none | WF-014 | high |
| security | settings/security.tsx | password/2FA/passkeys/sessions | better-auth-ui cards | — | better-auth | better-auth endpoints | none | WF-007 | med |
| person | personal-info-form.tsx | avatar upload/remove | Button onClick | Upload/Remove | `onAvatarUpload` (prop) | storage upload (caller) | none | WF-010 | med |

### Registry 9 — Error-UX (non-PASS)

| ID | Sev | Finding | File:Line | Detail |
|---|---|---|---|---|
| J-SETTINGS-001 | P1 | J-ERROR-MISSING | `routes/_authenticated/my/settings.tsx:86-94` | `handleDelete` POST `/persons/me/delete` — catch block is empty (`// error handled silently`). Failable destructive 4xx (already-pending, auth) gives user NO feedback. Account-deletion silence is high-risk. |
| J-SETTINGS-002 | P1 | J-ERROR-MISSING | `routes/_authenticated/my/settings.tsx:99-108` | `handleCancel` POST `/persons/me/cancel-delete` — empty catch, no toast. User cannot tell if cancel failed (could believe account is safe when still scheduled for deletion). |
| J-PROFILE-001 | P1 | J-ERROR-MISSING | `routes/_authenticated/my/profile.tsx:86-103` | `publishMutation` (directory POST/PATCH) has `onSuccess` but **no onError**. Publish-to-public failure is silent; member believes profile is public when it is not. |
| J-SETTINGS-003 | P2 | J-ERROR-GENERIC | `routes/_authenticated/my/settings.tsx:215-225` | `togglePref` catch only reverts optimistic state, no toast — silent failure. (privacy toggle `togglePrivacy` :305-315 same pattern → counted under this ID.) |
| J-ACCOUNT-001 | P2 | J-ERROR-GENERIC | `routes/_authenticated/settings/account.tsx:83,92,102` | `requestDeletion`/`cancelDeletion`/export onError use static `toast.error('Failed to …')` with NO `err.code`/`err.message` interpolation. |
| J-EXPORT-001 | P2 | J-ERROR-GENERIC | `features/account/components/data-export.tsx:97` | `toast.error('Export failed', { description: 'Please try again later.' })` — static, no err interpolation. |
| J-PROFILE-002 | P2 | EMPTY_HANDLER | `features/person/components/personal-info-form.tsx:176-178` | Avatar upload failure swallowed with `console.error` only + comment "Continue with form submission even if avatar upload fails". User gets no notice their photo didn't save. |

PASS (Registry 9): `profile.tsx` `updatePerson` mutation (`onError: setError(err?.message …)` interpolated), `onboarding` createPerson (`meta.toast.error` interpolates `err.message`), `organizations` leave/transfer (interpolate `body?.error`).

### Registry 2/4/5

- WF-010 (View & Update Profile): COMPLETE — edit form → updatePerson → invalidate → reflects.
- WF-011 (Account Deletion): PARTIAL — happy path works (request + cancel), but error states invisible (see J-SETTINGS-001/002). Two parallel deletion UIs exist (`my/settings.tsx` raw fetch + `settings/account.tsx` SDK mutation) — duplication/inconsistency, not broken.
- WF-013 (Notification Preferences): COMPLETE (optimistic), but silent-on-error (J-SETTINGS-003).
- WF-014 (Data Export): COMPLETE.
- Registry 4 (member role): member can complete all assigned profile/account journeys; no role gate blocks member. No P1 role blocks.
- Registry 5: no DEAD_API_CALL, no NOOP, no ORPHAN_FORM (all forms have onSubmit). Dual deletion path = consistency note only.

---

## Sub-module: billing

Files: `routes/_authenticated/my/billing.tsx`, `my/payments.tsx`, `features/billing/components/merchant-account-setup.tsx`.

### Registry 1

| Module | Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|---|---|---|---|---|---|---|---|---|---|
| billing | billing.tsx | Setup account | useMutation→Button | Set up payments | `onboard.mutate` | POST `/billing/merchant-accounts/:acct/onboard` (SDK `startBillingOnboarding`) | none | WF-038 | high |
| billing | billing.tsx | Retry/refetch | Button onClick | Retry | `accountQuery.refetch()` | GET account | none | — | high |
| billing | billing.tsx | Back to dashboard | Button onClick | Back | `navigate('/dashboard')` | — | none | — | high |
| billing | merchant-account-setup.tsx | Setup/Skip/Continue | Button onClick x3 | — | props `onSetupAccount/onSkip/onSubmit` | — (delegated) | none | WF-038 | high |
| billing | payments.tsx | (none) | — | renders `PaymentHistoryTable` (out of cluster file) | GET payment history | none | WF-043 | high |

### Registry 9 (non-PASS)

| ID | Sev | Finding | File:Line | Detail |
|---|---|---|---|---|
| J-BILLING-001 | P2 | J-ERROR-GENERIC | `routes/_authenticated/my/billing.tsx:44` | `onboard` mutation uses `meta: { toast: { error: 'Could not start payment setup' } }` — static string, no err.code/message interpolation. (Has error handling → not P1; just non-specific.) |

Registry 2/4/5: WF-038 onboarding entry COMPLETE (redirect to gateway URL on success, error surfaced + `isStarting` reset on `onboard.isError`). `payments.tsx` is a thin wrapper delegating to `features/dues/PaymentHistoryTable` (out of cluster A scope — flag for cluster D). No dead/noop/orphan.

---

## Sub-module: notifications

Files: `routes/_authenticated/my/notifications.tsx`, `my/organizations.tsx`, `my/data-export.tsx`, `features/notifications/components/notification-inbox.tsx`.

### Registry 1

| Module | Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|---|---|---|---|---|---|---|---|---|---|
| notifications | notification-inbox.tsx | Mark all read | Button onClick | Mark all read | `markAllRead` | POST `/notifs/read-all` | none | WF-109 | high |
| notifications | notification-inbox.tsx | row click | div onClick | — | `onMarkRead(id)` | POST `/notifs/:id/read` | none | WF-109 | high |
| notifications | notification-inbox.tsx | category filter | Button onClick | category | `setActiveCategory` | — | none | — | high |
| notifications | organizations.tsx | Find Organizations | Button onClick x2 | Find Organizations | `toast.info('coming soon')` | — | none | — | high |
| notifications | organizations.tsx | row link | Link | org | `to:` org route | — | none | — | high |
| notifications | organizations.tsx | menu trigger | Button onClick | ⋯ | `e.preventDefault(); stopPropagation()` (allowlisted) | — | none | — | high |
| notifications | organizations.tsx | Transfer | Button onClick | Transfer | `setTransferTarget` | (later) POST `/association/member/affiliation-transfers` | none | WF-036 | high |
| notifications | organizations.tsx | Leave | Button onClick + dialog | Leave | `confirmLeave` | POST `/association/member/memberships/:id/terminate` | none | WF-035 | high |
| notifications | data-export.tsx | (none) | — | renders `DataExport` | — | none | WF-014 | high |

### Registry 5/9 (non-PASS)

| ID | Sev | Finding | File:Line | Detail |
|---|---|---|---|---|
| J-NOTIF-001 | P2 | EMPTY_HANDLER (silent) | `features/notifications/components/notification-inbox.tsx:101-102,110-111` | `markAllRead` and per-row `markRead` POSTs both `catch { /* ignore */ }` — failures silent, no toast. User may see unread count not clear with no feedback. |
| J-ORG-001 | P3 | Stub interaction | `routes/_authenticated/my/organizations.tsx:76,90` | "Find Organizations" buttons fire `toast.info('Organization discovery coming soon')` — placeholder, no destination. Functional toast (not NOOP) but feature unreachable. |

PASS: organizations leave (`toast.error(body?.error ?? …)` interpolated) and transfer (`body?.error` interpolated) — both have specific error surfacing with generic fallback. notifications GET query exposes `fetchError` to UI.

### Registry 2/4

- WF-109 inbox read flow COMPLETE (optimistic) but silent-on-error (J-NOTIF-001).
- WF-035 (Reinstatement/Leave) and WF-036 (Transfer) entry from org list: COMPLETE.
- Member role can complete all; no role blocks.

---

## Sub-module: onboarding

File: `routes/onboarding.tsx`, `features/onboarding/lib/professional-fields.ts`, person forms (shared).

### Registry 1

| Module | Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|---|---|---|---|---|---|---|---|---|---|
| onboarding | onboarding.tsx | Personal info submit | form onSubmit | Continue | `handlePersonalInfoSubmit` → step | — | none | WF-006 | high |
| onboarding | onboarding.tsx | Address submit | form onSubmit | Finish | `handleAddressSubmit` → createPerson | POST `/persons` (SDK) | none | WF-006 | high |
| onboarding | onboarding.tsx | Skip address | Button onClick | Skip | `handleSkipAddress` → createPerson | POST `/persons` | none | WF-006 | high |
| onboarding | onboarding.tsx | Back | Button onClick | Back | `goBack` | — | none | — | high |

Registry 2/4/5/9: all PASS. `createPerson` uses `meta.toast.{success,error}` with `err.message` interpolation. Success → refetch person → navigate `/dashboard`. Forms have onSubmit. No dead/noop/orphan. Member journey COMPLETE.

---

## Sub-module: id-card

File: `routes/_authenticated/my/id-card.tsx`.

### Registry 1

| Module | Screen | Element | Type | Label | Handler | API | RoleGate | WF | Conf |
|---|---|---|---|---|---|---|---|---|---|
| id-card | id-card.tsx | data loads | useQuery x2 | — | — | GET `/persons/me`, `/persons/me/memberships` | none | WF-012 | high |
| id-card | id-card.tsx | Download PDF | Button onClick | Download PDF | `handleDownloadPdf` | `window.open('/persons/me/id-card/:orgId/pdf')` | none | WF-012/WF-071 | high |

### Registry 5 (non-PASS)

| ID | Sev | Finding | File:Line | Detail |
|---|---|---|---|---|
| J-IDCARD-001 | P3 | Error-UX gap | `routes/_authenticated/my/id-card.tsx:80-84` | `handleDownloadPdf` does `window.open` to PDF route in new tab — if PDF generation 4xx/5xx (endpoint exists, hand-wired `app.ts:503`), failure surfaces only as broken tab; no in-app toast. Button correctly disabled when `!orgId`. Not dead (endpoint confirmed). Low-severity UX. |

Registry 2/4: WF-012/WF-071 COMPLETE — endpoint verified present (`getMyIdCardPdf` hand-wired). Member can download. No role block.

---

### Findings summary

| ID | Severity | Module | File:Line | Issue | Suggested fix |
|---|---|---|---|---|---|
| J-SETTINGS-001 | P1 | profile/account | `routes/_authenticated/my/settings.tsx:86-94` | Account-delete POST swallows errors silently (empty catch) | Add `toast.error(body?.error ?? 'Could not request deletion')` in catch |
| J-SETTINGS-002 | P1 | profile/account | `routes/_authenticated/my/settings.tsx:99-108` | Cancel-delete swallows errors; user may wrongly believe account safe | Surface error toast on cancel failure |
| J-PROFILE-001 | P1 | profile/account | `routes/_authenticated/my/profile.tsx:86-103` | Directory publish mutation has no onError; silent failure on public-visibility set | Add `onError` with `toast.error(err?.message ?? …)` |
| J-SETTINGS-003 | P2 | profile/account | `routes/_authenticated/my/settings.tsx:215-225,305-315` | notif-pref & privacy toggles revert silently, no toast | Add error toast alongside optimistic revert |
| J-ACCOUNT-001 | P2 | profile/account | `routes/_authenticated/settings/account.tsx:83,92,102` | Static generic error toasts, no err interpolation | Interpolate `err.code`/`err.message` |
| J-EXPORT-001 | P2 | profile/account | `features/account/components/data-export.tsx:97` | Static "Export failed" toast, no err detail | Interpolate err message |
| J-PROFILE-002 | P2 | profile/account | `features/person/components/personal-info-form.tsx:176-178` | Avatar upload failure console.error only; user not told photo unsaved | Toast on avatar upload failure |
| J-BILLING-001 | P2 | billing | `routes/_authenticated/my/billing.tsx:44` | Static onboarding error toast, no err interpolation | Interpolate gateway error detail |
| J-NOTIF-001 | P2 | notifications | `features/notifications/components/notification-inbox.tsx:101-111` | mark-read / mark-all-read failures ignored silently | Toast or rollback indicator on failure |
| J-ORG-001 | P3 | notifications | `routes/_authenticated/my/organizations.tsx:76,90` | "Find Organizations" is a "coming soon" stub | Wire to org discovery route or hide |
| J-IDCARD-001 | P3 | id-card | `routes/_authenticated/my/id-card.tsx:80-84` | PDF download via window.open; gen failure surfaces only as broken tab | Fetch + blob with error toast, or pre-validate |

### Counts

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 3 |
| P2 | 5 |
| P3 | 2 |
| **Total** | **10** |

Fragment status: **COMPLETE** (30/30 files scanned). 0 DEAD_API_CALL — all API paths verified against generated routes + hand-wired `app.ts`.
