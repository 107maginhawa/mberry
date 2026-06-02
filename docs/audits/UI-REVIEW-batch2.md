# UI Review — Batch 2 (m06–m10)

**Audited:** 2026-06-02
**Scope:** dues-payments, communications, events, training, credit-tracking
**Method:** Code-only audit (no dev server). 6-pillar scoring against abstract standards + design-system tokens defined in `apps/memberry/src/styles/globals.css`.

**Scoring scale:** 1–10. Pillars: (1) Visual hierarchy & IA, (2) Interaction state coverage, (3) Design system alignment, (4) AI slop, (5) Responsive + a11y, (6) Trust + polish. Module score = simple average rounded to one decimal.

---

## m06 — Dues & Payments

**Primary user:** Member submitting proof of payment; Treasurer reviewing/recording.
**Primary task:** Upload GCash/bank receipt → see status → confirm renewal current.

| Pillar | Score | Evidence |
|---|---|---|
| 1. Hierarchy & IA | 8 | Strong: `DuesStatusCard` summary → `ArrearsBreakdown` → timeline → `Pay Dues` section → history. Scroll-to-pay CTA at `dues.tsx:182-184` ties hero to action. |
| 2. Interaction states | 8 | Loading skeletons (`dues.tsx:219-223,377-382`), error w/ retry (`dues.tsx:87-99`), empty (`dues.tsx:421-425`), rejected-resubmit branch (`dues.tsx:259-271`), submitted/confirmed/rejected payment branches. |
| 3. Design system | 7 | Mostly tokens (`var(--color-*)`, `text-h2/h3/h4`). Mixes arbitrary px sizes (`text-[13px]`, `text-[14px]` at `dues.tsx:238-275`) outside the declared `text-body/body-sm` scale — proliferation of inline sizes. |
| 4. AI slop | 6 | `(inv: any)`, `(p: any)`, `as any` casts throughout `dues.tsx:65,74,122-145,151,395`. IIFE for `duesStatus` derivation (`dues.tsx:111-119`) and `timelinePeriods` (`:127-146`) is over-engineered for the task. |
| 5. Responsive + a11y | 7 | Tabular nums, `aria-label` on export, scroll behavior. Missing: no `aria-live` on form submission state; file dropzone is a `<div>` with no keyboard handler (`proof-upload-form.tsx:184-213` — only clickable, no Enter/Space). |
| 6. Trust + polish | 8 | Receipt numbers monospaced, currency formatted `en-PH`, period range labels, "Need to renew immediately?" affordance for expired members (`dues.tsx:328-336`). CSV export present (`:387-390`). |

**Module: 7.3 / 10**

**Top findings:**
1. **P1 — File dropzone not keyboard-accessible** — `apps/memberry/src/features/dues/components/proof-upload-form.tsx:184-213` `div` with `onClick` only; no `role="button"`, `tabIndex`, or key handler. Members on keyboard can't upload proof.
2. **P2 — Arbitrary inline font sizes break the scale** — `apps/memberry/src/routes/_authenticated/org/$orgSlug/dues.tsx:238,242,251,255,275,330` repeats `text-[13px]/[14px]` instead of `text-body-sm`/`text-body`. Drift from the declared token system at `globals.css:247-252`.
3. **P2 — `any`-typed invoice/payment shapes** — `dues.tsx:65,74,122-146,395` — generated SDK types are bypassed via `select: (d: any) => d?.data ?? []`. Risks runtime breakage when SDK contracts evolve; loses the spec-first guarantee that's the whole point of `@monobase/sdk-ts`.

---

## m07 — Communications (announcements + chat/DM)

**Primary user:** Member reading announcements; officer composing; chat participants.
**Primary task:** Read updates from association; send/receive DMs.

| Pillar | Score | Evidence |
|---|---|---|
| 1. Hierarchy & IA | 7 | Member feed is clean (title → preview → date). Detail view: back button + `PageHeader` + `AnnouncementContent`. Chat: header/scroll/composer pattern (`chat-thread.tsx:66-119`) is standard. |
| 2. Interaction states | 8 | Announcements list: loading/error/empty all handled (`announcements/index.tsx:50-65`). Chat: pending/empty/error meta with `toast` (`chat-thread.tsx:40,72-78`). Detail page: loading/error/not-found (`$announcementId.tsx:35-66`). |
| 3. Design system | 5 | Hard-coded Tailwind colors `bg-blue-100 text-blue-800`, `bg-green-100 text-green-800`, `bg-red-100 text-red-800`, `bg-gray-100 text-gray-600` in `STATUS_BADGE` at `announcement-content.tsx:62-67` — bypasses semantic tokens used elsewhere (`bg-[var(--color-success-bg)]`). Mixed conventions across components. |
| 4. AI slop | 6 | `:announcement: any` in `$announcementId.tsx:28-31`, `(r) => r.event?.id` casts in event detail. `ChatThread` is clean; `compose-form` was tested. Detail page sets `orgId = orgSlug` (`$announcementId.tsx:22`) — wrong-named alias / pseudo-code-style comment, smells AI-generated. |
| 5. Responsive + a11y | 6 | Chat: `aria-label` on send button (`chat-thread.tsx:114`). Missing: announcements list cards have no semantic heading order (h3 inside Link not labeled as feed item); polling chat lacks `aria-live` region for new messages (`chat-thread.tsx:71`). |
| 6. Trust + polish | 7 | Real DOMPurify-less stripping (`announcements/index.tsx:83` `replace(/<[^>]*>/g, '')`) — okay for preview, but raw HTML reaches `AnnouncementContent` consumer unverified. Channel/audience badges shown in detail. |

**Module: 6.5 / 10**

**Top findings:**
1. **P1 — Hardcoded status badge palette diverges from token system** — `apps/memberry/src/features/communications/components/announcement-content.tsx:62-67` uses raw Tailwind palette (blue/green/red/gray-100/800) instead of `var(--color-success-bg)` etc. Dark mode will misbehave; brand drift.
2. **P2 — Chat thread has no `aria-live` for incoming messages** — `apps/memberry/src/features/comms/components/chat-thread.tsx:71` scroll container is silent to screen readers despite 5s polling. Assistive tech users miss every new message.
3. **P2 — `orgId = orgSlug` aliasing** — `apps/memberry/src/routes/_authenticated/org/$orgSlug/announcements/$announcementId.tsx:22` `const orgId = orgSlug` — likely wrong semantically (slug != id); either dead variable or latent bug.

---

## m08 — Events

**Primary user:** Member discovering/registering; officer running event lifecycle + post-event actions.
**Primary task:** Browse → register → attend → (officer) close out with credits/certs/thank-you.

| Pillar | Score | Evidence |
|---|---|---|
| 1. Hierarchy & IA | 8 | Listing: filter row → grid → empty state w/ filter-aware copy (`events/index.tsx:110-112`). Detail: cover hero → badges row → details grid → description → CTA (`$eventId.tsx:160-342`). Post-event has checklist UX (`post-event-actions.tsx:362-423`). |
| 2. Interaction states | 9 | Best in batch. Loading skeletons (`$eventId.tsx:120-134`), error empty (`:137-149`), registered/waitlisted/cancelled variants (`:267-340`), capacity-full join-waitlist (`:325-339`), paid/free fork (`:316-324`), per-mutation Loader2 spinners, retry pattern for failed-credit batch (`post-event-actions.tsx:302-305`). |
| 3. Design system | 7 | Uses tokens consistently (`var(--color-primary-bg)`, `var(--color-success-bg)`). Event detail has bespoke skeleton elements at `:99-101` instead of using `<Skeleton>` from `@monobase/ui` (used elsewhere). White-on-image badge `bg-white/90` (`event-card.tsx:85`) bypasses surface tokens. |
| 4. AI slop | 5 | Heavy `(event as any).coverImageUrl`, `(event as any).registrationFee`, `(event as any).creditBearing` (`$eventId.tsx:151-159,163-167,184-200,254-262`). `as unknown as { startDate?: string; start_date?: string }` reading both camel+snake (`events/index.tsx:55-58`) papers over inconsistent API shapes. `// eslint-disable-line @typescript-eslint/no-explicit-any` inline at `event-card.tsx:164` — explicit suppression. |
| 5. Responsive + a11y | 7 | Cover `alt=""` (decorative, defensible — `$eventId.tsx:168`). Grid responsive (`sm:grid-cols-2 lg:grid-cols-3`). `aria-label="Event actions"` on the menu button (`event-card.tsx:117`). Menu doesn't close on outside click / Esc — no `onBlur` or `Dialog` wrapper. |
| 6. Trust + polish | 8 | ICS calendar download (`$eventId.tsx:282-289`), Stripe checkout redirect (`:91-94`), idempotency-key on credit award (`post-event-actions.tsx:113`), `confirmText="REVOKE"` on destructive dialog (`:460`), 10-char min reason validation (`:232-234`), localStorage persistence of completion state (`:43-54`). |

**Module: 7.3 / 10**

**Top findings:**
1. **P1 — `(event as any)` field access bypasses generated types** — `$eventId.tsx:151-159,163-167,184-200,254-262` reads `coverImageUrl`/`registrationFee`/`creditBearing`/`description` as `any`. These should be in the SDK-generated `Event` type; if missing, the OpenAPI spec is wrong; if present, the casts are slop. Either way it's a contract-fidelity bug per `CLAUDE.md` "spec-first" mandate.
2. **P2 — Action menu has no outside-click / Esc dismiss** — `apps/memberry/src/features/events/components/event-card.tsx:112-159` toggles with local state but never closes except by re-clicking the trigger. Keyboard users are trapped; multiple menus can open at once.
3. **P2 — Officer post-event uses `localStorage` for cross-officer state** — `apps/memberry/src/features/events/components/post-event-actions.tsx:43-54` persists "creditsAwarded/certsGenerated/thankYouSent" per-browser. Treasurer doing credits + Secretary doing certs on different devices see desync. Should be server-derived.

---

## m09 — Training

**Primary user:** Member enrolling in CPE courses; officer managing catalog.
**Primary task:** Find training → enroll → complete → earn CPE credit.

| Pillar | Score | Evidence |
|---|---|---|
| 1. Hierarchy & IA | 7 | Org catalog: header → stagger grid of cards (`training/index.tsx:55-83`). `/my/training`: 4 stat cards → table → network-wide section (`my/training.tsx:86-206`). Clear progression. |
| 2. Interaction states | 8 | Loading via `CardSkeleton` (`training/index.tsx:39-44`), error w/ refresh prompt (`:46-48`), empty state w/ catalog CTA (`my/training.tsx:118-128`), per-row status badges. |
| 3. Design system | 5 | **Heavy** hardcoded Tailwind palette in `STATUS_STYLES` and `TRAINING_STATUS_STYLES` at `my/training.tsx:20-34` — `bg-green-100 text-green-700`, `bg-yellow-100 text-yellow-700`, etc., with manual dark variants. Identical pattern at `my-cpd.tsx:119`, `training/index.tsx:70`. Diverges from `var(--color-success-bg)` tokens used in dues/events. |
| 4. AI slop | 5 | `trainings.map((t: any)` (`training/index.tsx:57`), bigint-of-cast inside form-data, `(item.training.creditAmount)` mixed with `t.creditAmount ?? t.creditValue` (`my/training.tsx:198`) suggests API field churn paved over with optional chains. Network-wide section duplicates the same render block instead of extracting a component (`my/training.tsx:181-206`). |
| 5. Responsive + a11y | 6 | Table forced `min-w-[700px]` (`my/training.tsx:131`) for narrow phones — horizontal scroll only, no card-fallback layout. Stat cards collapse to `grid-cols-2` (good). `inline-flex` badges have no role/label for screen readers. |
| 6. Trust + polish | 7 | `CountUp` animations on stat cards, `tabular-nums` on numbers (`my/training.tsx:94`), CPE-credit badge consistent with my-cpd page. Cancel/waitlist/payment statuses all surfaced. |

**Module: 6.3 / 10**

**Top findings:**
1. **P1 — Status-badge color palette is hard-coded Tailwind, not tokens** — `apps/memberry/src/routes/_authenticated/my/training.tsx:20-34` (and mirror at `my-cpd.tsx:119`, `training/index.tsx:70`). 12 hardcoded `green-100/yellow-100/orange-100/red-100/blue-100` × dark variants. Theme switching + brand re-color will break. Should use `var(--color-{success,warning,info,error}-{bg})`.
2. **P2 — Member training table is mobile-hostile** — `apps/memberry/src/routes/_authenticated/my/training.tsx:131` `min-w-[700px]` forces a 6-column horizontal scroll on phones. Mobile users see partial info. Needs a card list at `sm:` breakpoint.
3. **P2 — Network-wide section render duplicates catalog card without abstraction** — `apps/memberry/src/routes/_authenticated/my/training.tsx:181-206` repeats the same `GlassCard` + title + credits-badge render pattern that's in `training/index.tsx:64-79`. Two places to fix; future drift guaranteed.

---

## m10 — Credit Tracking / Compliance

**Primary user:** Member tracking CPD progress; officer monitoring org-wide compliance.
**Primary task:** See credits earned vs required; see at-risk members.

| Pillar | Score | Evidence |
|---|---|---|
| 1. Hierarchy & IA | 7 | Member view: 3 KPI cards → category breakdown → history → action links (`my-cpd.tsx:57-138`). Officer view: 4-up summary → filterable standings table (`compliance.tsx:80-178`). Clear. |
| 2. Interaction states | 7 | Loading via `CardSkeleton`, error block, empty for both history and standings. Compliance refresh mutation with spinner (`compliance.tsx:69-77`). Missing: no partial/stale state when "refresh" has been clicked but old data still shows. |
| 3. Design system | 5 | Member view mixes `text-green-600/amber-600/red-600` (`my-cpd.tsx:50`) with `bg-amber-100 text-amber-700` (`:119`) and `text-[var(--color-primary)]` (`:65`). Officer view uses tokens correctly (`compliance.tsx:91-115`). Inconsistent within the same module. `bg-muted rounded-full h-2` progress bar (`compliance.tsx:154`) — `bg-muted` isn't a defined token; works only if shadcn theme exposes it. |
| 4. AI slop | 5 | `data as any`, `(data as any)?.data` (`my-cpd.tsx:23`, `compliance.tsx:40`), `report?.standings?.length > 0` truthy-check, `s.personId.slice(0, 8) + '...'` for member identifier (`compliance.tsx:150`) — officer-facing UI shows opaque hash. Self-describes "Credits need to be recorded first." (`:176`). |
| 5. Responsive + a11y | 6 | Officer table has `overflow-x-auto` but again forced wide. Progress bar has no `role="progressbar"` / `aria-valuenow` (`compliance.tsx:154-159`). KPI numbers not in `tabular-nums`. SDL-exceeded alert is a `<div>` not `role="alert"`. |
| 6. Trust + polish | 6 | "Compliant / At Risk / Non-Compliant" segmentation is solid. **Trust gap:** member IDs are truncated hashes (`compliance.tsx:150`) — useless for an officer trying to act. No row click to drill into a member's credit history. Hardcoded fallback "60 required" (`my-cpd.tsx:63`) is a magic number. |

**Module: 6.0 / 10**

**Top findings:**
1. **P1 — Officer compliance table shows truncated person IDs instead of names** — `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/compliance.tsx:150` `s.personId.slice(0, 8) + '...'`. Treasurer/President cannot identify "at risk" members to contact them. Blocks the primary officer task.
2. **P1 — Progress bar lacks ARIA semantics** — `compliance.tsx:154-159` plain `<div>` with width style; no `role="progressbar"`, `aria-valuenow`, `aria-valuemin/max`, or text label. Screen-reader users get no progress info.
3. **P2 — Inconsistent color usage between my-cpd and compliance** — `my-cpd.tsx:50,87,119` mixes raw Tailwind palette + tokens; `compliance.tsx` uses tokens. Same module, two systems.

---

## Cross-batch observations

1. **Token-vs-raw-Tailwind drift is systemic.** Modules m07/m09/m10 use raw `bg-{color}-100 text-{color}-700` palettes; m06/m08 mostly use `var(--color-*-bg)` tokens. The token system at `apps/memberry/src/styles/globals.css:247-252` is defined but un-enforced. **Action:** lint rule banning bare color palette in app code, or codify status-badge as a single `<StatusBadge>` component (note: `components/patterns/status-badge.tsx` exists — adopt it everywhere).
2. **`as any` / `as unknown` casts pervasive on SDK responses.** ~14 in three routes alone; ~33+ hardcoded palettes module-wide. Pattern is `select: (d: any) => d?.data ?? []` to unwrap the ApiListResponse envelope. The generated `@monobase/sdk-ts` should expose typed unwrappers; until then, the spec-first guarantee in `CLAUDE.md` is decorative. **Action:** add `ApiListResponse<T>` generic helper to SDK, ban `: any` in route handlers via ESLint.
3. **Stateful UI persisted to localStorage where server-state would be correct** — m08 `post-event-actions.tsx:43-54` checklist state. Multi-officer workflows desync. **Action:** derive completion state from server (credit entries exist? certs issued? messages sent?) instead of localStorage flags.
4. **A11y gaps cluster around custom interactive elements** — file dropzones (m06), action menus (m08), progress bars (m10), polling regions (m07). Custom-built primitives skip keyboard/ARIA contracts. **Action:** wrap each in shadcn-radix primitive or add a CI a11y check.
5. **Mobile table-only fallbacks** — m09 `/my/training`, m10 compliance, m06 payment history all use `overflow-x-auto` instead of responsive card-stacks. Each is fine alone; collectively they signal "phone is second-class."

---

## Files Audited

Routes: `dues.tsx`, `announcements/index.tsx`, `announcements/$announcementId.tsx`, `events/index.tsx`, `events/$eventId.tsx`, `training/index.tsx`, `my/training.tsx`, `my-cpd.tsx`, `officer/compliance.tsx`.

Features sampled: `dues/components/proof-upload-form.tsx`, `dues/components/dues-status-card.tsx`, `events/components/event-card.tsx`, `events/components/post-event-actions.tsx`, `communications/components/announcement-content.tsx`, `communications/components/announcement-list.tsx` (header), `comms/components/chat-thread.tsx`.

Tokens reference: `apps/memberry/src/styles/globals.css:247-252` (type scale).

Greps: hardcoded color palette (33 hits), `as any/unknown` casts (14 in three routes), `console.log` (0), `aria-label`/`role` (4 hits in sampled cards).
