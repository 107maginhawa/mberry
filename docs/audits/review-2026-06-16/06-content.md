# C6 — Content & Misc Modules Review (2026-06-16)

Scope: `documents/`, `storage/`, `certificates/` (lives under `member/certificates/`), `marketplace/`, `advertising/`, `audit/`, `jobs/` (a **job-board**, not the background-job registry — the cron registry lives in `core/jobs.ts` + per-module `jobs/` dirs).

Theme: **IDOR**. Route-level `authMiddleware({ roles })` is generated correctly for marketplace/advertising, but several handlers skip the per-resource **org-scope** re-check, so a correctly-roled caller in org A can reach org B's rows by UUID.

---

## documents/

`services/api-ts/src/handlers/documents/createDocument.ts:51` — **[P0][Cross]** Client-controlled `storageKey`. The handler writes `storageKey: body.storageKey` straight from the request body, and `downloadDocument.ts:48` later feeds it into `storage.generateDownloadUrl(document.storageKey)` which presigns a GET for *any* object key in the bucket. A member creates a self-owned document (`ownerType:'person', ownerId:self` → passes the officer bypass at line 34-38) with `storageKey` set to **another org's** file UUID, then calls `/documents/:id/download` and receives a presigned URL to bytes they never uploaded. The storage module's own owner/tenant checks (getFileDownload) are bypassed because download goes through the document path, not the storage path.
Why: trust boundary violation — the storage key namespace is shared (`storage/` keys files by bare UUID with no org prefix), and documents accept arbitrary keys.
Fix: never accept `storageKey` from the client. Mint it server-side, or validate it resolves to a `stored_files` row owned by the caller's org before persisting.
```ts
// createDocument.ts — validate the key belongs to caller's org
const fileRepo = new StorageFileRepository(db, logger);
const fileRow = await fileRepo.findOneById(body.storageKey);
if (!fileRow || fileRow.organizationId !== orgId || fileRow.owner !== user.id) {
  throw new ValidationError('storageKey does not reference a file you uploaded');
}
```

`services/api-ts/src/handlers/documents/deleteDocument.ts:23-32` — **[P2][Intra]** Delete is gated only by org-scope, not by officer/owner. Any session whose org matches the document's org can delete any document in that org (create requires officer for non-self-owned docs, but delete does not). Asymmetric authority.
Fix: require `requireOfficerTerm(ctx)` unless `existing.ownerType==='person' && existing.ownerId===user.id`, mirroring createDocument's guard.

`services/api-ts/src/handlers/documents/getDocument.ts:26-30`, `downloadDocument.ts:34-46` — **[OK]** Org-scope (getDocument) / active-membership+admin (downloadDocument) checks present. Access-log persisted best-effort on both view and download (`getDocument.ts:38`, `downloadDocument.ts:53`); failure never breaks the read — correct fail-open for a *log*, but note a download whose access-log write fails leaves no record (acceptable, logged at warn).

---

## storage/

`services/api-ts/src/handlers/storage/getFile.ts:68-74` — **[P1][Intra]** Missing tenant boundary. `getFileDownload.ts:58`, `deleteFile.ts:62`, and `completeFileUpload.ts:55` all enforce `file.organizationId !== ctx.get('organizationId')` *before* the owner/admin check — but `getFile` does **not**. It checks only `isOwner || isAdmin`. A foreign-org **admin** (`userHasRole(auth,user,'admin')` is a global/role check, not org-scoped) can read any file's metadata + a 15-min presigned download URL by UUID across org boundaries. Inconsistent with its three sibling handlers.
Fix: add the same guard the siblings have.
```ts
// getFile.ts after the findOneById null-check (line ~66)
if (file.organizationId !== ctx.get('organizationId')) {
  throw new ForbiddenError('Access denied: file belongs to a different organization');
}
```

`services/api-ts/src/handlers/storage/uploadFile.ts:37-49,71-90` — **[OK]** Filename sanitized via `path.basename` + control-char strip; MIME allowlist (SVG excluded with rationale); 50MB cap. Object key is a server-minted `uuidv4()` (line 93) — **no path traversal**, the user-supplied filename is stored as metadata only, never used as the S3 key.

`services/api-ts/src/core/storage.ts:100-134` — **[P3][Intra]** Presigned URL expiry comes from config (`uploadUrlExpiry`/`downloadUrlExpiry`) but there is no upper bound or floor; a misconfigured large value yields long-lived public URLs. Handlers compute their own display `expiresAt` (`+15min`/`+5min`, `getFileDownload.ts:79`, `uploadFile.ts:126`) that can **drift** from the actual signed TTL if config differs — the response advertises an expiry that doesn't match the URL. Pin the handler display value to `config.downloadUrlExpiry`, and clamp config to a sane max (e.g. ≤15min) at load.

`services/api-ts/src/core/storage.ts:48-81` — **[P3][Intra]** `publicClient` presigns with the *public* endpoint but the signature is still scoped to a single object key per command — fine. No `ResponseContentDisposition`/`ResponseContentType` is pinned on the GET presign, so a stored `text/html`/SVG (SVG is blocked on upload, but legacy rows may exist) could render inline from the storage origin. Add `ResponseContentDisposition: attachment` to `GetObjectCommand`.

---

## certificates/ (member/certificates/)

`services/api-ts/src/handlers/member/certificates/*` — **[Cross][OK]** No top-level `certificates/` handler dir; CLAUDE.md's "re-exported from member" note matches reality. `verifyCertificatePublic.ts` is intentionally public (QR verification). No drift found between a phantom `certificates/` dir and the member impls because the former does not exist. (Not deeply audited — out of the LOW-test set; flag for a dedicated pass if public verification endpoints widen.)

---

## marketplace/  (tests 8/17 — LOW)

`services/api-ts/src/handlers/marketplace/updateVendor.ts:29-32` — **[P1][Intra]** No org-scope check. Route allows `association:admin|staff`, but the handler does `repo.findOneById(vendorId)` then updates with **no** `existing.organizationId === ctx.organizationId` guard. An admin/staff of org A edits a vendor record owned by org B by UUID. Cross-org IDOR. Contrast `updateListing.ts:39` which *does* guard. Doc-comment says "admin only" but means *any* org's admin.
Fix:
```ts
const orgId = ctx.get('organizationId') as string;
if (!existing || existing.organizationId !== orgId) throw new NotFoundError('Vendor not found');
```

`services/api-ts/src/handlers/marketplace/getVendor.ts:24-31` — **[P2][Intra]** Same gap, read side: no org-scope filter, so any user can read any vendor across orgs by UUID. listVendors is org-scoped; the by-id read is not.

`services/api-ts/src/handlers/marketplace/fulfillOrder.ts` — **[P2][Intra]** Route role set is `["association:admin","association:staff","user"]`. The handler only checks order org-scope + FSM transition; it does **not** verify the caller is the order's **vendor**. Any plain `user` in the org can mark *any* order fulfilled. This is "G-06 marketplace authority model — pending product decision" per `listOrders.ts` comment, but it is shipped open today.
Fix: bind to vendor identity — resolve the caller's vendor record and assert `order.vendorId` belongs to it, or drop `"user"` from the route role set.

`services/api-ts/src/handlers/marketplace/cancelOrder.ts` — **[P2][Intra]** Route role `["user"]`; handler checks org-scope only, not `order.buyerPersonId === user.id`. Any member can cancel any other member's pending/confirmed order in the org.
Fix: `if (order.buyerPersonId !== user.id) { require officer/staff }`.

`services/api-ts/src/handlers/marketplace/createOrder.ts:34-50` — **[OK]** Org-scope on listing, active-status gate, price-null/NaN rejection (FIX-005), totalPrice computed server-side from `listing.price` — buyer cannot inject `totalPrice`. Good payment-field hygiene.

`services/api-ts/src/handlers/marketplace/listOrders.ts`, `listListings.ts` — **[OK]** `limit = Math.min(parseInt(...20), 100)` caps page size. Org-scoped. Per-actor visibility deferred (G-06) — a buyer sees all org orders, not just their own; acceptable for V1 but note it leaks order/buyer metadata org-wide.

---

## advertising/  (tests 7/12 — LOW)

`services/api-ts/src/handlers/advertising/getAdForPlacement.ts` — **[OK]** Opt-out read **server-side** from `member_ad_opt_out` (FIX-008), client `optedOut` flag ignored; serving gated on campaign `active` + within `starts_at..ends_at` (FIX-010); sponsored label forced. Solid.

`services/api-ts/src/handlers/advertising/setMemberOptOut.ts:5-25` — **[OK]** Persists to repo, fails closed without org context, scoped to `user.id`. Previously a no-op — now real.

`services/api-ts/src/handlers/advertising/reportAd.ts` — **[OK]** Threshold 3 / 7-day rolling window (FIX-009), auto-pause persisted. Route `["user"]`. No org-scope check on the creative being reported (`creativeRepo.findOneById(creativeId)` then proceeds) — **[P3][Intra]** a user could report a creative in another org by UUID, inflating its report count / triggering auto-pause cross-org. Add `creative.organizationId === orgId` guard.

`services/api-ts/src/handlers/advertising/reviewCreative.ts`, `createCampaign.ts`, `createCreative.ts`, `createAdvertiser.ts` — **[OK at route]** `reviewCreative` is `association:admin`; create paths are `admin|staff`. `createCampaign.ts:31` rejects PII targeting fields (M16-R2). **[P3][Intra]** `reviewCreative`/`createCampaign` do not re-check that the creative/advertiser belongs to the caller's org before mutating — same class as updateVendor; lower impact since restricted to admin/staff, but a multi-org admin could approve another org's creative. Add the org-scope guard on `findOneById` results.

---

## audit/

`services/api-ts/src/handlers/audit/listAuditLogs.ts:26-40` — **[OK]** Route restricted to `["admin","compliance"]`; handler forces `organizationId: orgId ?? rawFilters.organizationId` (P0-3) so non-platform-admins only see their org. `parseFilters` uses an `allowedFields` allowlist — no arbitrary-column filter injection. The query itself is audited (line ~ logEvent 'audit_logs_query').

`services/api-ts/src/core/audit/audit-action.ts:23,50` — **[OK / by design]** Audit is **fail-OPEN**: `auditAction()` is fire-and-forget with try/catch and "never blocks the response." For HIPAA this is a deliberate availability tradeoff (a failed audit insert must not 500 a clinical read). Acceptable, but **[P2][Intra]**: there is no dead-letter / retry — a transient DB blip silently loses the audit row with only a `logger.error`. For a compliance system, route failed audit writes to a durable retry queue (e.g. reuse the email/notif outbox pattern) rather than dropping them.

`services/api-ts/src/handlers/audit/jobs/index.ts` — **[OK]** Retention cron archives >365d, purges >2555d (7yr HIPAA). `catch` rethrows so the scheduler records failure (not swallowed). Hardcoded retention windows — **[P3]** lift to config if multi-tenant retention policies diverge.

---

## jobs/  (job-board: postings + applications)

`services/api-ts/src/handlers/jobs/getJobPosting.ts`, `updateJobPosting.ts`, `deleteJobPosting.ts`, `updateJobApplication.ts` — **[P1][Intra]** Cross-org IDOR. `repos/jobs.repo.ts` `get/update/delete` are **id-only** (`.where(eq(jobPostings.id, id))`, lines 61-93) with no org predicate, and the handlers never compare `existing.organizationId` to `ctx.get('organizationId')`. `getJobPosting` is role `["user"]` → any member reads any org's posting by UUID. `update/deleteJobPosting` are `admin|staff` → an admin of org A edits/deletes org B's postings. `deleteJobPosting.ts` doesn't even read the session.
Fix: add org-scope to every by-id path.
```ts
const orgId = ctx.get('organizationId') as string;
const existing = await repo.get(postingId);
if (!existing || existing.organizationId !== orgId) return ctx.json({ error: 'Posting not found' }, 404);
```
(createJobPosting `:24` and searchJobPostings `:FIX-004` already bind to context org — only the by-id handlers regressed.)

`services/api-ts/src/handlers/jobs/createJobApplication.ts:13-30` — **[P2][Intra]** Looks up the posting by id and checks status/expiry/dupes, but never verifies `posting.organizationId === ctx.organizationId`. A member of org A applies to org B's posting (the posting is readable cross-org per the IDOR above). Application row inherits no org binding visible here.
Fix: assert posting org matches caller org before `appRepo.create`.

`updateJobApplication.ts:11-24` — **[P2][Intra]** `admin|staff` route, but no org-scope on the application and no check the application's posting belongs to the caller's org. Cross-org application mutation.

---

## Top 3 Critical (C6)

1. **`documents/createDocument.ts:51` + `downloadDocument.ts:48` — client-controlled `storageKey` → cross-tenant file exfiltration [P0/Cross].** A self-owned document can point at any bucket object UUID; the download path presigns it, bypassing storage's own owner/org checks. Validate `storageKey` resolves to a caller-owned `stored_files` row, or mint it server-side.

2. **`jobs/{get,update,delete}JobPosting.ts`, `updateJobApplication.ts`, `createJobApplication.ts` — systemic cross-org IDOR [P1/Intra].** Job-board by-id handlers + repo are id-only with no org predicate; read/edit/delete/apply across org boundaries. Add `existing.organizationId === ctx.organizationId` to every by-id path and an org predicate in the repo.

3. **`storage/getFile.ts:68` + `marketplace/updateVendor.ts:29` — missing tenant boundary on resources whose siblings enforce it [P1/Intra].** `getFile` omits the org check its three sibling handlers all have (foreign-org admin reads metadata + presigned URL); `updateVendor` omits the org check `updateListing` has (cross-org vendor edit). Copy the guard from the sibling.

### Test gaps (3)
- **Marketplace mutation authz [8/17]:** no test that a `user` cannot `fulfillOrder`/`cancelOrder` on an order they don't own/vendor; no cross-org `updateVendor`/`getVendor` IDOR test. `vendor-crud.test.ts` exists but does not assert org isolation on update.
- **Advertising authz [7/12]:** no test that `reportAd` rejects a creative from another org; no test that a non-admin cannot reach `reviewCreative` (relies entirely on untested route middleware); no org-scope assertion on `reviewCreative`/`createCampaign`.
- **Storage/documents IDOR:** `cross-tenant-idor.test.ts` covers some storage paths but **not** `getFile` metadata (the one missing the guard), and there is **no** test for the `createDocument` arbitrary-`storageKey` → `downloadDocument` exfil chain (the P0). Job-board has no cross-org IDOR test at all.
