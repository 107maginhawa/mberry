# 02 — Role & Permission Map
## Module: Documents / Certificates / Storage

---

## Documents Module (`services/api-ts/src/handlers/documents/`)

### Handler-level auth inventory

| Handler | File | Auth Check | Role Restriction | Org Scoping | Severity |
|---------|------|-----------|-----------------|-------------|----------|
| `createDocument` | createDocument.ts | `ctx.get('user')` → 401 | None — any authed user | `ctx.get('organizationId')` → 403 | P1 |
| `getDocument` | getDocument.ts | `ctx.get('session')` → UnauthorizedError | None — any authed user | None checked | P0 |
| `searchDocuments` | searchDocuments.ts | `ctx.get('session')` → UnauthorizedError | None — any authed user | `ctx.get('organizationId')` required | P1 |
| `updateDocument` | updateDocument.ts | `ctx.get('session')` → UnauthorizedError | None — any authed user | None explicit check | P1 |
| `deleteDocument` | deleteDocument.ts | `ctx.get('session')` → UnauthorizedError | None — any authed user | None explicit check | P1 |
| `archiveDocument` | archiveDocument.ts | `ctx.get('user')` → 401 | None — any authed user | None explicit check | P1 |
| `uploadNewDocumentVersion` | uploadNewDocumentVersion.ts | `ctx.get('user')` → 401 | None — any authed user | `ctx.get('organizationId')` → 403 | P1 |
| `getDocumentAccessLog` | getDocumentAccessLog.ts | `ctx.get('user')` → 401 | **No officer check** — any member | `document.organizationId` used indirectly | P0 |
| `getDocumentVersion` | getDocumentVersion.ts | `ctx.get('session')` → UnauthorizedError | None | None explicit | P1 |
| `listDocumentVersions` | listDocumentVersions.ts | `ctx.get('session')` → UnauthorizedError | None | `organizationId` queried | P2 |
| `createDocumentTag` | createDocumentTag.ts | `ctx.get('session')` → UnauthorizedError | None — any authed user | `organizationId` injected | P2 |
| `updateDocumentTag` | updateDocumentTag.ts | `ctx.get('session')` → UnauthorizedError | None | None | P2 |
| `deleteDocumentTag` | deleteDocumentTag.ts | `ctx.get('session')` → UnauthorizedError | None | None | P2 |
| `getDocumentTag` | getDocumentTag.ts | `ctx.get('session')` → UnauthorizedError | None | None | P2 |
| `listDocumentTags` | listDocumentTags.ts | `ctx.get('session')` → UnauthorizedError | None | `organizationId` filtered | P2 |

### Critical Gaps

**P0 — `getDocument` missing org-scope check**
```typescript
// getDocument.ts — no organizationId guard
const document = await repo.findOneById(params.documentId);
if (!document) throw new NotFoundError('Document');
// Returns doc regardless of org — IDOR risk if document IDs are guessable
```
Any authed user from org-A can fetch documents from org-B by guessing UUIDs.

**P0 — `getDocumentAccessLog` no officer restriction**
```typescript
// getDocumentAccessLog.ts
const user = ctx.get('user');
if (!user) return ctx.json({ error: 'Unauthorized' }, 401);
// No requirePosition / role check — any member can view all access logs
```
The M11 spec requires this endpoint be officer/admin only (audit trail is sensitive).

**P1 — `searchDocuments` passes `accessLevel` as query param — caller-controlled**
```typescript
// searchDocuments.ts
accessLevel: query.accessLevel,  // client controls this filter
```
Members can request `accessLevel=privileged` and get privileged docs if backend doesn't enforce role-based filtering. No server-side restriction applied.

**P1 — `deleteDocument`, `archiveDocument`, `updateDocument` no officer/ownership check**
Spec (M11): delete/archive require `president/admin/super`. Handlers only check `session` exists — any authed member can delete/archive any document in their org.

---

## Certificates Module (`services/api-ts/src/handlers/certificates/`)

| Handler | Auth Check | Role Restriction | Org Scoping | Severity |
|---------|-----------|-----------------|-------------|----------|
| `listCertificates` | `ctx.get('session')` | None — returns certs for session user | `session.user.id` scoped | OK |
| `getCertificate` | `ctx.get('session')` | None — no owner check | None | P1 |
| `bulkIssueCertificates` | `session` + `requirePosition([PRESIDENT, SECRETARY])` | PRESIDENT or SECRETARY only | `body.organizationId` (client-supplied) | P1 |
| `batchGenerateCertificates` | `ctx.get('user')` + `ctx.get('organizationId')` | **No position check** | `orgId` from context | P1 |
| `generateCertificatePdf` | `ctx.get('user')` → 401 | Owner only (`cert.personId !== user.id`) | None for org | P2 |
| `verifyCertificatePublic` | None (public endpoint) | Public intentionally | None (by design) | OK |

### Critical Gaps

**P1 — `getCertificate` no IDOR protection**
```typescript
// getCertificate.ts — no owner/org check
const cert = await repo.get(certId);
if (!cert) throw new NotFoundError('Certificate');
// Returns any cert by ID regardless of who's asking
```
A member can fetch any other member's certificate by guessing the UUID.

**P1 — `batchGenerateCertificates` no officer position check**
```typescript
// batchGenerateCertificates.ts
const user = ctx.get('user');
if (!user) return ctx.json({ error: 'Organization context required' }, 403);
// No requirePosition — any authed member can batch-generate certificates
```
`bulkIssueCertificates` correctly uses `requirePosition([PRESIDENT, SECRETARY])` but `batchGenerateCertificates` skips this.

**P1 — `bulkIssueCertificates` org scoped by request body, not context**
```typescript
// Uses body.organizationId instead of ctx.get('organizationId')
await db.insert(certificates).values({ organizationId: body.organizationId, ... })
```
A president of org-A could supply `organizationId` of org-B in the body and issue certificates under that org.

---

## Storage Module (`services/api-ts/src/handlers/storage/`)

| Handler | Auth Check | Role Restriction | Org Scoping | Severity |
|---------|-----------|-----------------|-------------|----------|
| `uploadFile` | `ctx.get('user')` → ValidationError | None — any authed user | `ctx.get('organizationId')` used | OK |
| `completeFileUpload` | No explicit user check | None | None | P0 |
| `getFile` | `ctx.get('user')` | Owner or admin | `organizationId` in query | OK |
| `getFileDownload` | `ctx.get('user')` | Owner or admin (`userHasRole`) | Implicit via ownership | OK |
| `deleteFile` | `ctx.get('user')` | Owner or admin | Implicit via ownership | OK |
| `listFiles` | `ctx.get('user')` | Admin sees all; user sees own | `organizationId` filter | OK |

### Critical Gap

**P0 — `completeFileUpload` missing user identity check**
```typescript
// completeFileUpload.ts (68 lines) — no user auth guard at top
const file = await repo.findOneById(fileId);
// No: const user = ctx.get('user'); if (!user) throw new UnauthorizedError();
// No ownership verification — anyone knowing the fileId can mark it complete
```
While `/storage/*` prefix routes go through `authMiddleware()` (line 255 of app.ts), the handler itself does not verify the caller owns the file being completed. A user knowing another user's upload fileId can mark it "available" prematurely.

---

## Summary Table

| Module | P0 | P1 | P2 | P3 |
|--------|----|----|----|----|
| Documents | 2 | 4 | 5 | 0 |
| Certificates | 0 | 3 | 1 | 0 |
| Storage | 1 | 0 | 0 | 0 |
| **Total** | **3** | **7** | **6** | **0** |
