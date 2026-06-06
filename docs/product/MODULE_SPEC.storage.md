# MODULE_SPEC: storage

> Generated as part of Step-2 (MODULE_SPEC backfill).

## 1. Purpose

Provides multi-tenant file upload, retrieval, listing, and deletion against an S3-compatible object store (MinIO in dev, S3 in prod) using presigned PUT-and-complete URLs. The module owns the file metadata table and the presigning lifecycle (`uploading` → `processing` → `available` / `failed`); it does not own MIME-specific business logic — callers (documents, certificates, person avatar) decide what they upload and how they consume it.

## 2. Bounded Context

**Owns:** the `stored_file` metadata table, presigned-URL minting (upload + download), per-org file listing with pagination, file deletion with object-store cleanup, the BR-31 allowed-MIME allowlist + SVG-sanitization invariant.

**Out of scope:** virus scanning (TBD — currently unimplemented; relies on MIME allowlist + presigned PUT scope limits), file content transformations (PDF rendering, image resize), retention / GDPR scrubbing of file objects on org-deletion. The latter is a known gap — see §9.

**Adjacent modules:**
- `documents` — re-uses storage as the underlying store for member-facing documents (member handbooks, credentials evidence). Calls `uploadFile` flow then attaches the resulting `file` UUID to its own row.
- `certificates` — same shape as documents; certificate PDFs land in storage.
- `person` — avatar uploads consume `uploadFile` directly.
- `core/storage.ts` (`StorageProvider`) — the abstraction; concrete impls live in core, not in this handler dir. Handlers receive the provider via `ctx.get('storage')`.

## 3. Handler Inventory

| Handler file | Verb | Auth required | Audit action | Notes |
|---|---|---|---|---|
| `uploadFile.ts` | POST `/storage/files/upload` | `user` (any role) | `file.upload-requested` | Mints a presigned PUT URL valid for `STORAGE_UPLOAD_URL_EXPIRY` seconds (default 300). Validates MIME against `ALLOWED_MIME_TYPES` — SVG is excluded by design (see §9 BR-31). |
| `completeFileUpload.ts` | POST `/storage/files/:file/complete` | `user`, file-owner only | `file.upload-completed` | Flips status `uploading` → `available`. Owner-only; non-owner gets 404 to avoid existence leak. |
| `getFile.ts` | GET `/storage/files/:file` | `user`, org-scoped | (read) | Returns metadata only — no presigned download URL. Pair with `getFileDownload` when the bytes are needed. |
| `getFileDownload.ts` | GET `/storage/files/:file/download` | `user`, org-scoped | `file.download-requested` | Mints a presigned GET URL valid for `STORAGE_DOWNLOAD_URL_EXPIRY` seconds (default 900). Auth check is org membership + owner OR a calling module's access policy (caller passes through `x-org-id`; handler trusts org-context middleware). |
| `listFiles.ts` | GET `/storage/files` | `user`, org-scoped | (read) | Paginated; filters by owner and status. |
| `deleteFile.ts` | DELETE `/storage/files/:file` | `user`, file-owner or `admin` | `file.delete` | Removes the metadata row + sends a delete to the storage provider (best-effort; object cleanup failure logs WARN and proceeds). |

Test coverage: 1 unit (`uploadFile.test.ts`), 1 BR (`br-31.svg-upload-security.test.ts`), 1 auth-enforcement suite, 1 aggregator (`storage-handlers.test.ts`).

## 4. TypeSpec source

`specs/api/src/modules/storage.tsp` — also re-exports the `MaybeStoredFile` model used by other modules to reference uploaded files in their own payloads.

## 5. Database schema

- `services/api-ts/src/handlers/storage/repos/file.schema.ts` — single `stored_file` table + `file_status` enum.

Notable shape:
- `status` enum: `uploading`, `processing`, `available`, `failed`.
- `size` is `bigint` — files >4GB are technically representable; the practical cap is whatever the presigned PUT scope and the gateway allow.
- Indexed by `organizationId` and `owner`. No FK from `owner` → `persons` — deliberate, to support service-account owners.

## 6. Cross-module dependencies

- **Emits domain events:** none today. Adding `file.completed` and `file.deleted` would let documents / certificates listen instead of polling — flagged as a candidate cleanup.
- **Consumes events from:** none directly. `person.deleted` should eventually scrub orphan files; today it does not — see §9.
- **Calls handlers from:** none.

## 7. Test coverage status

- Unit tests: 6/6 handlers + BR-31 sanitization + cross-handler auth-enforcement suite. Coverage is mid-band per the Step-1 baseline (`deleteFile.ts` 64%, `listFiles.ts` 63%, `getFile.ts` 71%) — the gaps are around presigned-URL error paths.
- Contract scenarios: `storage.hurl` + `storage-edge.hurl` (2 files, all passing in the Step-1 baseline).
- E2E: no dedicated storage spec; the flow is exercised indirectly through documents / certificates uploads.

## 8. Hand-wired routes

None. All six routes go through the generated registry.

## 9. Known gotchas

- **BR-31 — SVG uploads are disallowed at the MIME-allowlist layer.** SVG is XML, can contain `<script>` and `on*` event handlers. The repo includes a pure-domain sanitization test suite (`br-31.svg-upload-security.test.ts`) documenting the contract, but the *handler does not allow SVG through at all*. If a future feature needs SVG support, lift the allowlist exclusion AND apply the sanitization helpers from the test file before persisting — the test file already encodes the contract.
- **Orphan files on person deletion.** `person.deleted` cascades 19 entities, but the `stored_file` rows owned by that person stay behind. They become unreachable (org-scoped listFiles still returns them but the owner no longer exists). Flagged for a future `person.deleted` consumer to either scrub or reassign.
- **No virus scan.** Production hardening item. The MIME allowlist + presigned-PUT scope is the only barrier today.
- **`completeFileUpload` is the only way to flip `uploading` → `available`.** If the client uploads bytes but never calls complete, the row sits at `uploading` forever. Add a scheduled job to age out stale uploads when this becomes a problem.
- **`STORAGE_PROVIDER=minio` vs `s3` is config-only.** The handler code path is identical; only the presigner endpoint differs. Tests pin `minio` via env.

## 10. AI extension checklist

To add a new endpoint to this module:

1. `specs/api/src/modules/storage.tsp` — declare the operation; reuse `MaybeStoredFile` for any cross-module reference. Add `@extension("x-audit", #{ action: "...", resourceType: "file" })` for mutations.
2. `services/api-ts/src/handlers/storage/<verbResource>.ts` — implement. Access the storage provider via `ctx.get('storage') as StorageProvider`; never instantiate AWS SDK clients directly. Use `StorageFileRepository` for DB writes.
3. `services/api-ts/src/handlers/storage/<verbResource>.test.ts` — Bun unit test. For mutations, cover the org-isolation case (file from a different org → 404, not 403). For uploads, cover MIME allowlist + (if relevant) the BR-31 SVG path.
4. `specs/api/tests/contract/storage.hurl` or `storage-edge.hurl` — extend; new auth scope → new scenario file (`storage-<scope>.hurl`).
5. Regenerate: `cd specs/api && bun run build && cd ../../services/api-ts && bun run generate`.

Forbidden:
- Editing `services/api-ts/src/generated/**`.
- Calling AWS SDK clients directly from handlers — use `StorageProvider`.
- Adding SVG to `ALLOWED_MIME_TYPES` without lifting the BR-31 sanitization gate into the upload-complete handler.
- Adding to `app.ts` — no allow-list reason applies.

When extending: mirror `uploadFile.ts` for presigned-PUT flows and `getFileDownload.ts` for presigned-GET flows.
