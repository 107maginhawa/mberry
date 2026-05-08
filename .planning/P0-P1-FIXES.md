# P0-P1 Remediation Roadmap

**Source**: `docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md` §13–§14
**Created**: 2026-05-08
**Status**: 18/18 complete (100%) — ALL DONE

---

## Dependency Graph

```
P0-1 (2FA encrypt) ──────────────────────┐
P0-2 (session encrypt) ─────────────────┐│
P0-3 (audit orgId) ──┐                  ││
P0-4 (email verify) ─┤                  ││
P0-5 (upload MIME) ───┤  Independent     ││ Independent
P0-6 (castVote) ──────┘  (parallel OK)  ││ (parallel OK)
                                         ││
P0-7 (multi-tenant) ────────────────────┘│ Depends on: P0-3 (audit orgId pattern)
                                          │
P1-1 (officerAuth fix) ──────────────────┤
P1-2 (internal service token) ───────────┤
P1-3 (2FA enforce privileged) ──────────┐│ Depends on: P0-1 (2FA encrypt first)
P1-4 (session invalidation) ────────────┘│ Depends on: P0-2 (session encrypt first)
P1-5 (rate limiting) ───────────────────┐│
P1-6 (audit auth events) ──────────────┐││ Depends on: P0-3 (audit orgId)
P1-7 (admin role gates) ───────────────┘││
P1-8 (email unique fix) ────────────────┘│
P1-9 (inline routes → TypeSpec) ────────┐│
P1-10 (audit + email test coverage) ───┐││ Depends on: P0-3, P1-6
P1-11 (mega-module split plan) ────────┘┘│ Depends on: P1-9 (routes stabilized)
                                          │
                                     All P0 done
```

---

## Execution Sequence

### Wave 1: P0 Security Fixes (Immediate)

These are parallelizable — no inter-dependencies within the wave.

---

#### P0-1: Encrypt 2FA Secrets

| Field | Value |
|-------|-------|
| **ID** | P0-1 |
| **Finding** | 2FA secrets stored as plaintext `text("secret")` |
| **Risk if deferred** | DB compromise = full TOTP bypass for every user |
| **Effort** | M |
| **Dependencies** | None |
| **Blocked by** | Nothing |
| **Blocks** | P1-3 (2FA enforcement) |

**Affected files**:
- `services/api-ts/src/generated/better-auth/schema.ts` — generated; schema shows `two_factor` table with `text("secret")`
- `services/api-ts/src/core/auth.ts` — Better-Auth config, 2FA plugin settings

**Implementation**:
1. Add `secret_encrypted bytea` column to two_factor table via migration
2. Encrypt with libsodium (AES-256-GCM or XChaCha20-Poly1305)
3. Encryption key via `TOTP_ENCRYPTION_KEY` env var
4. Migrate existing plaintext secrets → encrypted
5. Drop plaintext `secret` column after migration verified
6. Update auth.ts 2FA plugin to use encrypted column

**Testing strategy**:
- Unit: encryption roundtrip (encrypt → decrypt → match)
- Unit: auth with encrypted 2FA succeeds
- Unit: plaintext column no longer readable after migration
- Contract: 2FA login flow still works end-to-end

**Rollback plan**: Revert migration (keep both columns during transition). Re-add plaintext column from backup if needed. Migration should be two-phase: (1) add encrypted column, backfill; (2) separate migration to drop plaintext after verification.

---

#### P0-2: Encrypt Session Tokens

| Field | Value |
|-------|-------|
| **ID** | P0-2 |
| **Finding** | Session tokens stored as plaintext `text("token")` |
| **Risk if deferred** | DB leak = all active sessions hijacked |
| **Effort** | M |
| **Dependencies** | None |
| **Blocked by** | Nothing |
| **Blocks** | P1-4 (session invalidation) |

**Affected files**:
- `services/api-ts/src/generated/better-auth/schema.ts` — `session` table with `text("token")`
- `services/api-ts/src/core/auth.ts` — Better-Auth session adapter

**Implementation**:
1. Add `token_hash varchar(255)` column to session table
2. Hash tokens with SHA-256 before storage
3. Update session lookup to compare hash
4. Backfill existing sessions (hash existing tokens)
5. Force re-login after migration (invalidate unhashed sessions)
6. Drop plaintext `token` column

**Testing strategy**:
- Unit: session creation stores hash, not plaintext
- Unit: session verification works against hash
- Unit: old plaintext tokens rejected
- E2E: full login flow works post-migration

**Rollback plan**: Two-phase migration. Phase 1 adds hash column alongside plaintext. Phase 2 (separate migration) drops plaintext. Rollback Phase 2 only if needed — Phase 1 is backwards-compatible.

---

#### P0-3: Add organizationId to Audit Log

| Field | Value |
|-------|-------|
| **ID** | P0-3 |
| **Finding** | `audit_log_entry` table has no `organizationId` — cross-tenant audit data leakage |
| **Risk if deferred** | HIPAA compliance gap; audit data not org-scoped |
| **Effort** | S |
| **Dependencies** | None |
| **Blocked by** | Nothing |
| **Blocks** | P0-7 (multi-tenant pattern), P1-6 (audit auth events), P1-10 (audit tests) |

**Affected files**:
- `services/api-ts/src/handlers/audit/repos/audit.schema.ts` — add column + index + FK
- `services/api-ts/src/handlers/audit/repos/audit.repo.ts` — update logEvent() to capture orgId
- All callers of AuditService.logEvent() — pass orgId

**Implementation**:
1. Add `organizationId uuid` column + index + FK to audit_log_entry schema
2. Update AuditService.logEvent() to require orgId parameter
3. Update all callers to pass orgId from request context
4. Add WHERE clause filtering by orgId in audit queries

**Testing strategy**:
- Unit: logEvent() stores correct orgId
- Unit: queries filter by orgId (org A can't see org B logs)
- Contract: audit endpoints return only org-scoped data

**Rollback plan**: Column is additive. Revert migration drops the column. No data loss.

---

#### P0-4: Enforce Email Verification

| Field | Value |
|-------|-------|
| **ID** | P0-4 |
| **Finding** | `requireEmailVerification: false` in auth.ts line 79 |
| **Risk if deferred** | Identity squatting — anyone registers as `president@pda.org` |
| **Effort** | S |
| **Dependencies** | None |
| **Blocked by** | Nothing |
| **Blocks** | Nothing |

**Affected files**:
- `services/api-ts/src/core/auth.ts` — flip `requireEmailVerification` to `true`

**Implementation**:
1. Set `requireEmailVerification: true` in auth config
2. Verify email template generation works (check existing email handler)
3. Add redirect for unverified users to verification page
4. Handle edge case: existing unverified users

**Testing strategy**:
- Unit: unverified user blocked from protected endpoints (403)
- Unit: verification email sent on registration
- E2E: full registration → verify → access flow

**Rollback plan**: Single config flip back to `false`. Zero migration needed.

---

#### P0-5: Validate uploadFile MIME Types

| Field | Value |
|-------|-------|
| **ID** | P0-5 |
| **Finding** | No MIME allowlist, no filename sanitization in uploadFile |
| **Risk if deferred** | Path traversal, MIME spoofing, stored XSS via uploaded files |
| **Effort** | S |
| **Dependencies** | None |
| **Blocked by** | Nothing |
| **Blocks** | Nothing |

**Affected files**:
- `services/api-ts/src/handlers/storage/uploadFile.ts` — add MIME allowlist + filename sanitization

**Implementation**:
1. Define MIME allowlist (images, PDFs, common docs)
2. Validate content-type against allowlist before storage
3. Sanitize filenames (strip path separators, null bytes, double extensions)
4. Add file size limit enforcement
5. Return 400 with clear error for rejected files

**Testing strategy**:
- Unit: allowed MIME types accepted
- Unit: disallowed MIME types rejected (e.g., `text/html`, `application/x-executable`)
- Unit: malicious filenames sanitized (`../../etc/passwd` → `etcpasswd`)
- Unit: double extensions blocked (`file.jpg.exe`)

**Rollback plan**: Revert the handler file. No schema changes involved.

---

#### P0-6: Validate castVote Input

| Field | Value |
|-------|-------|
| **ID** | P0-6 |
| **Finding** | `ctx.req.json()` accepts raw JSON with no schema validation |
| **Risk if deferred** | Vote injection with spoofed UUIDs, election corruption |
| **Effort** | S |
| **Dependencies** | None |
| **Blocked by** | Nothing |
| **Blocks** | Nothing |

**Affected files**:
- `services/api-ts/src/handlers/elections/castVote.ts` — add Zod schema + zValidator

**Implementation**:
1. Define Zod schema for vote payload (electionId, candidateId as UUID, etc.)
2. Replace `ctx.req.json()` with `zValidator('json', voteSchema)`
3. Add UUID format validation
4. Add duplicate vote check (one vote per person per election)

**Testing strategy**:
- Unit: valid vote accepted
- Unit: invalid UUIDs rejected (400)
- Unit: missing fields rejected (400)
- Unit: extra/unexpected fields stripped
- Contract: election vote flow with validation

**Rollback plan**: Revert handler file. No schema changes.

---

#### P0-7: Multi-Tenant Table Scoping (26/72 Tables)

| Field | Value |
|-------|-------|
| **ID** | P0-7 |
| **Finding** | 36% of tables (26/72) lack `organizationId` column |
| **Risk if deferred** | Fundamental multi-tenant data leakage across organizations |
| **Effort** | L |
| **Dependencies** | P0-3 (audit orgId establishes the pattern) |
| **Blocked by** | P0-3 |
| **Blocks** | Nothing directly, but foundational for all org-scoped features |

**Affected files**:
- Multiple schema files across `services/api-ts/src/handlers/*/repos/*.schema.ts`
- Corresponding repo files for query updates
- Full inventory in `docs/MULTI-TENANT-AUDIT.md` (Gate 5 deliverable)

**Implementation**:
1. Complete Gate 5 (MULTI-TENANT-AUDIT.md) — categorize all 26 unscoped tables
2. For each "needs org_id" table: add column + index + FK via migration
3. Update all queries to include org_id WHERE clause
4. Add org_id to all INSERT operations from request context
5. Backfill existing rows (assign to correct org from related data)
6. Phase this — batch by module, not all at once

**Testing strategy**:
- Unit per table: insert with orgId, query filtered by orgId
- Unit: cross-org query returns empty (isolation test)
- Contract: API endpoints return only org-scoped data
- E2E: multi-org user sees correct data per org

**Rollback plan**: Each table migration is independent. Revert per-table if needed. Backfill data preserved (column additive, not destructive).

---

### Wave 2: P1 Auth & RBAC Hardening

Start after P0-1 through P0-6 complete. P0-7 can run in parallel with Wave 2.

---

#### P1-1: Fix officerAuth Silent Skip Bug

| Field | Value |
|-------|-------|
| **ID** | P1-1 |
| **Finding** | officerAuth silently skips check when route lacks `:orgId` param |
| **Risk if deferred** | Officer-level checks bypassed on misconfigured routes |
| **Effort** | S |
| **Dependencies** | None within wave |
| **Blocked by** | Nothing |
| **Blocks** | Nothing |

**Affected files**:
- `services/api-ts/src/middleware/officer-auth.ts` — throw 400 instead of skip
- `services/api-ts/src/utils/officer-check.ts` — related utility
- Routes using officerAuth: `services/api-ts/src/handlers/{communications,dues,elections,events,membership,training}/index.ts`

**Implementation**:
1. Change officerAuth to throw `400 "Missing organization context"` when `:orgId` absent
2. Audit all routes using officerAuth — ensure `:orgId` is in path
3. Fix any routes missing `:orgId` parameter

**Testing strategy**:
- Unit: request without orgId → 400 (not silent pass)
- Unit: request with valid orgId → normal officer check
- Contract: all officer-gated endpoints require orgId

**Rollback plan**: Revert middleware file. Risk: reverts to silent skip (worse behavior).

---

#### P1-2: Secure Internal Service Token

| Field | Value |
|-------|-------|
| **ID** | P1-2 |
| **Finding** | Internal service bypass token is untyped, no rotation, no expiry |
| **Risk if deferred** | Leaked token = permanent unauthenticated access |
| **Effort** | M |
| **Dependencies** | None |
| **Blocked by** | Nothing |
| **Blocks** | Nothing |

**Affected files**:
- `services/api-ts/src/middleware/auth.ts` — internal token check
- `services/api-ts/src/middleware/dependency.ts` — token injection
- `services/api-ts/src/app.ts` — token reference
- `services/api-ts/src/types/app.ts` — type definitions
- `services/api-ts/src/utils/expand.ts` — token usage

**Implementation**:
1. Type the internal service token properly
2. Add token rotation support (accept current + previous token)
3. Add expiry mechanism
4. Hash stored token value
5. Log internal token usage to audit trail

**Testing strategy**:
- Unit: valid token accepted
- Unit: expired token rejected
- Unit: rotated (old) token accepted during grace period
- Unit: unknown token rejected
- Unit: internal token usage logged

**Rollback plan**: Revert to single untyped token. Keep new typed interface for forward compatibility.

---

#### P1-3: Enforce 2FA for Privileged Roles

| Field | Value |
|-------|-------|
| **ID** | P1-3 |
| **Finding** | No 2FA enforcement for admin/treasurer/president roles |
| **Risk if deferred** | Single-factor auth for highest-privilege accounts |
| **Effort** | S |
| **Dependencies** | P0-1 (2FA must be encrypted first) |
| **Blocked by** | P0-1 |
| **Blocks** | Nothing |

**Affected files**:
- `services/api-ts/src/middleware/officer-auth.ts` — add 2FA check for privileged roles
- `services/api-ts/src/core/auth.ts` — 2FA enforcement config

**Implementation**:
1. Define privileged roles list (admin, treasurer, president, secretary)
2. Add 2FA status check in officerAuthMiddleware for privileged roles
3. Return 403 with "2FA required" message if not enrolled
4. Add grace period for existing users to set up 2FA

**Testing strategy**:
- Unit: admin without 2FA → 403
- Unit: admin with 2FA → pass
- Unit: non-privileged role without 2FA → pass (not enforced)

**Rollback plan**: Remove 2FA check from middleware. Users keep their 2FA setup.

---

#### P1-4: Session Invalidation on Role Change

| Field | Value |
|-------|-------|
| **ID** | P1-4 |
| **Finding** | No session invalidation when org role changes |
| **Risk if deferred** | Removed officer retains access until session expires |
| **Effort** | S |
| **Dependencies** | P0-2 (session tokens must be hashed first) |
| **Blocked by** | P0-2 |
| **Blocks** | Nothing |

**Affected files**:
- Officer role update handlers in `services/api-ts/src/handlers/association:member/` (updateOfficerTerm.ts, etc.)
- `services/api-ts/src/core/auth.ts` — `auth.invalidateUserSessions()` API

**Implementation**:
1. After any role change (grant/revoke), call `auth.invalidateUserSessions(userId)`
2. Add to: updateOfficerTerm, deletePosition, terminateMembership handlers
3. User forced to re-login with new permissions

**Testing strategy**:
- Unit: old session token rejected after role change
- Unit: new login gets fresh session with updated role
- E2E: remove officer → old session invalid → re-login required

**Rollback plan**: Remove invalidation calls. Sessions continue until natural expiry.

---

#### P1-5: Rate Limit Non-Auth Endpoints

| Field | Value |
|-------|-------|
| **ID** | P1-5 |
| **Finding** | Rate limiting only on Better-Auth routes — custom endpoints unprotected |
| **Risk if deferred** | Brute-force attacks on custom endpoints (elections, dues, etc.) |
| **Effort** | M |
| **Dependencies** | None |
| **Blocked by** | Nothing |
| **Blocks** | Nothing |

**Affected files**:
- `services/api-ts/src/app.ts` — add global rate limiter middleware
- New: rate limiter middleware file (or extend existing auth middleware)

**Implementation**:
1. Add generic rate limiter middleware (e.g., `hono-rate-limiter` or custom)
2. Configure per-route limits: stricter for write ops, relaxed for reads
3. Apply globally with per-route overrides
4. Return 429 with Retry-After header

**Testing strategy**:
- Unit: requests exceeding limit → 429
- Unit: requests within limit → pass
- Unit: different endpoints have different limits
- Load: verify limits hold under concurrent requests

**Rollback plan**: Remove middleware registration from app.ts. Zero schema impact.

---

#### P1-6: Audit-Log Auth Events

| Field | Value |
|-------|-------|
| **ID** | P1-6 |
| **Finding** | Login/logout/2FA events not in audit trail |
| **Risk if deferred** | No forensic trail for authentication events (HIPAA gap) |
| **Effort** | S |
| **Dependencies** | P0-3 (audit log needs orgId column first) |
| **Blocked by** | P0-3 |
| **Blocks** | P1-10 (audit test coverage) |

**Affected files**:
- `services/api-ts/src/core/auth.ts` — add hooks in `createAuth()` for login/logout/2FA events

**Implementation**:
1. Add `onLogin`, `onLogout`, `on2FAVerify` hooks in auth config
2. Each hook calls AuditService.logEvent() with event type + user + orgId
3. Log: successful login, failed login, logout, 2FA setup, 2FA verify

**Testing strategy**:
- Unit: login triggers audit log entry
- Unit: failed login triggers audit log entry with failure reason
- Unit: logout triggers audit log entry
- Unit: 2FA events logged

**Rollback plan**: Remove hooks from auth config. Audit log entries remain (additive).

---

#### P1-7: Admin App Role Gates

| Field | Value |
|-------|-------|
| **ID** | P1-7 |
| **Finding** | Admin app has no role-based access gates — all admins = full access |
| **Risk if deferred** | Any admin can impersonate, view audit logs, manage all orgs |
| **Effort** | M |
| **Dependencies** | None |
| **Blocked by** | Nothing |
| **Blocks** | Nothing |

**Affected files**:
- `apps/admin/src/routes/__root.tsx` — add auth guard
- `apps/admin/src/routes/impersonate/index.tsx` — restrict to super-admin
- `apps/admin/src/routes/audit/index.tsx` — restrict to compliance role
- `apps/admin/src/routes/organizations/*.tsx` — restrict by org scope
- Backend: `services/api-ts/src/app.ts` line ~452 (`/admin/me/role`) — needs proper role response

**Implementation**:
1. Define admin role tiers (super-admin, org-admin, read-only)
2. Add role check in admin app root layout
3. Gate sensitive routes (impersonate, audit) behind super-admin
4. Backend: return proper role object from `/admin/me/role`

**Testing strategy**:
- E2E: non-super-admin cannot access impersonate page
- E2E: read-only admin cannot modify organizations
- Unit: role check middleware returns correct permissions

**Rollback plan**: Remove route guards. Reverts to current (all-access) behavior.

---

#### P1-8: ~~Fix user.email Global Unique Constraint~~ — WON'T FIX (False Positive)

| Field | Value |
|-------|-------|
| **ID** | P1-8 |
| **Finding** | `user.email` has global unique constraint — blocks multi-org membership |
| **Status** | **WON'T FIX** — confirmed false positive by Claude + Codex cross-model review |
| **Resolution** | The `user` table is an identity table (like GitHub/Slack). One account per email is the correct design per BR-21: "One member equals one platform account." Multi-org membership is handled by the `membership` table linking one person to many orgs via `(organizationId, personId)`. Removing the unique constraint would break the intended architecture. |

**Cross-model review (2026-05-08)**:
Both Claude and Codex independently verified this is a false positive. The audit's recommended fix (org-scoped email uniqueness) would push toward per-org identities, conflicting with BR-21 and the documented onboarding flow.

**Real issues found nearby** (new tickets needed):
1. **Invite claim identity gap** — `claimInvite.ts` accepts any authenticated user without verifying session user matches `invite.email`/`invite.personId`, and doesn't create the membership record
2. **Missing DB uniqueness constraint** — BR-21 test asserts `unique(organizationId, personId)` but schema only has a non-unique `index`. Duplicate prevention is app-side only
3. **BR-21 test accuracy** — Tests assert constraints that don't exist in the schema

---

#### P1-9: Migrate Inline app.ts Routes to TypeSpec

| Field | Value |
|-------|-------|
| **ID** | P1-9 |
| **Finding** | 22+ inline routes in app.ts bypass TypeSpec — no validators, not regeneratable |
| **Risk if deferred** | No input validation on inline routes; drift from spec |
| **Effort** | L |
| **Dependencies** | None |
| **Blocked by** | Nothing |
| **Blocks** | P1-11 (mega-module split needs stable route inventory) |

**Affected files**:
- `services/api-ts/src/app.ts` — 22+ inline route definitions (lines 109–452+)
- New TypeSpec files in `specs/api/src/modules/` for each migrated group
- Generated handlers in `services/api-ts/src/handlers/`

**Implementation**:
1. Inventory all inline routes (currently 22+ in app.ts)
2. Group by domain (person/me, credits, membership, dues, admin, privacy, notifications)
3. Create TypeSpec definitions for each group
4. Generate routes/validators/handler stubs
5. Move business logic from inline handlers to generated handler files
6. Remove inline routes from app.ts
7. Verify OpenAPI spec includes new routes

**Testing strategy**:
- Contract: every migrated route has same request/response shape
- Unit: validators reject invalid input (previously unvalidated)
- E2E: all affected frontend flows still work

**Rollback plan**: Keep inline routes alongside TypeSpec routes during migration (dual-registration). Remove inline only after TypeSpec version verified.

---

#### P1-10: Audit + Email Module Test Coverage

| Field | Value |
|-------|-------|
| **ID** | P1-10 |
| **Finding** | Audit module: 0 tests. Email module: 1 test for 9 handlers. |
| **Risk if deferred** | Compliance-critical modules have no regression safety net |
| **Effort** | M |
| **Dependencies** | P0-3 (audit orgId), P1-6 (audit auth events) |
| **Blocked by** | P0-3, P1-6 |
| **Blocks** | Nothing |

**Affected files**:
- New: `services/api-ts/src/handlers/audit/*.test.ts`
- Existing: `services/api-ts/src/handlers/email/*.test.ts` — expand coverage

**Implementation**:
1. Audit module: org scoping tests, pagination, filter, permission checks
2. Email module: queue processing, retry logic, template rendering, error handling
3. Target: 80%+ coverage for both modules

**Testing strategy**:
- Self-referential — this IS the testing task
- Verify with `bun test --coverage` for both modules

**Rollback plan**: Tests are additive. No rollback needed.

---

#### P1-11: association:member Mega-Module Split Plan

| Field | Value |
|-------|-------|
| **ID** | P1-11 |
| **Finding** | 171 handlers in one module — unmaintainable, high coupling |
| **Risk if deferred** | Merge conflicts, testing difficulty, cognitive overload |
| **Effort** | L (planning only in this phase; execution is separate) |
| **Dependencies** | P1-9 (routes stabilized first) |
| **Blocked by** | P1-9 |
| **Blocks** | Nothing (execution is future work) |

**Affected files**:
- `services/api-ts/src/handlers/association:member/` — 100+ handler files, 14+ test files
- Associated repos: `services/api-ts/src/handlers/association:member/repos/` (7 schema files, 7 repo files)

**Implementation** (planning deliverable):
1. Analyze handler groupings by domain (membership, chapters, officers, positions, credentials, dues, credits, governance, directory)
2. Map dependencies between groups
3. Propose split into 5-7 sub-modules
4. Document migration path (route changes, import updates, test moves)
5. Estimate effort per sub-module extraction

**Testing strategy**:
- N/A for planning phase
- Execution phase: existing tests must pass after each sub-module extraction

**Rollback plan**: Planning doc only — nothing to roll back.

---

## Summary Table

| ID | Finding | Wave | Effort | Depends On | Blocks | Status |
|----|---------|------|--------|------------|--------|--------|
| P0-1 | 2FA secrets plaintext | 1 | M | — | P1-3 | DONE |
| P0-2 | Session tokens plaintext | 1 | M | — | P1-4 | DONE |
| P0-3 | Audit log no orgId | 1 | S | — | P0-7, P1-6, P1-10 | DONE |
| P0-4 | Email verification disabled | 1 | S | — | — | DONE |
| P0-5 | uploadFile no MIME check | 1 | S | — | — | DONE |
| P0-6 | castVote no validation | 1 | S | — | — | DONE |
| P0-7 | 26/72 tables not org-scoped | 1 | L | P0-3 | — | DONE (10 tables scoped) |
| P1-1 | officerAuth silent skip | 2 | S | — | — | DONE (7f6ae9f) |
| P1-2 | Internal service token unsecured | 2 | M | — | — | DONE (099081e) |
| P1-3 | 2FA not enforced for admins | 2 | S | P0-1 | — | DONE (5a4d00e) |
| P1-4 | No session invalidation on role change | 2 | S | P0-2 | — | DONE (7f6ae9f) |
| P1-5 | Rate limiting only on auth routes | 2 | M | — | — | DONE (5a4d00e) |
| P1-6 | Auth events not in audit trail | 2 | S | P0-3 | P1-10 | DONE (7f6ae9f) |
| P1-7 | Admin app no role gates | 2 | M | — | — | DONE (5f735e7) |
| P1-8 | user.email unique globally | 2 | M | — | — | WON'T FIX (false positive) |
| P1-9 | 22+ inline routes bypass TypeSpec | 2 | L | — | P1-11 | DONE |
| P1-10 | Audit + email zero test coverage | 2 | M | P0-3, P1-6 | — | DONE (00140cf) |
| P1-11 | Mega-module split plan | 2 | L | P1-9 | — | DONE |

**Effort key**: S = 1-2 hours, M = 3-6 hours, L = 1-3 days

---

## Execution Order (Recommended)

### Phase A — Parallel P0 batch (Wave 1)
Execute P0-1 through P0-6 in parallel (no inter-dependencies).
Start P0-7 after P0-3 completes.

### Phase B — Auth hardening (Wave 2, first half)
After all P0 complete:
- P1-1 (officerAuth fix) — independent
- P1-2 (internal token) — independent
- P1-3 (2FA enforce) — after P0-1
- P1-4 (session invalidation) — after P0-2
- P1-5 (rate limiting) — independent

### Phase C — Audit & structural (Wave 2, second half)
After Phase B:
- P1-6 (audit auth events) — after P0-3
- P1-7 (admin role gates) — independent
- P1-8 (email unique fix) — independent
- P1-9 (inline routes → TypeSpec) — independent
- P1-10 (test coverage) — after P0-3 + P1-6
- P1-11 (mega-module split plan) — after P1-9

---

## Cross-Cutting Notes

1. **Test-first**: Every fix follows VERTICAL_TDD.md — write failing test, implement fix, verify green
2. **No feature work**: Gate in CLAUDE.md blocks new features until P0/P1 ≥50% complete
3. **One fix per commit**: Clean git history, easy bisect/revert
4. **Contract tests**: Update Hurl contract suite for any endpoint behavior changes
5. **Better-Auth generated files**: P0-1 and P0-2 affect generated schema — may need custom adapter hooks rather than direct schema edits
