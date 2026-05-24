# TODOS

Quick reference for deferred work and gates from eng review (2026-05-23).

## Wave 0a — Infrastructure
- [ ] **T1 (P1)** Slug migration: add slugify() to org creation handler + backfill + NOT NULL constraint
- [ ] **T2 (P1)** Route migration: rename 40+ route files from `$orgId` to `$orgSlug`, add UUID→slug 301 redirect
- [ ] **T3 (P1)** OrgProvider: upgrade `useOrgContext` hook to full React Context Provider (`{ org, role, permissions, isOfficer }`)
- [ ] **T4 (P2)** Org switcher: build Slack-style icon rail (desktop) + bottom sheet picker (mobile)
- [ ] **T5 (P1)** Account merge: move 8 route groups (dashboard, bookings, settings, onboarding, notifications) to Memberry. Deprecate Account app.
- [ ] **T9 (P3)** Tech debt sweep: fix CLAUDE.md TypeSpec claims, training cross-org leak, catalog hand-wired routes

## Wave 0b — Features
- [ ] **T6 (P1)** Wire `addMember()` into `claimInvite.ts` — invite claim must create membership
- [ ] **T7 (P2)** Join flow frontend: `/join` (discovery), `/org/[slug]/apply` (application), `/invite/[token]` (claim)
- [ ] **T8 (P2)** One-tap payment: `/pay/[token]` page with Stripe, token security (HMAC, 72h expiry, single-use)
- [ ] Run `/oli-api-contracts` + `/oli-ui-blueprint` before starting Wave 0b features

## Gates (ENFORCED)

### PRE-WAVE 1: Domain Event Spike
- [ ] 2-day EventEmitter spike with typed registry + one E2E flow (dues paid → standing update)
- **Cannot start Wave 1 (Finances) without completing this.**
- Depends on: Wave 0b completion

### PRE-ADMIN: Session Sharing Verification
- [ ] Verify Better-Auth cookies shared across Memberry + admin app (different ports/domains)
- **Must verify before admin app development starts.**

## Deferred (future waves)

- [ ] **Slug rename support** — `organization_slug_history` table + 90-day redirects. When there's demand.
- [ ] **Account app cleanup** — Delete `apps/account/` after deprecation verified in production.
- [ ] **Comms consolidation spike** — 1-day spike pre-Wave 4. Merge `comms` (real-time) + `communication` (async)?
- [ ] **staleTime invalidation** — Add slug cache invalidation when slug renames ship.

## Resolved Decisions (from eng review)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Account post-merge | Deprecate entirely | Memberry already has auth routes |
| Slug collision | Auto-suffix (pda-cebu-2) | Industry standard |
| Org logos | S3/MinIO + AvatarInitials fallback | Storage module exists |
| Payment providers | Stripe only | User decision |
| Domain events | Defer to pre-Wave 1 | No Wave 0 consumer (YAGNI) |
| Slug caching | staleTime: Infinity | Immutable in Wave 0 |
| Shared components | Already exist (13) — audit only | No rebuild needed |
| Wave structure | 0a (infra) + 0b (features) | Outside voice recommendation |
