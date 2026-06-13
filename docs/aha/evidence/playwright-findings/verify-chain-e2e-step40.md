# Verify-chain E2E — AHA Step 40 (documents-credentials Batch A closeout)

Date: 2026-06-13
Tooling: gstack `/browse` (headless Chromium) against the live dev stack
(API on :7213, memberry app on :3004). Resolves **Q2** (which `/verify` shape
wins) — now confirmed live via the collapsed `/verify/$id` dispatch
(`apps/memberry/src/routes/verify/verify-dispatch.ts` → `resolveVerifyKind`).

## Result: all three id-shapes dispatch to the CORRECT verifier — no route shadowing

| # | URL hit | `resolveVerifyKind` | Verifier body rendered | Backend public-verify result |
| --- | --- | --- | --- | --- |
| 1 | `/verify/PDA-MM-2025-1000` (real credential number) | `credentialNumber` | **Valid** — Dr. Maria Santos, DMD; Orthodontics; status active; Issued Feb 21 2026 / Expires Feb 21 2027; FIX-014 staleness note shown | credential public verify → Valid |
| 2 | `/verify/CERT-2025-0005` (real certificate number) | `certificate` | **REVOKED** — distinct certificate body (Issued Apr 22 2026, status Revoked) | `verifyCertificatePublic` → Revoked |
| 3 | `/verify/abc.def` (token-shaped id, single dot) | `token` | **Verification Failed** — distinct token body (invalid/tampered) | credential token verify → invalid (expected; synthetic token) |

Key proof points:
- Each id-shape resolved to a **different** verifier body (Valid credential vs
  Revoked certificate vs Failed token). Pre-FIX-002 only one sibling route was
  ever reachable; the collapsed `$id` dispatch now reaches all three.
- The certificate case returns **REVOKED**, not "not found" and not the credential
  body — proving the certificate branch is live (no credential-route shadowing).
- The token-shaped id routes to the token verifier (not credentialNumber), proving
  `TOKEN_RE` (dot) wins over the `credentialNumber` fallback.
- Backend public-verify endpoints returned real status (Valid / Revoked / invalid),
  confirming the page-to-API chain is wired end-to-end.

## Screenshots
- `docs/aha/evidence/screenshots/verify-credential.png`
- `docs/aha/evidence/screenshots/verify-certificate.png`
- `docs/aha/evidence/screenshots/verify-token.png`

## Cross-check: unit coverage
`apps/memberry/src/routes/verify/verify-dispatch.test.ts` — 8 pass, covering the
same credential/certificate/token shape resolution deterministically.
