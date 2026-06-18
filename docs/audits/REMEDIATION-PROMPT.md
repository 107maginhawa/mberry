# Remediation Execution Prompt — Memberry Security + Hardening

Paste the block below into a fresh Claude Code session at repo root. It drives the
7 todos from the 2026-06-16 audit systematically: TDD per fix, atomic commits,
suite-verified, P0 → P1 → coverage-lock → deferred.

---

```
/using-superpowers

Execute the remediation worklist in the task list (TaskList) in priority order.
Work on a single branch `fix/audit-remediation-2026-06`. Use test-driven-development
for every code fix: write the failing test FIRST, watch it fail, then fix, then watch
it pass. One atomic commit per task. Do NOT batch unrelated fixes into one commit.

Ground rules:
- Backend: services/api-ts. Run `bun test <file>` after each change; run the FULL
  `bun test` before every commit — the suite is green at 7292 pass / 0 fail and must
  stay green.
- Follow the codebase test convention exactly: `makeCtx` + `stubRepo` + `restoreRepo`
  from '@/test-utils/make-ctx', with `afterEach(() => restoreRepo(Repo))` for every
  stubbed repo. NO real DB. See existing handler tests for the pattern.
- NEVER edit generated files (src/generated/**). NEVER delete handler files to fix types.
- After each task: mark it completed via TaskUpdate, commit, move to the next.
- If a fix needs a TypeSpec/route change, regenerate per CLAUDE.md, don't hand-edit.

Execute in this order:

### P0-1 — Storage cross-tenant IDOR  (task: "Fix storage cross-tenant IDOR")
Files: src/handlers/storage/{completeFileUpload,getFileDownload,deleteFile}.ts
Each checks owner/admin but not org. Add, after the repo `findOneById(fileId)`:
`if (file.organizationId !== ctx.get('organizationId')) throw new ForbiddenError(...)`
(use the codebase's ForbiddenError + whatever super-admin escape hatch listFiles.ts uses,
if any — match siblings). TDD: test that an admin in org B gets 403 against an org A file.

### P0-2 — Null-user bypass  (task: "Fix null-user auth bypass in completeFileUpload")
File: src/handlers/storage/completeFileUpload.ts
Replace the `if (user && ...)` guard with an explicit `if (!user) throw new UnauthorizedError()`
at the top, then the owner/admin/org check. TDD: unauth request → 401.

### P0-3 — CORS defaults  (task: "Tighten CORS defaults + fail-fast in prod")
File: src/core/config.ts (~line 142)
Flip CORS_ALLOW_TUNNELING and CORS_ALLOW_LOCAL_NETWORK defaults true → false.
Add startup throw (not warn) when either is true AND NODE_ENV==='production'.
TDD: config-parse test asserting prod + tunneling=true throws; default is false.

### P1-1 — Dead identity-matching stub  (task: "Fix dead findIdentityMatches stub")
File: src/utils/identity-matching.ts:44-80
findIdentityMatches returns [] unconditionally; real query commented out. Decide with
evidence: if the feature is wired to callers, restore the implementation (test it against
the mock db); if genuinely deferred, make it throw a clear NotImplemented and document at
the call sites so it can't silently return []. Grep callers first.

### P1-2 — Secrets through validated config  (task: "Route secrets through validated config")
- invite handlers (createInvite/validateInvite/claimInvite/bulkImportMembers): replace
  `process.env['INVITE_TOKEN_SECRET'] || 'dev-secret-change-in-production'` with the
  validated config value; remove the literal fallback.
- email/utils/unsub-token.ts: same for UNSUBSCRIBE_SECRET.
- Add PAYMONGO_SECRET_KEY + PAYMONGO_WEBHOOK_SECRET to config.ts schema with
  prod-required validation; thread into handlePaymentWebhook.ts.
- config.ts:174,317 — fail-fast (throw) on default storage creds (minioadmin) and default
  DATABASE_URL password when NODE_ENV==='production'.
TDD: prod-required branches throw when secret missing/default; non-prod still boots.

### COVERAGE-LOCK  (task: "Lock in coverage gains in CI gate")
File: services/api-ts/.coverage-thresholds.json
Add per-module line floors (set each ~5pts below current measured to avoid flakiness):
member/membership, member/chapters, member/governance, member/duesspecialassessments,
association:operations, surveys, member/credentials. Do NOT touch the global default
(schema files are 0%-func by design). Run `bun run test:coverage:gate` from repo root →
must pass. Commit.

### DEFERRED — Repo test harness  (task: "Postgres-backed repo test harness")
Do NOT implement now. Instead write a short plan doc at docs/audits/REPO-HARNESS-PLAN.md:
getTestDb() against postgres :5432, per-test isolation (txn rollback or schema-per-worker),
migration bootstrap, target repos (payment-token.repo ~10%, dashboard/survey/committee
repos). Leave the task open. Stop and report.

When all non-deferred tasks are committed and the full suite + coverage gate are green,
summarize the diff and propose a single PR. Do not push or open the PR without confirmation.
```

---

## Context the executor inherits
- Branch state: green suite, 7292 pass / 0 fail, 90.13% line coverage.
- Audit report: docs/audits/CODEBASE_AUDIT_2026-06-16.md (full findings + file:line refs).
- Booking flake already fixed; 7 test files already hardened against mock.module leaks.
