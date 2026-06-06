## Cluster E — Officer roster/governance

Static UI journey audit of `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/` (governance subset; finance/comms/dues/elections/events/training/reports/payments/settings excluded — owned by cluster D). Spec inputs: ROLE_PERMISSION_MATRIX.md, ERROR_TAXONOMY.md, WORKFLOW_MAP.md.

---

### Scan Manifest

| Sub-module | File(s) | Status |
|---|---|---|
| officer-shell | `officer.tsx` (layout guard), `officer/dashboard.tsx` | scanned |
| officer-roster | `officer/roster.tsx`, `officer/roster/index.tsx`, `officer/roster/import.tsx`, `officer/roster/$memberId.tsx` | scanned |
| officer-applications | `officer/applications.tsx` + `features/membership/components/application-list.tsx` | scanned |
| officer-officers | `officer/officers.tsx` + `features/admin/components/officer-management.tsx` | scanned |
| officer-certificates | `officer/certificates.tsx` | scanned |
| officer-documents | `officer/documents/index.tsx`, `officer/documents/$documentId.tsx` + `features/documents/document-library.tsx`* | scanned |
| officer-compliance | `officer/compliance.tsx` | scanned |
| officer-reviews | `officer/reviews/index.tsx` | scanned |
| officer-surveys | `officer/surveys/{index,new,$surveyId}.tsx` + `features/surveys/{survey-builder,survey-list}.tsx` | scanned |
| officer-institutional | `officer/institutional-memberships/{index,new,$institutionalMembershipId}.tsx` + `features/membership/{institutional-membership-form,institutional-membership-table,seat-management-panel}.tsx`* | scanned |
| officer-messages | `officer/messages/index.tsx` | scanned |

*Shared feature components scanned for mutation/error-UX; `document-library.tsx` and `institutional-membership-table.tsx` list-only (no findings). `roster.tsx` is a pass-through `<Outlet/>`.

Inventoried route files (in-scope): 13. Scanned: 13. Shared feature components: 9. **COMPLETE.**

---

### Registry 4 — Role Journey

- **Route guard:** `officer.tsx` layout applies `beforeLoad: requireOrgOfficer` (`@/utils/guards`). All officer children inherit it. Member/user cannot reach any officer governance screen → **PASS** (no P1 guard gap).
- **Roster import (file-upload):** `roster/import.tsx` has real `<input type=file>` + drag/drop + CSV parser + `importRosterMembersMutation`; error path present (try/catch → toast). **PASS.**
- **Approve/reject application:** `application-list.tsx` approve/deny/bulk-approve mutations all have `onError`. **PASS.**
- **Role change (assign/remove officer):** `officer-management.tsx` assign + optimistic remove both error-handled w/ rollback. **PASS.**

---

### officer-shell

**Registry 1**

| Screen | Element | Type | Label | Handler | API | Conf |
|---|---|---|---|---|---|---|
| dashboard | "Import Roster" | Link | Import Roster | nav | — | hi |
| dashboard | "Add Member" | Link | Add Member | nav `/officer/roster/new` | — | hi |

**Registry 5** — `J-ODASH-001` MISROUTED_LINK (P2): dashboard "Add Member" links to `/org/$orgSlug/officer/roster/new`, but no `roster/new.tsx` exists. The dynamic `roster/$memberId.tsx` captures `new` as `memberId`, rendering MemberDetailPage that queries member id `"new"` → "Failed to load" page instead of the intended add flow (real add = dialog on `roster/index.tsx`).

---

### officer-roster

**Registry 1 (key)**

| Screen | Element | Type | Handler | API | Conf |
|---|---|---|---|---|---|
| roster/index | "Add Member" | Button→Dialog | onSubmit | POST `/api/persons` then `addRosterMemberMutation` | hi |
| roster/index | Member rows | Table | — | `getOrgCpdConfig` query | hi |
| roster/import | drop zone / file input | file upload | `handleFile`→parseCSV | `importRosterMembersMutation` | hi |
| roster/import | "Import N Members" | Button | `handleImport` | `importRosterMembersMutation` | hi |
| roster/$memberId | "Verify" license | Button | `verifyMutation` | PATCH `/api/association/member/licenses/{id}` | hi |

Registry 9: AddMemberDialog onSubmit interpolates `err.message` → PASS. import onError interpolates ApiError body message → PASS. verifyMutation has onError → PASS. No non-PASS findings within roster files. Note `window.location.reload()` after add (heavy but functional).

---

### officer-certificates

**Registry 1**

| Element | Type | Handler | API | Conf |
|---|---|---|---|---|
| Bulk Issue | button | `handleBulkIssue` | POST `/api/certificates/bulk-issue` | hi |
| Verify | button | `verifyMutation` | GET `/certificates/verify/{num}` | hi |

**Registry 5** — `J-OCERT-001` DEAD_API_CALL (P0): verify mutation calls `api.get('/certificates/verify/...')` **without `/api` prefix**. Vite proxy (`vite.config.ts`) only proxies paths matching `^/api`; this request hits the dev/static server, never the backend → always fails ("Certificate not found"). bulk-issue uses correct `/api/...` prefix.

---

### officer-compliance

**Registry 1**

| Element | Type | Handler | API | Conf |
|---|---|---|---|---|
| Refresh | Button | `refreshMutation` | POST `/api/association/member/compliance/{orgId}/refresh` | hi |
| Status filter | Select | setStatusFilter | query | hi |

**Registry 9** — `J-OCOMP-001` J-ERROR-MISSING (P1): `refreshMutation` (a failable POST that recomputes compliance) has `onSuccess` only — no `onError`. On failure the spinner stops silently with zero user feedback. Add onError → toast.

---

### officer-reviews / officer-messages

- reviews/index: read-only list; loading/`error`/empty branches present (error branch L80-83). **PASS.**
- messages/index: delegates to comms `ChannelList`/`ChatView`/`CreateChannelDialog`; `getPerson('me')` query `retry:false`. Create Channel button → dialog. No mutation defined here. **PASS.**

---

### officer-surveys

**Registry 1 (key)** — index "New Survey" Link → `/surveys/new` (route exists). new.tsx → SurveyTemplates/SurveyBuilder, navigates to `$surveyId` on success. survey-list publish/close/delete/clone mutations all `onError` (toast). survey-builder createMut `onError` sets serverError + toast.

Registry 9: all survey mutations interpolate/handle errors → **PASS.** No non-PASS findings.

---

### officer-institutional

**Registry 1 (key)** — index "New Membership" Link (route exists). new.tsx → InstitutionalMembershipForm (create/update muts w/ onError + serverError banner). $id detail: delete mutation (onError + rollback toast), SeatManagementPanel allocate/revoke (both onError). All forms have field-level + server error rendering.

Registry 9: all mutations error-handled → **PASS.** No non-PASS findings.

---

### officer-applications / officer-officers / officer-documents

- applications: approve/deny/bulk-approve — all `onError`; denial requires reason (validated). **PASS.**
- officers: assign + optimistic remove (rollback on catch); AssignRoleModal submit try/catch → toast. **PASS.**
- documents/$documentId: updateDocument, uploadNewDocumentVersion, createDocumentTag — all `onError` interpolating `err.message`. Access-level edit, tag suggestions, version upload all wired. **PASS.**

---

### Findings summary

| ID | Sev | Module | File:Line | Issue | Fix |
|---|---|---|---|---|---|
| J-OCERT-001 | P0 | officer-certificates | `officer/certificates.tsx:38` | DEAD_API_CALL: verify uses `/certificates/verify/{num}` w/o `/api` prefix; Vite proxy never forwards it → verify always fails | Change to `api.get(\`/api/certificates/verify/${...}\`)` |
| J-OCOMP-001 | P1 | officer-compliance | `officer/compliance.tsx:28` | J-ERROR-MISSING: `refreshMutation` failable POST has no `onError` → silent failure | Add `onError: () => toast.error('Failed to refresh compliance')` |
| J-ODASH-001 | P2 | officer-shell | `features/admin/components/officer-dashboard.tsx:164` | MISROUTED_LINK: "Add Member" → `/officer/roster/new`; no such route, caught by `roster/$memberId` → broken member-detail load | Point Link to `/officer/roster` (opens add dialog) or add a `roster/new` route |

**Counts:** P0 = 1 · P1 = 1 · P2 = 1 · P3 = 0

**COMPLETE** — scanned 13/13 in-scope route files + 9 shared feature components.
