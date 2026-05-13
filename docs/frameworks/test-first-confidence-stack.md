# Test-First Confidence Stack v3

**Goal:** Drive any existing codebase toward TDD-like regression safety and ship discipline. Green CI = changes are safe, release is verified, ship with confidence.

**Cross-Cutting Principle: Risk-Based Depth**
Criticality determines how deep each layer goes. Auth/billing get exhaustive coverage. CRUD list pages get smoke. 3-person team runs lean; 30-person team runs formal. Same framework, different intensity.

## The 6 Layers

1. **Coverage Integrity** — Fix the ruler before measuring. Define "covered" semantics per rule class. Reconcile registries that disagree. Mapped rule with weak assertion = not covered.
2. **Behavior Traceability** — Every critical behavior has a test owner. Map business rules → tests. Map user journeys → E2E. Map API endpoints → contract tests. Map role gates → deny + allow tests.
3. **Test Quality Hardening** — Depth before breadth. Fix weak tests before adding new ones. Assert business outcomes not implementation details. Minimize mocks. Kill flake before adding more tests. Seed known data.
4. **Release Gates** — Policy-driven gate stack: types → units → coverage → contracts → E2E → build. Coverage ratchet on new code (new code must be tested). Branch protection enforced. Gate order adapts per project.
5. **Artifact & Runtime Verification** — Test what you actually ship. Critical-path journeys against built artifacts, not dev servers. Config/env validation. Schema/migration safety checks. Container health checks.
6. **Release Safety** — Ship with a safety net. Canary/rollback strategy. Feature flags for risky changes. Dependency/security audit. Post-deploy smoke verification.

## Setup Sequence

### Phase 1: COVERAGE INTEGRITY

- 1.1 Define "covered" per rule class (not one universal standard)
- 1.2 Reconcile any registries/reports that disagree
- 1.3 Make coverage artifacts deterministic and CI-runnable
- 1.4 Audit assertion quality (weak assertions = not covered)

### Phase 2: BEHAVIOR TRACEABILITY

- 2.1 Business rules → test mapping (which rules unguarded?)
- 2.2 User journeys → E2E mapping (which flows untested?)
- 2.3 API routes → contract/handler test mapping
- 2.4 Role/permission gates → deny + allow test mapping

### Phase 3: RELEASE GATES (wire before filling gaps — so new work is protected)

- 3.1 Wire all test suites into CI (fail PR on red)
- 3.2 Add coverage floor + higher minimums for critical scopes
- 3.3 Add changed-lines coverage ratchet (new code must be tested)
- 3.4 Branch protection / required-check enforcement
- 3.5 Dependency security audit step

### Phase 4: TEST QUALITY HARDENING + GAP FILL (depth + breadth together)

- 4.1 Close highest-risk gaps first (P1 business rules, security-critical routes)
- 4.2 Harden shallow tests (replace "page loads" with real data assertions)
- 4.3 Fill remaining route/journey gaps per app
- 4.4 Flake quarantine: tag, separate CI job, owner assigned, fix SLA

### Phase 5: ARTIFACT & RUNTIME VERIFICATION

- 5.1 Critical-path E2E against built artifacts (not dev servers)
- 5.2 Config/env startup validation (fail fast on missing vars)
- 5.3 Schema/migration backward-compat checks
- 5.4 Container/binary health check

### Phase 6: RELEASE SAFETY

- 6.1 Canary/staged rollout for high-risk changes
- 6.2 Rollback plan documented and tested
- 6.3 Feature flags for risky deployments
- 6.4 Post-deploy smoke verification

## Per-Module Checklist

For each module:

- [ ] Business rules extracted, registered, and reconciled
- [ ] "Covered" defined per rule class (unit? integration? E2E?)
- [ ] Unit tests cover every critical handler + repo behavior
- [ ] Integration tests cover cross-module interactions
- [ ] E2E tests cover every user journey (real data, not just selectors)
- [ ] Contract tests cover wire format
- [ ] Role/permission gates tested (deny + allow)
- [ ] Error paths tested (400, 403, 404, 409)
- [ ] Edge cases from rule registry covered
- [ ] Built-artifact smoke passes

## Team Size Tiers

| Layer | 3-person team | 30-person team |
|-------|---------------|----------------|
| Coverage Integrity | Agree on "covered" verbally, spot-check | Formal registry, generated reports, CI validation |
| Behavior Traceability | Critical rules + happy-path journeys only | Full registry, journey catalog, ownership model |
| Test Quality Hardening | Fix worst offenders, seed basics | Mutation testing, assertion strength reviews |
| Release Gates | Types + tests + build (3 gates) | Full layered stack with coverage ratchets |
| Artifact Verification | Build + smoke | Critical journeys against staging |
| Release Safety | Manual rollback plan | Canary, feature flags, automated rollback |

## One-Liner

> **Fix the ruler → trace every behavior → harden test quality → gate CI → verify shipped artifacts → ship with safety net.** Tests prevent. Artifacts prove. Release safety catches the rest.
