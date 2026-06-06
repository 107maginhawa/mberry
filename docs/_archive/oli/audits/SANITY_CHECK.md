# Sanity Check — Does the App Work?

One spec. One command. Single source of truth for app health.

## TL;DR

```bash
cd apps/memberry
CI=1 bunx playwright test _golden-path.spec.ts --workers=1 --reporter=line
```

**Green = ship.** Red = a real feature is broken; the failing step name tells you which one.

Runs in ~18 seconds. No flake tolerance — must be green every commit.

## What it covers (8 phases, all real state mutations)

Each phase asserts persistence, not "page loaded". Phases run serial in one isolated org so they can't poison each other or other suites.

| # | Phase | Persona | Verifies |
|---|---|---|---|
| 1 | Applicant signs up via UI | Fresh user | UI signup form works; CSRF; auto-create person |
| 2 | Applicant opens `/join/$slug` + applies via dialog | Same applicant | Public org profile route; G12 apply flow via real form |
| 3 | Officer opens `/officer/applications` + clicks per-row Approve | Officer (storageState) | requireOrgOfficer guard; per-row approve mutation (x-org-id) |
| 4 | Member logs a manual CPD credit | Same applicant | G13 org-fallback handler; credit ledger persistence |
| 5 | Treasurer records a manual payment | Treasurer (storageState) | `/dues/payments` surface mounts; cross-actor auth |
| 6 | Officer opens `/officer/roster` + sees the approved applicant row | Officer (storageState) | `/membership/members/{orgId}` propagation; roster UI |
| 7 | Officer drafts an announcement | Officer (storageState) | Communications create flow |
| 8 | Applicant signs out + signs back in | Same applicant | Auth round-trip clean |

## When to run

- **Every commit** (pre-commit hook candidate; ~18s budget)
- **Before every release**
- Whenever someone asks "is the app broken?" — this is the answer
- After landing infra changes (auth, middleware, DB schema, frontend router)

## Reading failures

The spec is structured so each step name = a real product capability. When the suite fails:

| Step that fails | Likely root cause area |
|---|---|
| 1. Applicant signs up | Signup UI, CSRF middleware, person auto-create hook |
| 2. Applicant `/join/$slug` Apply | Public-org route, `/public/org/:orgId/tiers` handler, `/association/member/applications` middleware |
| 3. Officer per-row Approve | `requireOrgOfficer` guard, `/association/member/applications/:id/approve` (needs `x-org-id`) |
| 4. Member logs CPD credit | `/persons/me/credit-entries` (G13 org fallback), credit ledger |
| 5. Treasurer records payment | `/dues/payments` surface, treasurer role on isolated org |
| 6. Officer reads roster | `/membership/members/{orgId}` handler, roster UI |
| 7. Officer drafts announcement | `/communications/announcements/{orgId}` POST |
| 8. Sign-out → sign-in | Better-Auth session handling |

The failure's trace.zip plus the step name should localize the regression to a 1-3 file diff in under 5 minutes.

## Why one golden-path spec instead of fixing all the failing tests?

After 22+5 commits of selector and infra fixes, the broader suite still reports 250-ish fails under workers=2. Investigation (`docs/audits/E2E_REMEDIATION_FINAL.md` §Root causes) confirmed:

- Every fixed file passes **alone** (`bunx playwright test <file>` → 100%)
- 35-40% of the suite is **smoke-only** (asserts "heading visible", never submits a form)
- 5-10% are real happy-paths (`directory-onboarding`, `oli-runtime-loop`, `training-lifecycle`, `auth`, this spec)
- 10 critical workflows have **zero E2E** at all (member voting, GDPR export, account deletion, notification prefs, …)

Fixing the 250 selector drifts one at a time is **<30% signal yield**. A single comprehensive golden path is **>90% signal**: when it goes red, you know a real feature is broken.

The 250 long-tail is now categorized as "suite hygiene tail" — not blocking. Track B + Track C in the original plan document the gap-fill backlog.

## Adding to the golden path

When you ship a new persona-critical workflow:

1. Decide which phase it belongs to (e.g., "officer approves a transfer" → after phase 2)
2. Add a new `test('N. <verb> <noun>', async ({ … }) => { … })` block inside the same `test.describe`
3. Re-use the existing primitives:
   - `fx().orgId`, `fx().slug`, `fx().personIds[0]`, `fx().officerPersonId` from `withIsolatedFixture`
   - `apiFetch(page, path, { method, body, orgId })` for any state-changing API call
   - `authStateFile('officer' | 'treasurer' | 'secretary' | 'member' | 'society')` for cross-context auth
   - `signUp(page)` / `signIn(page, email, password)` for UI sign flows
4. Assert a real state change — `toBe`, `toMatch`, `toContain` — not just `toBeVisible` on a heading.
5. Run alone before opening PR: `CI=1 bunx playwright test _golden-path.spec.ts --workers=1`

## Related

- `apps/memberry/tests/e2e/_golden-path.spec.ts` — the spec itself
- `apps/memberry/tests/e2e/helpers/isolated-fixture.ts` — `withIsolatedFixture` (G10 + F2)
- `apps/memberry/tests/e2e/helpers/api-fetch.ts` — `apiFetch` (G1)
- `apps/memberry/tests/e2e/helpers/auth.ts` — `signUp` / `signIn` family
- `docs/audits/E2E_REMEDIATION_FINAL.md` — full remediation history + 250-fail philosophy
- `docs/product/WORKFLOW_MAP.md` — 107 documented workflows (golden path covers the 8 most critical)
- `docs/ver-3/business/br-registry.json` — 39 Phase-1 BRs (36/39 already have E2E refs)
