# Continuation prompt — AHA Step 45 (DECISION + BUILD — Dues member-payment funnel: Q-PD7 first-invoice-on-approval + Q-PD8 member "Pay Now" entry)

Paste the block below into a fresh session (after /clear), or run: `execute docs/aha/outputs/CONTINUE-45-prompt.md`.

> **The pilot's core value is broken end-to-end.** "Members stay current on dues from any device"
> does not work today: an approved member is stuck `pendingPayment`, the batch invoice generator
> (`generateDuesInvoicesForOrg.ts`) filters `status='active'` only — so **newly-approved members
> never get a first invoice** — and there is **no reachable member payment entry point** (reminders
> carry no pay link; no "Pay Now" CTA in the member dues/payments pages). This is dues `FIX-009`,
> a V1-REQUIRED P1, gated on two product decisions: **Q-PD7** (how the first invoice is triggered
> on approval) and **Q-PD8** (whether members self-serve "Pay Now" in V1 or pay via emailed links).
> It is the **highest-leverage remaining gate** and the natural successor to Track B (it crosses the
> same membership-lifecycle ↔ dues seam that Step 44 just closed). This is a Steps 29/40/44-style
> decision+build session: capture the 2 decisions, then build ONLY the unblocked slice, TDD.
>
> **Context for the picker:** the 3 standing P0s are all RESOLVED (elections G2 / Step 29, documents
> Q1 / Step 40, realtime PD-1 / Step 41) and Track B is CLOSED (Step 44). The decision-free track is
> fully drained — every remaining item is product-decision-gated. Q-PD6 (gateway-API refund execution)
> is NOT in scope here — it is env-blocked (stripe-mock not wired into CI) and stays deferred.

---

CODEBASE_ROOT = /Users/elad-mini/Desktop/memberry. Do NOT use `.claude/workflows/aha-autorun.js`. No autorun. No commit unless asked. Working tree intentionally dirty (recovery-2025 + AHA Steps 31–44) — PRESERVE. FORBIDDEN: `git reset --hard`, `git checkout .`, `git checkout HEAD -- .`, `git clean -fd`, `git restore .`, `rm -rf`.

## Step 1 — Load context

1. `docs/aha/prompts/00-aha-shared-rules.md`.
2. `docs/aha/prompts/04-module-or-group-fix-tdd.md` (TDD fix protocol — follow it; this IS a build pass).
3. `docs/aha/module-fix-plans/dues-payments-fix-ready-plan.md` — **§ FIX-009** (the funnel row), **§ Batch C** (P1 workflow), and **§8 Product Decisions** (Q-PD6/Q-PD7/Q-PD8). Q-PD7/Q-PD8 resolve here; Q-PD6 stays deferred.
4. `docs/aha/module-fix-plans/dues-payments-fix-report.md` — confirm what already shipped (Batch A P0 tenant guards, Batch B RBAC/validation, the **settle-seam** pass: FIX-007 refund cap, FIX-010 confirm-proof atomicity, config cross-org guard). Do NOT re-do shipped fixes. FIX-009 (funnel) was explicitly NOT done — it is this pass.
5. `docs/aha/module-fix-plans/membership-lifecycle-fix-report.md` §"Step 44" — the membership side of the seam (approval sets `pendingPayment`; Track B closed). The first-invoice trigger must agree with the ratified lifecycle.

**Pre-flight reads (BEFORE any edit — per `feedback_subagent_preflight`):** vite proxy + toast (`sonner`) + auth + route patterns; and:
- `services/api-ts/src/handlers/association:member/approveMembershipApplication.ts` (approval sets `pendingPayment` — the trigger site for Q-PD7; ~L66).
- `services/api-ts/src/handlers/.../generateDuesInvoicesForOrg.ts` (batch generator filtering `status='active'` only — the other half of the gap; ~L75).
- The dues domain-event seam: `core/domain-event-consumers.ts` (does a `membership.approved`/equivalent event already exist? prefer an event consumer over widening the batch generator if so — confirm before choosing).
- `services/api-ts/src/handlers/.../reminderProcessor.ts` (reminders that today carry no pay link — Q-PD8 emailed-link path).
- Member-facing pages: `apps/memberry/src/routes/_authenticated/org/$orgSlug/dues.tsx` + `apps/memberry/src/routes/_authenticated/my/payments.tsx` (where a "Pay Now" CTA would live — Q-PD8 self-serve path).
- The existing dues invoice + payment SDK hooks (`useCreateDuesInvoice`/`useListDuesInvoices`/proof-submit) to reuse, not reinvent.

## Step 2 — Capture the 2 decisions (Q-PD7, Q-PD8)

Use `AskUserQuestion` (one question per decision; default = the engineering recommendation marked "(Recommended)"). Capture answers verbatim. Per `feedback_defer_decisions`, if the user defers ("your call"), apply the recommended option.

| ID | Decision | Options | Eng recommendation |
| --- | --- | --- | --- |
| Q-PD7 | **First-invoice trigger** — how does an approved member get their first dues invoice? | (a) **Domain-event consumer** — `membership.approved` (or the approval handler) emits → a dues subscriber mints the first invoice; vs (b) **Widen the batch generator** — `generateDuesInvoicesForOrg` also picks up `pendingPayment` members | **(a) event consumer** IF an approval domain event already exists (decoupled, immediate, mirrors the Step 44 cascade pattern); fall back to (b) only if no event seam exists. Confirm during pre-flight. |
| Q-PD8 | **Member payment entry in V1** — how does a member actually pay? | (a) **Self-serve "Pay Now"** CTA in the member dues/payments page (in-app proof-submit / invoice view); vs (b) **Emailed payment links only** (reminder carries a tokenized link) | **(a) self-serve Pay Now**, reusing the existing PH bank-transfer proof-submit flow (already shipped + atomic per FIX-010) — no new gateway dependency, directly serves "pay from any device". Emailed links (b) can be additive V2. |

> Q-PD6 (gateway-API refund execution) is explicitly OUT of scope — env-blocked (stripe-mock not in CI). Note it as deferred; do not build it.

## Step 3 — Build the unblocked FIX-009 slice (TDD, per prompt 04)

Smallest correct slice honoring the 2 decisions. Cross-module-aware — `settle-payment.ts` / `membership-lifecycle.ts` is a load-bearing seam (`[CROSS-MODULE RISK]`); do NOT touch settle math or the double-expiry path.

- **Q-PD7 (first invoice on approval):**
  - If event-consumer chosen: add a dues subscriber in `core/domain-event-consumers.ts` keyed on the approval event that mints the first invoice for the newly-approved `(org, person)` using the org's dues config; idempotent (no duplicate invoice if one exists). Fire-and-forget with its own try/catch + structured log (mirror the existing cascade subscribers).
  - If generator-widen chosen: extend `generateDuesInvoicesForOrg` to include `pendingPayment` members without an open invoice; guard against re-issuing.
  - Either way: do NOT change the membership status transition (approval stays `pendingPayment` until paid → settle flips to `active`, per the ratified Track B lifecycle).
- **Q-PD8 (member Pay Now entry):**
  - FE: add a "Pay Now" CTA on the member dues/payments page that opens the existing proof-submit flow against the open invoice (reuse the shipped hooks/components; `sonner` for toasts). Empty/loading/error states per shared rules.
  - If emailed-link chosen instead: mint a tokenized pay link in `reminderProcessor` and add the link-target route; keep it minimal.

Regenerate ONLY if TypeSpec changed: `cd specs/api && bun run build` → `cd services/api-ts && bun run generate` → regenerate SDK. Never hand-edit generated files. (FIX-009 may be implementable with NO contract change — prefer that.)

## Step 4 — TDD (RED first)

- **First-invoice trigger** (backend/unit + integration): approving an application produces exactly one open dues invoice for the new member (idempotent — second trigger does NOT duplicate); the invoice uses the org dues config amount/cycle. Assert against the real seam (FIX-001-style real-schema where a migration/data assertion applies — none expected here).
- **No status regression** (cross-module): approval still lands `pendingPayment`; only settle/payment flips to `active` (guard the Track B invariant).
- **Cross-org guard** (permission/RBAC): the trigger/invoice is scoped to the approving org; an org-A approval never mints an org-B invoice.
- **Member Pay Now** (frontend/component): the member dues/payments page renders a "Pay Now" CTA when an open invoice exists, hidden when none; clicking opens the proof-submit flow. Extend the relevant `*.test.tsx`.
- **E2E** `[BLOCKED BY ENVIRONMENT]` likely (no seeded auth; `:3004` redirects to `/auth/sign-in` per Steps 42/43) — prove via handler + component nets and mark it. Pin Playwright 1.58.2 per `project_playwright_pin` if you add a spec.

## Step 5 — Validation

- `cd services/api-ts && bun test` (dues + association:member + the new funnel tests) — green; no regressions. Watch the membership seam (no double-expiry, no status drift).
- `cd services/api-ts && bunx tsc --noEmit` and `cd apps/memberry && bunx tsc --noEmit` — clean across touched workspaces.
- Contract suite if TypeSpec changed: `bun run scripts/run-contract-tests.ts` against a booted impl (or mark `[BLOCKED BY ENVIRONMENT]`).
- Live browse only if a real authed member dues page is reachable; otherwise `[BLOCKED BY ENVIRONMENT]`. Evidence under `docs/aha/evidence/`.

## Stop condition

- After the FIX-009 funnel slice is GREEN, append a **Step 45 — Dues member-payment funnel (Q-PD7 + Q-PD8)** section to `dues-payments-fix-report.md` (decisions captured, RED→GREEN, files, cross-module notes, evidence, completion) and update `dues-payments-fix-ready-plan.md` (FIX-009 → resolved; Q-PD7/Q-PD8 → decided; Q-PD6 → still deferred) + roadmap §13 (remove Q-PD7/Q-PD8 from the open P1 list; note the funnel closed). Then STOP. Do NOT auto-chain to another gated module.

After the dues funnel closes, the next P1 gates (roadmap §13) are: **person-profile Q-1** (directory privacy model — also unblocks G-02) **/ Q-4** (anonymize `gender`); **training TC-DEC-01/02** (paid trainings + manual-entry verification gate); **platform-admin Q1/Q8** (admin tier taxonomy); **notifications Q3/Q1** (preference store of record + web-push descope); **realtime PD-2/PD-3** (DM org-scoping + video V1). Each is its own `[NEEDS PRODUCT DECISION]` session — resolve, then run the unblocked `04`. Re-run `07-consolidate-roadmap.md` once a few land (and to clear the stale §13 P0 table — G2/Q1/PD-1 are all resolved).

execute systematically
