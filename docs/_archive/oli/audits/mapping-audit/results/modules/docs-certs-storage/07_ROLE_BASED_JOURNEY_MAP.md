# 07 — Role-Based Journey Map
## Module: Documents / Certificates / Storage

---

## Persona Definitions

| Role | Description | Document Access | Certificate Access | Storage Access |
|------|-------------|----------------|-------------------|----------------|
| **Anonymous** | Unauthenticated visitor | None | Verify only (public endpoint) | None |
| **Member** | Authenticated org member | public + tenantOnly docs | Own certificates | None (internal only) |
| **Officer** | Elected/appointed role (President, Secretary, Treasurer) | All levels | Bulk issue (President/Secretary) | Via document upload |
| **Admin** | Platform admin | All | All | All files |

---

## Journey: Member — View & Download Documents

```
1. Sign in → /auth/sign-in
2. Navigate to /org/:orgSlug/documents
3. DocumentBrowser renders — calls searchDocuments(orgId, q=*)
4. Backend returns ALL docs for org (client filters to public+tenantOnly)
5. Member sees category tabs, search, doc cards
6. Member clicks document → /org/:orgSlug/documents/:documentId
7. Document detail renders (no download button found in frontend audit)
```

**Dead ends:**
- Step 7: Document detail page content unknown — no feature component mapped to member document detail route
- No document download action confirmed in member view
- accessLevel filtering is client-side only — API bypass exposes restricted/privileged docs

**Status: Partial — read works, download unconfirmed, security gap**

---

## Journey: Member — View Certificates

```
1. Sign in → /auth/sign-in
2. Navigate to /my/certificates
3. CertificateList renders — calls listMyCertificatesOptions with x-org-id header
4. Backend listCertificates: returns certs for session.user.id
5. Member sees certificate cards with cert number + date
6. Member clicks → /my/certificates/:certificateId
7. CertificatePreview fetches getCertificate(certId)
8. Renders cert details: number, trainingId (raw UUID), org (raw UUID), date
9. Member clicks "Download PDF"
10. generateCertificatePdf called → returns HTML content
11. Client must render HTML as PDF (unclear how this becomes downloadable PDF)
```

**Dead ends:**
- Step 9-11: PDF download is broken — endpoint returns HTML `{html: "..."}` JSON, not `application/pdf` binary
- Step 8: Raw UUIDs shown instead of human-readable names (P2 UX)
- Step 3: `enabled: !!orgId` — if orgId not set, certs never load (depends on OrgContext)

**Status: Partial — list/view works, PDF download broken**

---

## Journey: Officer — Manage Documents

```
1. Sign in as officer → /auth/sign-in
2. Navigate to /org/:orgSlug/officer/documents
3. DocumentLibrary renders — all docs for org (all access levels)
4. Officer views stat cards (total count)
5. Officer filters by status (draft/published/archived) or category
6. Officer searches by title/tag
7a. Upload: Drag file → fill title/category/accessLevel → submit
   → POST /storage/files/upload (presigned URL) 
   → PUT to S3/MinIO
   → POST /storage/files/:file/complete
   → POST /association/documents (create record)
8. Publish draft: dropdown → Publish → confirm dialog → PATCH document status=published
9. Archive: dropdown → Archive → PATCH document status=archived
10. Delete: dropdown → Delete → DELETE /association/documents/:id
```

**Dead ends:**
- Step 7: Step 7a multi-step upload flow — if `completeFileUpload` fails (no auth ownership check), document record may be created but file unavailable
- Steps 8-10: No backend role check — any authed user can call these mutations directly
- No confirmation that officer route has frontend guard (route under `_authenticated` only)

**Status: Mostly works with security gap — mutations unprotected on backend**

---

## Journey: Officer — Bulk Issue Certificates

```
1. Sign in as President or Secretary
2. (No frontend UI found for this action)
3. POST /certificates/bulk-issue directly (API-only)
4. requirePosition([PRESIDENT, SECRETARY]) checked
5. If orgId valid → certificates created for each personId
6. If >10 recipients → queued as pg-boss job (async)
7. Members receive certificates in /my/certificates
```

**Dead ends:**
- No frontend UI exists for bulk issue action — officer cannot perform this through the app
- No frontend progress/status for async job (202 queued response)

**Status: Backend complete, frontend missing**

---

## Journey: Admin — Storage File Management

```
1. Sign in as admin
2. (No frontend UI for storage files in memberry or admin app)
3. GET /storage/files — admin sees all org files
4. DELETE /storage/files/:file — admin can delete any file
```

**Dead ends:**
- No admin UI for storage file management
- Storage is backend-only — files only accessible via document download URLs

**Status: Backend complete, frontend missing**

---

## Journey: Anonymous — Verify Certificate

```
1. Receive certificate verification link (e.g., https://app/certificates/verify/CERT-2025-001)
2. Frontend: No route found for public certificate verification
3. API: GET /certificates/verify/:certificateNumber (public, no auth)
4. Returns: holderName, issuedAt, status, creditHours, isValid
```

**Dead ends:**
- No frontend verification page — the `Copy Verification Link` button exists in CertificatePreview but the URL format and destination page are unconfirmed
- No public-facing route in memberry app for `/certificates/verify/*`

**Status: Backend complete, frontend missing**

---

## Journey Summary Matrix

| Journey | Backend | Frontend | E2E Test | Overall |
|---------|---------|---------|----------|---------|
| Member view documents | Partial (IDOR risk) | Yes | Yes | Partial |
| Member view certificates | Yes | Yes | Yes | Yes |
| Member download cert PDF | Partial (returns HTML) | Partial | No | Broken |
| Officer manage documents | Partial (no RBAC) | Yes | Yes | Partial |
| Officer bulk issue certs | Yes (RBAC) | Missing | No | Incomplete |
| Officer batch generate certs | Partial (no RBAC) | No | No | Incomplete |
| Admin storage management | Yes | Missing | No | Incomplete |
| Anonymous cert verify | Yes | Missing | No | Incomplete |
