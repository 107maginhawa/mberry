# J-PHANTOM-NAV Triage (post-E1)

Source: `oli query interactions` — 5 P0 J-PHANTOM-NAV findings on the v6 engine map (FRESH).

**Root cause class:** all 5 are raw `fetch('/api/...')` call sites. The engine's
api-usage join does NOT strip the `/api` proxy prefix for raw fetch (only 5 of 454
endpoint keys carry `/api/`), so each produces a phantom twin of a real backend key.
Verdict therefore splits on: *does a backend route exist once `/api` is stripped?*

| # | Component | Call (as written) | Backend route (engine API surface) | Verdict |
|---|-----------|-------------------|-------------------------------------|---------|
| 1 | AssociationDetailPage (`apps/admin/.../associations/$associationId.tsx:134`) | `GET /api/admin/national-dashboard/:associationId` | `GET /admin/national-dashboard/:associationId` ✅ exists (spec+impl) | **FALSE POSITIVE** — works at runtime (Vite proxy strips `/api`). Not a bug. |
| 2 | ApplicationList (`apps/memberry/.../membership/.../application-list.tsx:117`) | `POST /api/association/member/applications/bulk-approve` | `POST /association/member/applications/bulk-approve` ✅ exists | **FALSE POSITIVE** — works at runtime. Not a bug. |
| 3 | OrganizationDetailPage (`apps/admin/.../organizations/$organizationId.tsx:59`) | `POST /api/admin/organizations/:organizationId/transition` | `POST /admin/organizations/:organizationId/transition` ✅ exists | **FALSE POSITIVE** — works at runtime. Not a bug. |
| 4 | ProofUploadForm (`apps/memberry/.../dues/.../proof-upload-form.tsx:105`) | `POST /api/storage/files` | **no `POST /storage/files`** — upload is `POST /storage/files/upload` | **REAL BUG — wrong path.** 404s at runtime. Fix: call `POST /storage/files/upload` (prefer SDK storage flow). |
| 5 | PostEventActions (`apps/memberry/.../events/.../post-event-actions.tsx:238`) | `POST /api/association/member/credits/void-event` | **absent** — not in spec, not in API surface (only `credits/manual`, `persons/me/credits`) | **REAL BUG — backend route missing.** The "revoke awarded credits" action has no endpoint. Fix: add backend `void-event` (or equivalent) route, then point client at it. |

## Summary
- **3 false positives** (#1–3): backend routes exist; calls succeed via the `/api` proxy strip. No code fix needed.
- **2 real dead calls** (#4–5): genuinely broken user actions (proof upload, revoke credits).
- **Engine follow-up (E2, optional):** teach the api-usage join to strip a configurable `/api` proxy prefix on raw-fetch sites — would clear the 3 false positives at the source and keep #4/#5 flagged.

## Recommended fixes (NOT yet applied)
- **#4 ProofUploadForm:** change `fetch('/api/storage/files', …)` → storage upload endpoint `POST /storage/files/upload` (ideally via `@monobase/sdk-ts` storage flow rather than raw fetch).
- **#5 PostEventActions:** add the missing backend `void-event` credits route (handler in `services/api-ts/src/handlers/training` or `association/member/credits`), expose in TypeSpec, regenerate, then call via SDK.
