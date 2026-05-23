<!-- oli:vertical-slice-plan v1.0 | generated 2026-05-23 | source: m08-events MODULE_SPEC, Wave 2a design doc, eng review plan -->

# Wave 2a Vertical Slice Plan -- Events UX Upgrade

## Context

Wave 2a upgrades the events module from basic CRUD to Luma/Eventbrite-quality UX with paid registration, CPD activity types, public event pages, and QR check-in. Split into alpha (core experience) and beta (check-in + discovery).

**Source documents:**
- MODULE_SPEC: `docs/product/modules/m08-events/MODULE_SPEC.md` (7 slices, 6 ACs, 11 BRs)
- Design: `~/.gstack/projects/memberry/elad-mini-main-design-20260523-165145-wave2a-events.md`
- Eng plan: `~/.claude/plans/cozy-shimmying-cloud.md`

**Eng review overrides:**
- Extend existing `events.schema.ts` fields (registrationFee, creditAmount, visibility exist)
- pg-boss for async pipeline (not custom EventEmitter)
- Handlebars + Puppeteer for PDF (Wave 2b)

**BR-15 override:** MODULE_SPEC says "events never generate credit entries." Design doc overrides this -- credit-bearing events (with cpdActivityType set) DO award credits via check-in attestation. BR-15 must be updated to: "IF event is credit-bearing AND check-in attested THEN credit entry created via pg-boss pipeline."

## Summary

| Metric | Count |
|--------|-------|
| Total slices | 9 |
| Alpha slices | 6 |
| Beta slices | 3 |
| Parallel groups | 3 |
| ACs covered | 6/6 |
| BRs covered | 11/11 (BR-15 updated) |

## Dependency Graph

```
                    W2A-S1 (Schema + TypeSpec)
                    /          |           \
                   v           v            v
        W2A-S2 (CRUD)    W2A-S3 (Public)   W2A-S4 (Slug+Image)
              |                |
              v                |
        W2A-S5 (Registration)  |
           /        \          |
          v          v         |
  W2A-S6 (Paid)  W2A-S7 (Waitlist)
                                \
                                 v
                    ── ALPHA CHECKPOINT ──
                                 |
              ┌──────────────────┼──────────────┐
              v                  v              v
     W2A-S8 (Check-in)   W2A-S9 (Discovery)  W2A-S10 (Analytics)
                                                (deferred -- Wave 2a-beta+)
```

## Slices

---

### W2A-S1: Event Schema Extension + TypeSpec (FOUNDATIONAL)

**Risk:** P0 | **Type:** refactor | **Complexity:** small | **Phase:** alpha

**What:** Add cpdActivityType enum, eventSlug (globally unique), coverImageUrl to events schema. Update TypeSpec to match. Add public event endpoint.

**Scope:**
- **Schema:** `events.schema.ts` -- add 3 new columns + cpd_activity_type enum. Migration via `bun run db:generate`
- **TypeSpec:** `events.tsp` -- add CpdActivityType enum, eventSlug, coverImageUrl, cpdCreditHours fields to Event model. Add `GET /public/events/{slug}` endpoint
- **Backend:** `bun run build` (specs) + `bun run generate` (api)
- **Frontend:** none
- **Test:** TypeSpec compiles, typecheck passes, migration runs clean
- **Data:** Migration adds nullable columns (non-breaking for existing events)

**BRs:** BR-16 (visibility default internal)
**ACs:** none directly (foundational)
**Dependencies:** none (first slice)

**Checklist:**
- [ ] Schema migration adds columns without breaking existing data
- [ ] TypeSpec compiles with new fields
- [ ] Generated routes include `/public/events/:slug`
- [ ] Existing event handlers still pass tests

---

### W2A-S2: Event CRUD Upgrade (PATTERN-ESTABLISHING)

**Risk:** P0 | **Type:** stabilize | **Complexity:** medium | **Phase:** alpha

**What:** Upgrade event creation to support new fields: CPD activity type, credit hours, pricing, visibility, draft auto-save. Officer event management dashboard with status badges.

**Scope:**
- **Backend:** Modify `createEvent.ts` to accept new fields. Auto-generate eventSlug on first save (slugify + collision suffix). Validate: cpdCreditHours 0.5 increments max 40, coverImageUrl max 5MB jpg/png/webp via storage module
- **Frontend:** Event creation form upgrade (cover image upload, CPD type dropdown, credit hours, pricing toggle, visibility toggle, auto-save on blur). Event management dashboard with status badges and quick actions
- **Test:** Unit: slug generation + collision. Unit: validation rules. E2E: officer creates event with all new fields
- **Permission:** Officer role required

**BRs:** M8-R4 (visibility access control), BR-16 (default internal)
**ACs:** none directly (CRUD is prerequisite)
**Dependencies:** W2A-S1

**Checklist:**
- [ ] Event slug generated on first save, immutable after
- [ ] Slug globally unique with auto-suffix on collision
- [ ] Cover image uploaded to S3/MinIO via storage module
- [ ] CPD activity type enum rendered as dropdown
- [ ] Draft auto-save on field blur (event stays draft until publish)
- [ ] Event management dashboard shows all statuses

---

### W2A-S3: Public Event Page + OG Meta

**Risk:** P1 | **Type:** new | **Complexity:** medium | **Phase:** alpha

**What:** Public event detail page at `/events/:eventSlug`. Shareable URL with OG meta for WhatsApp/Facebook. Non-members see "Join to register" CTA.

**Scope:**
- **Backend:** `getPublicEvent.ts` handler for `GET /public/events/:slug`. Hono OG meta route that serves `<html><head><meta og:...></head></html>` for social crawlers (redirect to SPA for browsers)
- **Frontend:** Public event detail page: hero cover image, title, description, date/time (local tz), location, speakers (free-text), RSVP count, CPD hours badge. For non-members: "Join [Org Name] to register" CTA linking to invite flow
- **Test:** Unit: public endpoint returns correct fields, hides draft/cancelled events. E2E: share URL opens event page
- **Data:** No schema changes

**BRs:** M8-R4 (visibility enforcement)
**ACs:** AC-M08-005 (visibility enforcement)
**Dependencies:** W2A-S1, W2A-S2

**Checklist:**
- [ ] Draft and cancelled events return 404 on public endpoint
- [ ] OG meta served for social crawlers (test with Facebook debugger pattern)
- [ ] Non-member sees "Join to register" CTA
- [ ] Member sees registration CTA (from next slice)
- [ ] Timezone displayed in member's local time with "Your time" label

---

### W2A-S4: Cover Image + Slug Infrastructure

**Risk:** P2 | **Type:** new | **Complexity:** small | **Phase:** alpha (parallel with S2/S3)

**What:** Wire cover image upload via existing storage module. Slug utility reuse from platformadmin.

**Scope:**
- **Backend:** Reuse `handlers/platformadmin/utils/slug.ts` pattern for event slug generation. Wire S3/MinIO upload for cover images in event create/update handlers
- **Frontend:** Image upload component in event form (drag-drop or click, preview, crop optional)
- **Test:** Unit: slug generation, image validation (size, type)
- **Data:** No schema changes (columns added in S1)

**BRs:** none
**ACs:** none
**Dependencies:** W2A-S1

**Checklist:**
- [ ] Reuses existing slug.ts utility (generateSlug + ensureUniqueSlug)
- [ ] Reuses existing storage module for S3/MinIO upload
- [ ] Image validated: max 5MB, jpg/png/webp only
- [ ] Image preview shown in form before save

---

### W2A-S5: Event Registration (Free RSVP)

**Risk:** P0 | **Type:** stabilize | **Complexity:** medium | **Phase:** alpha

**What:** Free event registration with one-tap RSVP, capacity enforcement, .ics calendar download. Member "My Events" page.

**Scope:**
- **Backend:** Upgrade existing `createEventRegistration.ts` to check capacity + auto-waitlist. Add membership eligibility check (Active/Grace only). Add .ics generation endpoint
- **Frontend:** RSVP button on event detail page. Confirmation toast + "Add to Calendar" button. My Events page upgrade: upcoming/past tabs, registration status badges, CPD hours pending
- **Test:** Unit: capacity enforcement, membership eligibility. Integration: register → confirm → appears in My Events. E2E: member RSVPs, sees event in My Events
- **Permission:** Authenticated member + org membership

**BRs:** BR-27 (capacity → waitlist), M8-R1 (waitlist FIFO), M8-R5 (cancel releases capacity)
**ACs:** AC-M08-002 (capacity management)
**Dependencies:** W2A-S2

**Checklist:**
- [ ] Registration blocked for Lapsed/Suspended/Removed/Resigned/Deceased/Expelled
- [ ] Capacity hit → auto-waitlist with FIFO ordering
- [ ] .ics file generated with correct timezone
- [ ] My Events shows registration status and pending CPD hours
- [ ] Confirmation email sent via existing email module (new template)

---

### W2A-S6: Paid Event Registration (Stripe Checkout)

**Risk:** P1 | **Type:** new | **Complexity:** medium | **Phase:** alpha

**What:** Paid event registration via Stripe Checkout session. Reuses existing billing.ts Stripe Connect patterns.

**Scope:**
- **Backend:** New `registerAndPay.ts` handler. Creates Stripe Checkout session with event's registrationFee + currency. Webhook handler for payment success → registration confirmed, payment failure → no record. Stripe onboarding check on event publish (block if org not onboarded)
- **Frontend:** "Register and Pay" button on event detail. Redirects to Stripe Checkout. Success/failure return URLs. "Set up billing" prompt for officers publishing paid events without Stripe onboarding
- **Test:** Unit: Stripe session creation (mock SDK). Unit: webhook handler. Integration: register → pay → confirm → appears in My Events. E2E: full paid registration flow with Stripe test mode
- **Permission:** Authenticated member for registration. Officer for publish guard

**BRs:** M8-R2 (registration requires payment before confirmed), M8-R3 (cancel → refund via M06)
**ACs:** AC-M08-003 (paid event registration)
**Dependencies:** W2A-S5

**Consumed events:** PaymentRecorded (M06) → confirm registration. RefundCompleted (M06) → status refunded.

**Checklist:**
- [ ] Registration stays "pending" until PaymentRecorded event
- [ ] Payment failure/abandon → no registration record created
- [ ] Stripe Checkout uses org's Stripe Connect account (existing billing.ts)
- [ ] Publish blocked if org has no Stripe account onboarded
- [ ] Draft-save of paid event allowed without Stripe onboarding

---

### W2A-S7: Waitlist Management

**Risk:** P1 | **Type:** new | **Complexity:** small | **Phase:** alpha

**What:** Waitlist with FIFO ordering. Manual officer promotion (auto-promotion deferred to Wave 2b).

**Scope:**
- **Backend:** Waitlist entry on capacity hit (existing table). Officer "Promote" action → moves first waitlisted to confirmed. Cancel → release slot → show "Promote" on next waitlisted
- **Frontend:** Officer registration list shows waitlisted members with "Promote" button. Member sees "Waitlisted" status badge
- **Test:** Unit: FIFO ordering. Integration: register past capacity → waitlisted → cancel → promote next
- **Permission:** Officer for promotion

**BRs:** M8-R1 (FIFO), M8-R5 (cancel releases capacity), BR-27 (capacity → waitlist)
**ACs:** AC-M08-002 (capacity management, partial)
**Dependencies:** W2A-S5

**Checklist:**
- [ ] Waitlist ordered by registration timestamp (FIFO)
- [ ] Officer sees "Promote" button next to waitlisted members
- [ ] Promotion sends notification to promoted member
- [ ] Capacity reclaimed on cancellation

---

### ── ALPHA CHECKPOINT ──

Verify before proceeding to beta:
- [ ] Officer can create paid CPD event in <3 min
- [ ] Member can register + pay in <60 sec
- [ ] Event page shareable via WhatsApp with OG preview
- [ ] All 6 alpha slices pass tests
- [ ] No P0 bugs remaining

---

### W2A-S8: QR Check-in + Attestation

**Risk:** P1 | **Type:** new | **Complexity:** medium | **Phase:** beta

**What:** Browser-based QR scanner for officer check-in. Attestation metadata (compliance event). Manual name lookup as primary fallback.

**Scope:**
- **Backend:** Extend check-in record with attestation JSONB (officer ID, method: qr/manual, device info, timestamp). Emit pg-boss `attendance.confirmed` job after check-in (consumed by Wave 2b credit pipeline)
- **Frontend:** QR scanner using `html5-qrcode` library. Scan → confirm identity → mark attended. Fallback: search by name/email. Confirmation animation on successful check-in. Digital ticket: QR code generated client-side from registration ID
- **Test:** Unit: attestation metadata structure. Integration: check-in → pg-boss job created. E2E: officer scans QR (if iOS Safari works) or manual lookup. Feasibility: test on iOS Safari 17+ before committing QR path
- **Permission:** Officer only (BR-17)

**BRs:** BR-17 (officer-only check-in), BR-18 (three-factor QR validation), M8-R6 (post-completion lock)
**ACs:** AC-M08-001 (QR check-in security), AC-M08-006 (post-completion lock)
**Dependencies:** W2A-S5 (registrations exist to check in)

**Published events:** AttendanceConfirmed (consumed by Wave 2b credit pipeline)

**Checklist:**
- [ ] Attestation stored as JSONB, not just boolean flag
- [ ] pg-boss `attendance.confirmed` job enqueued on check-in
- [ ] Manual lookup works as primary path (QR is enhancement)
- [ ] Check-in blocked after event status = completed
- [ ] QR code contains registration ID, verified against registered member list
- [ ] iOS Safari camera permissions handled gracefully (fallback to manual)

---

### W2A-S9: Cross-Org Public Discovery

**Risk:** P2 | **Type:** new | **Complexity:** medium | **Phase:** beta

**What:** Public event discovery page at `/discover/events`. Aggregates public events across all orgs with filters.

**Scope:**
- **Backend:** New endpoint: `GET /public/events` with query params: country, eventType, dateFrom, dateTo, paidFilter (free/paid/all), keyword search. Paginated. Only visibility=public events
- **Frontend:** Discovery page with filter bar (country, type, date range, free/paid). Event card grid. Each card links to public event detail page. Optional auth: logged-in users see personalized content
- **Test:** Unit: filter queries. E2E: browse discovery page, apply filters, click through to event
- **Data:** No schema changes. Query across events table where visibility=public (or 'network' in current enum)

**BRs:** M8-R4 (visibility enforcement)
**ACs:** AC-M08-005 (visibility enforcement)
**Dependencies:** W2A-S3 (public event page exists to link to)

**Checklist:**
- [ ] Only public/network-visibility events shown
- [ ] Country filter derived from org's region field
- [ ] Draft, cancelled events excluded
- [ ] Pagination for large result sets
- [ ] Event cards match the same component from org event list

---

### W2A-S10: Post-Event Analytics (DEFERRED)

**Risk:** P3 | **Type:** new | **Complexity:** small | **Phase:** beta (if time permits)

**What:** Officer analytics after event completion: attendance rate, no-show rate, revenue collected, CPD hours distributed.

Deferred to end of beta or Wave 2b-beta. Not blocking any downstream work.

---

## Parallel Execution Groups

| Group | Slices | Why parallel |
|-------|--------|-------------|
| **Group 1** (sequential) | S1 → S2 → S5 | Foundation → CRUD → Registration (each needs prior) |
| **Group 2** (parallel with G1 after S1) | S3, S4 | Public page + slug/image infra independent of CRUD internals |
| **Group 3** (parallel after S5) | S6, S7 | Paid registration + waitlist don't depend on each other |
| **Group 4** (beta, parallel) | S8, S9 | Check-in + discovery are independent features |

**Recommended execution:**
1. S1 (schema) -- everyone waits on this
2. S2 + S3 + S4 in parallel (CRUD, public page, slug/image)
3. S5 (registration) after S2
4. S6 + S7 in parallel after S5
5. CHECKPOINT
6. S8 + S9 in parallel (beta)

## AC/BR Coverage Matrix

| AC/BR | Slice | Status |
|-------|-------|--------|
| AC-M08-001 (QR check-in security) | W2A-S8 | Covered |
| AC-M08-002 (capacity management) | W2A-S5, W2A-S7 | Covered |
| AC-M08-003 (paid event registration) | W2A-S6 | Covered |
| AC-M08-004 (event cancellation cascade) | W2A-S6 (refund), W2A-S7 (waitlist release) | Covered |
| AC-M08-005 (visibility enforcement) | W2A-S3, W2A-S9 | Covered |
| AC-M08-006 (post-completion lock) | W2A-S8 | Covered |
| BR-15 (credit-bearing events) | **UPDATED** -- credit-bearing events DO award credits via check-in attestation (W2A-S8 → Wave 2b pipeline) | Override |
| BR-16 (default visibility internal) | W2A-S1, W2A-S2 | Covered |
| BR-17 (officer-only check-in) | W2A-S8 | Covered |
| BR-18 (three-factor QR validation) | W2A-S8 | Covered |
| BR-27 (capacity → waitlist) | W2A-S5, W2A-S7 | Covered |
| M8-R1 (FIFO waitlist) | W2A-S7 | Covered |
| M8-R2 (payment before confirmed) | W2A-S6 | Covered |
| M8-R3 (cancel → refund + notify) | W2A-S6 | Covered |
| M8-R4 (visibility access control) | W2A-S3, W2A-S9 | Covered |
| M8-R5 (cancel releases capacity) | W2A-S5, W2A-S7 | Covered |
| M8-R6 (post-completion lock) | W2A-S8 | Covered |

**Coverage: 6/6 ACs, 11/11 BRs (BR-15 updated per design override)**

## PRD Gaps / Spec Conflicts

1. **BR-15 override:** MODULE_SPEC says "events never generate credit entries." Wave 2a design overrides: credit-bearing events (with cpdActivityType) DO generate credits via check-in attestation + pg-boss pipeline. MODULE_SPEC must be updated.
2. **Visibility enum mismatch:** MODULE_SPEC uses `internal`/`network`. Design doc uses `members-only`/`public`. Schema already has `internal`/`network`. **Decision: keep schema enum as-is**, map in frontend (`internal` → "Members only", `network` → "Public").
3. **Event cancellation refunds:** MODULE_SPEC says "process refunds via M06." Design doc defers refunds to beta (manual Stripe dashboard for alpha). **This is intentional scope deferral, not a gap.**

## What's Next

1. Update MODULE_SPEC BR-15 to reflect credit-bearing events override
2. Run `/oli-trace --phase C` to verify traceability
3. Execute slices in dependency order: S1 → (S2 || S3 || S4) → S5 → (S6 || S7) → CHECKPOINT → (S8 || S9)
