# Certificates — Scope (decomposition step 1)

**Date:** 2026-06-07
**Branch baseline:** `feature/member-rebuild` @ `339b9051` (post-REMAINING_SCOPE re-baseline)
**Sub-domain:** certificates
**Target tag:** `Member/Certificates`
**Tag-on-completion:** `member-certificates-cutover`
**Classification:** FULL migration with consolidation (not a plain R-pattern — current state is split across two dirs + has 1-line shims + 1 route dup + 1 orphan handler)

---

## §1 — Why this isn't a vanilla R-pattern

The R-series pattern (R1 chapters → R4 directory) was: tsp retag → wipe → regenerate → restore from baseline → fix imports. Worked because all generated handlers lived in a single source dir (`handlers/association:member/`) and the new dir (`handlers/member/<sub>/`) was empty.

Certificates is different. Current state:

| Location | Files | Role |
| --- | --- | --- |
| `handlers/certificates/` | `bulkIssueCertificates.ts` (75 LOC, real), `verifyCertificatePublic.ts` (34 LOC, real), `generateCertificatePdf.ts` (98 LOC, real, hand-wired), `listCertificates.ts` (15 LOC, **orphan**) + tests, `repos/certificates.{repo,schema,repo.test}.ts`, `utils/certificate-{numbering,qr,template}.ts` + tests | **canonical for 3 of 5 generated handlers** + 1 orphan; owns repos + utils |
| `handlers/association:member/bulkIssueCertificates.ts` | 1 LOC | re-export shim → `handlers/certificates/bulkIssueCertificates` |
| `handlers/association:member/verifyCertificatePublic.ts` | 1 LOC | re-export shim → `handlers/certificates/verifyCertificatePublic` |
| `handlers/association:member/getCertificate.ts` | 34 LOC | real impl, not in `certificates/` |
| `handlers/association:member/listMyCertificates.ts` | 33 LOC | real impl, not in `certificates/` |

Plus the route duplication:
- `/certificates/verify/:certificateNumber` registered **twice**:
  - `routes.ts:2666` (generated, via shim, calls `handlers/certificates/verifyCertificatePublic`)
  - `app.ts:349` (hand-wired Wave-2b, calls `handlers/certificates/verifyCertificatePublic` directly)

Both resolve to the same handler. Hono first-wins → whichever registers earlier serves. Order: `app.ts` hand-wired section (line ~349) runs before `routes.ts` generated section (line ~2666) → **hand-wired wins**. The generated route is dead.

---

## §2 — TypeSpec interfaces (3, source: `specs/api/src/association/member/certificates.tsp`)

```tsp
// main.tsp lines 394-404 — to be retagged
@tag("Association:Member")
@route("/association/member/certificates")
interface AssocCertificateManagement extends Association.Member.Certificates.CertificateManagement {}

@tag("Association:Member")
@route("/certificates")
interface CertificateVerificationService extends Association.Member.Certificates.CertificateVerificationService {}

@tag("Association:Member")
@route("/certificates")
interface CertificateBulkIssuance extends Association.Member.Certificates.CertificateBulkIssuance {}
```

Retag → `@tag("Member/Certificates")`. Routes stay the same.

Operations covered:
- `CertificateManagement`: `listMyCertificates`, `getCertificate`
- `CertificateVerificationService`: `verifyCertificatePublic`
- `CertificateBulkIssuance`: `bulkIssueCertificates`

Generated registry imports (`services/api-ts/src/generated/openapi/registry.ts:175-176, 258-259`):
- `listMyCertificates` ← `'../../handlers/association:member/listMyCertificates'`
- `getCertificate` ← `'../../handlers/association:member/getCertificate'`
- `bulkIssueCertificates` ← `'../../handlers/association:member/bulkIssueCertificates'` (1-LOC shim → `handlers/certificates/bulkIssueCertificates`)
- `verifyCertificatePublic` ← `'../../handlers/association:member/verifyCertificatePublic'` (1-LOC shim → `handlers/certificates/verifyCertificatePublic`)

Post-cutover, all four registry imports should resolve to `'../../handlers/member/certificates/<name>'`.

---

## §3 — Hand-wired holdouts (stay, but at new path)

App.ts hand-wired references to update:

| Location | Import | Action |
| --- | --- | --- |
| `app.ts:158` | `verifyCertificatePublic` from `@/handlers/certificates/verifyCertificatePublic` | rewrite to `@/handlers/member/certificates/verifyCertificatePublic` |
| `app.ts:159` | `generateCertificatePdf` from `@/handlers/certificates/generateCertificatePdf` | rewrite to `@/handlers/member/certificates/generateCertificatePdf` |
| `app.ts:349` | hand-wired route `/certificates/verify/:certificateNumber` | **resolution decision** — see §5 |
| `app.ts:531-534` | `getMyIdCard` + `getMyIdCardPdf` (in `person/` dir, not certificates) | no change |
| `app.ts:537-539` | hand-wired `/certificates/:id/pdf` route → `generateCertificatePdf` | keep — Wave-2b PDF byte-download stays hand-wired by design |

---

## §4 — Decisions baked in (no further checkpoint needed for these)

### 4.1 Route duplication `/certificates/verify/:certificateNumber`

**Decision:** kill the hand-wired duplicate at `app.ts:349`. Use the generated route.

**Why:**
- Both routes call the same handler.
- The generated route has `zValidator('param', ...)` middleware injected via the TypeSpec generator, providing consistent error envelopes.
- The hand-wired comment "Wave-2b, public certificate verification, no auth by design" describes why the route is public — but the *generated* route already inherits the same public path via `ASSOCIATION_PUBLIC_PATHS` (the path is `/certificates/verify/*` which matches the public-prefix list).
- Removing the hand-wired duplicate kills dead code. Both routes are functionally equivalent; preserving both is technical debt.

**Pre-flight verification:** confirm the generated route's effective auth posture. If `ASSOCIATION_PUBLIC_PATHS` does not include `/certificates/verify`, add it.

### 4.2 `handlers/certificates/listCertificates.ts` orphan (15 LOC)

**Decision:** delete.

**Why:**
- Not registered in `routes.ts` / `registry.ts`.
- `listMyCertificates` in `association:member/` (33 LOC, registered) supersedes it — both query certificates for the session user, but `listMyCertificates` is the canonical typespec-generated path.
- The 15-LOC `listCertificates.ts` predates the typespec migration. No external imports found.
- Its test file (`listCertificates.test.ts`, 44 LOC) also dies with it — it tests dead code.

### 4.3 Shims at `association:member/{bulkIssueCertificates,verifyCertificatePublic}.ts`

**Decision:** delete after registry import path is rewritten.

**Why:** with the registry pointing directly at `handlers/member/certificates/<name>`, the 1-line re-export serves no purpose.

---

## §5 — Pre-flight verification needed (1 item)

Before executing the cutover:

```sh
# Confirm /certificates/verify is in ASSOCIATION_PUBLIC_PATHS (no-auth public)
grep -n -B2 -A20 'ASSOCIATION_PUBLIC_PATHS' services/api-ts/src/app.ts | head -30
```

If `/certificates/verify` not present, add it before killing the hand-wired duplicate.

---

## §6 — Execution sequence

10 atomic steps, each followed by typecheck. Commit after each.

### Step C.1 — Pre-flight ASSOCIATION_PUBLIC_PATHS verification (§5 above)

### Step C.2 — Retag tsp + regenerate

```sh
# Edit specs/api/src/main.tsp lines 394-404 — three @tag("Association:Member") → @tag("Member/Certificates")
cd specs/api && bun run build
cd ../../services/api-ts && bun run generate
```

Regeneration emits stubs at `handlers/member/certificates/`. registry.ts updates its imports to the new path automatically (per R1-R4 baseline behavior).

### Step C.3 — Restore canonical impls from baseline

Restore 4 generated handlers + tests to the new path:

```sh
git show 339b9051:services/api-ts/src/handlers/certificates/bulkIssueCertificates.ts > services/api-ts/src/handlers/member/certificates/bulkIssueCertificates.ts
git show 339b9051:services/api-ts/src/handlers/certificates/bulkIssueCertificates.test.ts > services/api-ts/src/handlers/member/certificates/bulkIssueCertificates.test.ts
git show 339b9051:services/api-ts/src/handlers/certificates/verifyCertificatePublic.ts > services/api-ts/src/handlers/member/certificates/verifyCertificatePublic.ts
git show 339b9051:services/api-ts/src/handlers/certificates/verifyCertificatePublic.test.ts > services/api-ts/src/handlers/member/certificates/verifyCertificatePublic.test.ts
git show 339b9051:services/api-ts/src/handlers/certificates/verifyCertificatePublic-hmac.test.ts > services/api-ts/src/handlers/member/certificates/verifyCertificatePublic-hmac.test.ts
# generateCertificatePdf is hand-wired only — restore + import path rewrite needed
git show 339b9051:services/api-ts/src/handlers/certificates/generateCertificatePdf.ts > services/api-ts/src/handlers/member/certificates/generateCertificatePdf.ts
git show 339b9051:services/api-ts/src/handlers/certificates/generateCertificatePdf.test.ts > services/api-ts/src/handlers/member/certificates/generateCertificatePdf.test.ts
# Stragglers from association:member/
git show 339b9051:services/api-ts/src/handlers/association:member/getCertificate.ts > services/api-ts/src/handlers/member/certificates/getCertificate.ts
git show 339b9051:services/api-ts/src/handlers/association:member/listMyCertificates.ts > services/api-ts/src/handlers/member/certificates/listMyCertificates.ts
# Flow + permission-enforcement tests
git show 339b9051:services/api-ts/src/handlers/certificates/flow-09.certificate-retrieval.test.ts > services/api-ts/src/handlers/member/certificates/flow-09.certificate-retrieval.test.ts
git show 339b9051:services/api-ts/src/handlers/certificates/permission-enforcement.test.ts > services/api-ts/src/handlers/member/certificates/permission-enforcement.test.ts
```

### Step C.4 — Move repos + utils to new path

```sh
mkdir -p services/api-ts/src/handlers/member/certificates/repos
mkdir -p services/api-ts/src/handlers/member/certificates/utils
git mv services/api-ts/src/handlers/certificates/repos/* services/api-ts/src/handlers/member/certificates/repos/
git mv services/api-ts/src/handlers/certificates/utils/* services/api-ts/src/handlers/member/certificates/utils/
```

### Step C.5 — Delete dead code

```sh
git rm services/api-ts/src/handlers/certificates/listCertificates.ts
git rm services/api-ts/src/handlers/certificates/listCertificates.test.ts
git rm services/api-ts/src/handlers/association:member/bulkIssueCertificates.ts
git rm services/api-ts/src/handlers/association:member/verifyCertificatePublic.ts
git rm -r services/api-ts/src/handlers/certificates/  # all files now moved
git rm services/api-ts/src/handlers/association:member/getCertificate.ts
git rm services/api-ts/src/handlers/association:member/listMyCertificates.ts
```

### Step C.6 — Rewrite imports

Hot spots:
- `services/api-ts/src/app.ts:158-159` — rewrite `@/handlers/certificates/...` → `@/handlers/member/certificates/...`
- Any test file under `member/certificates/` that imports siblings (use sed bulk rewrite within the new dir)
- `core/domain-event-consumers.ts` / `seed/*` / `test-utils/*` — check for `handlers/certificates/` imports

Verify with:
```sh
grep -rn '@/handlers/certificates\b\|handlers/certificates/' services/api-ts/src/ --include='*.ts'
```

After Step C.5 + C.6, this grep should return zero hits.

### Step C.7 — Kill hand-wired route duplicate

Delete `app.ts:347-349` (`@hand-wired reason="public certificate verification..."` + the `app.get('/certificates/verify/...')` line). Leave the comment block at app.ts:531-539 (PDF download is genuinely hand-wired, by design).

### Step C.8 — typecheck gate

```sh
cd services/api-ts && bun run typecheck
```

Must be 5/5. Diagnose and fix any import-path stragglers.

### Step C.9 — Hurl scenarios

Write ≥ 5 real-flow `.hurl` files at `specs/api/tests/contract/member/certificates/`:
1. happy-path: list my certs → get one → verify public
2. bulk-issue: officer bulk-issues N certs → recipient sees them in list
3. get-not-found: 404 on getCertificate
4. verify-revoked: revoke flow → public verify shows `isValid: false`
5. verify-with-hmac: signature path → `verified: true`

Probe response envelopes first (per resume-prompt gotcha — `{data: ...}` vs direct vs `{items: ...}`).

### Step C.10 — MODULE_SPEC.member.certificates.md + gates + tag

```sh
# Write spec doc
# Run all gates: typecheck, unit (≥6027), contract (≥130 + new 5), SDK drift (0/454), observability (≥94%), contract-coverage (≥81%)
git tag -a member-certificates-cutover -m "Certificates sub-domain cut over to handlers/member/certificates/"
```

---

## §7 — Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Generator emits to wrong path | low | proven mechanic from R1-R4 baseline behavior; restored from baseline anyway |
| Cross-module imports break | medium | grep verification at Step C.6; restored test files restore their own import patterns |
| `ASSOCIATION_PUBLIC_PATHS` doesn't cover `/certificates/verify` | low-medium | Step C.1 pre-flight catches this; add to list if missing |
| Hand-wired hmac signature flow regression | medium | Hurl scenario #5 covers it; also `verifyCertificatePublic-hmac.test.ts` restored |
| Generated route order differs from previous Hono-first-wins behavior | low | killing hand-wired duplicate removes the order question entirely |
| Orphan `listCertificates` was secretly used | very low | grep showed no external imports; tests cover dead code only |

---

## §8 — Gates (R4 floor)

| Gate | Floor |
| --- | --- |
| typecheck | 5/5 |
| unit | ≥ 6027 (1 pre-existing fail accepted) |
| contract | ≥ 130 / 132 + 5 new |
| SDK drift | 0 / 454 |
| observability | ≥ 94 % |
| contract coverage | ≥ 81 % |

---

## §9 — Awaiting checkpoint

Confirm:
- Plan looks right
- §4 decisions accepted (kill route dup, delete orphan, delete shims)
- Step C.1 pre-flight will happen next

On confirmation: proceed to Step C.1.
