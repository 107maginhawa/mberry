# MODULE_SPEC Handoff — Remaining Backfill

Modules still missing a `docs/product/MODULE_SPEC.<module>.md`. Use `docs/quality/MODULE_SPEC_TEMPLATE.md` for each. Estimated effort: ~30 min/spec.

**Completed (this wave)**:
- `audit` → `docs/product/MODULE_SPEC.audit.md`
- `marketplace` → `docs/product/MODULE_SPEC.marketplace.md`
- `dues` → `docs/product/MODULE_SPEC.dues.md`

---

## Pending modules

### association:operations
**Handler dir**: `services/api-ts/src/handlers/association:operations/` (~69 handlers)
**Context**: Analytics, training, and events under the association umbrella. Wave 3.5 verdict: KEEP-AS-IS. Distinct from `association:member`. Covers training registrations, event analytics, CPD reporting.
**Effort**: ~45 min (large surface area — handler inventory alone is significant).
**Priority**: High — mega-module split plan (P1-11) needs a clear spec before scoping.

### invite
**Handler dir**: `services/api-ts/src/handlers/invite/` — 4 handlers: `bulkImportMembers`, `claimInvite`, `createInvite`, `validateInvite`
**Context**: Org invitations — creation, validation, claim flow. Has test coverage per file listing.
**Effort**: ~25 min (small, self-contained).
**Priority**: Medium.

### notifs
**Handler dir**: `services/api-ts/src/handlers/notifs/` — 5 handlers: `getNotification`, `listNotifications`, `markAllNotificationsAsRead`, `markNotificationAsRead` + notification-triggers
**Context**: Multi-channel notifications via OneSignal. `notifs` is distinct from `communication` (which owns templates and announcements). OneSignal multi-app pattern — see CLAUDE.md.
**Effort**: ~30 min.
**Priority**: Medium — notification delivery is core to dues reminders and event workflows.

### reviews
**Handler dir**: `services/api-ts/src/handlers/reviews/` — 4 handlers: `createReview`, `deleteReview`, `getReview`, `listReviews`
**Context**: NPS review system. Small, self-contained. All handlers have unit tests.
**Status**: No existing MODULE_SPEC found — needs to be written.
**Effort**: ~20 min (small surface).
**Priority**: Low.

### storage
**Handler dir**: `services/api-ts/src/handlers/storage/` — 6 handlers: `completeFileUpload`, `deleteFile`, `getFile`, `getFileDownload`, `listFiles`, `uploadFile`
**Context**: File upload/download via S3/MinIO. Has security test (`br-31.svg-upload-security.test.ts`) — documents a specific BR around SVG upload restrictions. Auth-enforcement tests exist.
**Effort**: ~30 min. Document the SVG security gotcha prominently.
**Priority**: Medium — storage is a cross-cutting concern used by documents, certificates, and profiles.

### association:member (SKIP — owned by rebuild plan)
Mega-module (~193 handlers). Spec will be produced as part of the `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md` re-scope effort. Do not write a flat MODULE_SPEC here — it will be superseded by the split.

---

## How to pick up

1. Choose a module from the list above.
2. Read handlers from `services/api-ts/src/handlers/<module>/`.
3. Find TypeSpec at `specs/api/src/modules/<module>.tsp` (or search for module name in `specs/api/src/modules/`).
4. Find schema files at `services/api-ts/src/handlers/<module>/repos/*.schema.ts`.
5. Fill `docs/quality/MODULE_SPEC_TEMPLATE.md` → save as `docs/product/MODULE_SPEC.<module>.md`.
6. Commit: `docs(spec): MODULE_SPEC for <module>`.
