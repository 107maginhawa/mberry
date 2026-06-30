# 014 — Certificate of Good Standing (Slice 4)

> **STATUS: DEFERRED (2026-06-30).** Decision: the verifiable CGS needs additive engine work
> (new table + 2 endpoints + migration) for a feature that is NOT the money wedge. Lean call —
> defer until a real credentialing desk rejects an unverified printout (pulled demand). This plan
> is the ready-to-execute blueprint for that day. Build sequence jumps to Slice 5 (event detail).
>
> Slice 4 of the `apps/org` membership-management build.
> Design source of truth: [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md)
> §"Certificate of Good Standing — VERDICT: KEEP" + Round-2 #5 (must be shareable).
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> **Classification: NET-NEW (engine-touching, ADDITIVE).** User approved the engine-backed
> verifiable path (2026-06-30). Runs the FULL vertical-slice chain.

## Why this is net-new (recon ground truth)

The existing certificate system is **training-coupled** (`certificates.trainingId`, types
`attendance/completion/speaker`) with **server-hardcoded PDF wording** and **no `good-standing`
type**. Good-standing is **not** an engine concept (it's FE-derived today). A real,
QR-verifiable CGS therefore needs a small additive engine vertical. The lean cut: **issue +
verify are data-only endpoints; the PDF is the browser print of the FE-rendered card** — no
server PDF (`pdf-lib`), no touching the training-cert handler.

## Engine design — NEW ISOLATED VERTICAL (safest additive; **confirm before building**)

**Do NOT extend the frozen `certificates` table / `bulkIssueCertificates` handler** (risk to the
training-cert contract). Instead add a self-contained vertical:

- **New table `good_standing_certificate`** (additive migration, brand-new table — no ALTER of
  existing tables): `id, organizationId, personId, certificateNumber, verificationCode,
  memberName, memberNumber, issuedAt, issuedBy, validUntil, status ('valid'|'revoked'),
  createdAt/updatedAt`. `certificateNumber` = org-scoped human id (e.g. `CGS-2026-0042`);
  `verificationCode` = HMAC(certificateNumber, secret) (constant-time compare on verify).
- **Repo** + Zod schemas per domain conventions.
- **TypeSpec ops** (`specs/api/src`, with `@extension` audit/officer as conventional):
  - `POST /association/member/good-standing-certificates` (officer-gated) → issue.
  - `GET /association/member/good-standing-certificates/{certificateNumber}/verify` (PUBLIC,
    `code` query) → `{ valid, status, memberName, memberNumber, orgName, issuedAt, validUntil }`.
- **Handlers:** `issueGoodStandingCertificate` — **server-enforces good standing** (active
  membership + zero outstanding invoices via the existing membership + dues repos; 422 if not),
  snapshots member name/number, computes `validUntil` (= membership `duesExpiryDate`, else +1y),
  signs, inserts. `verifyGoodStandingCertificatePublic` — constant-time code check → status.
- **No domain-event fan-out needed** (self-contained). **No money movement.**

## Business rules (`/br-extract` → br-registry)

- **BR-CGS-1:** issue requires `membership.status='active'` AND zero outstanding invoices
  (`{generated,sent,overdue}`). Else 422 `member_not_in_good_standing`.
- **BR-CGS-2:** `validUntil = duesExpiryDate ?? issuedAt + 1y`.
- **BR-CGS-3:** public verify compares `verificationCode` in constant time; `revoked`/unknown →
  `valid:false`. Re-issue creates a NEW cert; prior certs stay verifiable until `validUntil`.
- **BR-CGS-4:** officer position gate (match the roster gate: SECRETARY/PRESIDENT/SOCIETY_OFFICER;
  confirm against existing `requirePosition` usage).

## Full chain (plans/000 §b net-new) — vertical, never horizontal

`/br-extract` → `/typespec` → `cd specs/api && bun run build` → `cd services/api-ts && bun run
generate` → **RED real-PG integration test first** (`createScratch`: issue happy path; issue
422 when not good-standing; verify valid; verify bad-code → invalid; revoked) → `/handler`
(GREEN) → `/db-migrate` (new-table migration; reference `docs/security/MIGRATION_SAFETY_CHECKLIST.md`
in the PR) → `/test-api` → regen SDK (`bun run --filter @monobase/sdk-ts generate`) →
`/contract-scaffold` → `/test-contract` (Hurl: issue + verify + 422) → `/frontend-design` →
E2E real-flow → `/module-review` → requesting-code-review → `/pre-commit` → `/commit`.

## Frontend (member detail → certificate)

- New action on member detail: **"Certificate of Good Standing"** — enabled only when the FE
  good-standing pre-check passes (status active + `useMemberOutstanding.openCount===0`); else
  disabled with a plain reason ("Member owes dues — settle before issuing"). Server re-checks (422
  surfaced friendly).
- Issue → render a **CGS card** (new route `/members/$membershipId/certificate` or a dialog):
  org **name + logo** (`getOrganizationProfile`, graceful when `logoUrl` absent → name-only
  letterhead), member name + number, "in good standing as of {issuedAt}", "valid until
  {validUntil}", `certificateNumber`, and a **QR** (`qrcode.react`) encoding the public verify
  URL. **Print / Save PDF** via `window.print()` + a print stylesheet (no PDF lib).
- **Public verify route** (login-free, under the existing public `/pay`-style no-auth guard):
  `/verify/cgs/$certificateNumber?code=` → calls the public verify endpoint → shows authentic /
  invalid / expired with the member + org + dates. Honest states.

## Dependencies / locks

- **Add `qrcode.react` to `apps/org`** (already in `apps/member` — in-repo, not new to the
  monorepo; flagged per the dependency lock). Reuse the `apps/member` IdCardView QR pattern.
- Engine FROZEN-safe: **new table + new handlers only**, zero ALTER of existing tables, zero edit
  to existing handlers. Migration adds a table (no `DELETE`). Never edit generated files.
- Spec-first: TypeSpec is the source of truth; regen SDK or CI git-diff gate fails.
- Drift guard: anchor FE mocks to the new handler shapes + typecheck tests.

## Verification (step d)

Engine: `cd services/api-ts && bun test` (new real-PG suite GREEN; existing suites untouched +
GREEN); `bun run test:contract` (new Hurl). FE: `bun dev`; member-detail → issue CGS for a
good-standing member → card + QR renders → print produces a clean PDF; try a member who owes →
button disabled + server 422 friendly; scan/open the verify URL → authentic; tamper the code →
invalid. Gates: contract suite, migration-safety, br-coverage (+BR-CGS-1..4), coverage-matrix,
lint:no-skips/shallow, SDK git-diff. Existing engine byte-safe (new files only).

## Out of scope (named)

Server-rendered PDF (`pdf-lib`), email delivery, cert revocation UI (status field exists; officer
revoke UI = v1.x), bulk-issue CGS, editable wording/template (locked: fixed standard wording).
