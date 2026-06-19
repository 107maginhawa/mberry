# Workflow Audit Campaign — Master Sequence

Goal: every user workflow across modules is provably exercised, and the gate
stays green (no regression) while the gap closes. Ordering principle:
**cheapest-highest-leverage first** (kill false positives before writing specs),
**P0 → P1 → P2** within each phase. Baseline ratchets down after every phase.

Status legend: ✅ done · ▶ in progress · ⬜ pending

Baseline trail: A=1/B=76/C=85 → … → **current A=0 / B=0 / C=23** (Phase 6/7 complete).

---

## Phase 0 — Enforcement machinery ✅
One command (`bun run audit:workflows`), baseline-ratchet gate
(`scripts/audit/ratchet.ts`), CI-enforced (`ci.yml`), `deferredReason` honored.
Shipped to PR #12.

## Phase 1 — Matrix-C detector fix ✅
Broadened route matcher (`scripts/audit/route-match.ts`) to count nav-helpers,
`path:` arrays, trailing-slash routes. **C 85→45** (40 false positives), zero
specs written.

## Phase 2 — P0 flow triage (Matrix B) ✅
Verified 13 P0 flows; tagged 5 covered-but-untagged (WF-041/042/076/079/128).
**B 76→71.** 8 genuinely-missing P0 flows recorded.

## Phase 3 — P1 flow triage (Matrix B) ✅
Parallel-triaged ~35 P1 flows (5 subagents, read each spec). Tagged 15
covered-but-untagged → **B 71→56**. Verified-MISSING P1 flows needing NEW specs
(Phase 6 fodder):
- **Actions that exist but specs only render/open-dialog:** WF-008 send-invite,
  WF-033 category-create (submit), WF-036 member-transfer (submit),
  WF-067 officer credit-adjust, WF-072 real-token verification.
- **Disabled test (quick win — re-enable):** WF-051 create&publish event is
  `test.fixme` in `actions/events-actions.spec.ts`.
- **No spec at all:** WF-047/048 templates/stats, WF-057 waitlist-promotion,
  WF-062/063 paid-training/analytics, WF-075 credential-templates, WF-077 cast-
  ballot, WF-078 bylaw, WF-115/116/120 booking schedule/no-show,
  WF-122/123/125/126/127 email admin UI, WF-129/131/133 billing invoices/refund,
  WF-017/018/020/021 platform-admin (some routes don't exist yet).
- **Backend-shaped (exempt candidates, not e2e):** WF-124 bounce, WF-132 webhook.
- **Data hygiene:** `onboarding.spec.ts` carries a stale `// WF-004` tag (that id
  is Password Reset) — clean up when touched.

## Phase 4 — Defer route-less modules (Matrix B) ✅
Modules with no frontend routes can't have UI e2e flows → excluded from the gate
(`DEFERRED_FLOW_MODULES`, transparency line shows count). Verified per module by
listing `apps/*/src/routes`. **Deferred: M13 social, M15 jobs, M16 advertising,
M17 marketplace.** (M14 national-dashboard and M18 surveys DO have routes — NOT
deferred; an initial grep bug wrongly deferred them, the ratchet caught the bad
baseline, corrected B 36→41.) Net **B 56→41**.

## Phase 5 — Matrix-C residual verification ✅ (partial)
Excluded colocated `*.test.tsx` from the route list (C 45→44). Of the 44 MISSING
routes: **17 have zero e2e reference = definite gaps** (Phase 6). **27 are
leaf-referenced** = likely link-click / dynamic-id navigation the literal-path
matcher can't see — each needs per-route verification (read the spec) to tag or
confirm genuine. That per-route verification is folded into Phase 6 batches.

## Phase 6 — Write new specs (the long pole) ⬜
Live-stack E2E authoring for the genuinely-uncovered remainder. Order:
1. **P0 money/auth/security** — finance/dues routes, manage-suppressions UI,
   create/view-invoice, cast-ballot, bylaw ratification.
2. **P1** — membership/credits/events/governance/comms.
3. **P2** — the rest.
Webhook/trigger flows (WF-124/132) close via **backend integration tests**, not
e2e — decide whether to exempt them from Matrix B or add an e2e-equivalent.
Each spec: real auth → navigate → assert real data (4-clause DoD for anything
promoted to `@journey-firewall`). Ratchet baseline down per spec.

## Phase 7 — Harden gates ⬜
Once depth backfilled: flip `lint:e2e-depth` off `continue-on-error`; confirm
matrix ratchet at its floor; final green.

---

## Working cadence (every batch)
1. Pull the next slice (by priority) from `docs/audits/WORKFLOW_AUDIT_BACKLOG.md`.
2. **Verify** each item against real specs/routes — never tag/skip on grep alone.
3. Tag covered-but-untagged, OR write the missing spec.
4. `bun run audit:workflows` → ratchet baseline → commit → push to PR #12.
5. Record truly-missing items back into the backlog.
