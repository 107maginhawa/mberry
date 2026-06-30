# 012 — Members Directory (Slice 2)

> Slice 2 of the `apps/org` membership-management build.
> Design source of truth: [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md)
> §"Screen 1 — MEMBERS" + Round-2 review A1–A4 + Build sequence step 2.
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> **Classification: FRONTEND-ONLY** — every endpoint already exists in the FROZEN engine.
> No TypeSpec / handler / migration / SDK change. (`+ Add member` verified to reuse
> `importRosterMembers`, NOT a net-new handler — scope-lock "verify create-single-member" resolved.)

## Goal

Turn the Members tab (home `/`) into the real directory: the officer opens the app and *sees her
members*, searches/filters them, adds one mid-year, and bulk-sends renewal pay-links. Replaces
today's `Roster.tsx` (which uses the thinner `listOrgMembers`) with the richer
`listRosterMembers` record (status + dues + since-date + tier per row).

## Persona audit (done)

**Persona:** Dr. Olive — chapter PRESIDENT (covers the roster role-gate), older dentist, mobile,
renewal-season grind. Single officer persona; role nuance below.

**JOURNEY: "see + manage my members"**
| Step | Verdict |
|------|---------|
| Entry | ✓ Members tab = home `/` |
| Discovery | ✓ search box + filter chips (All/Unpaid/Lapsed/Due) |
| Action | ✓ tap a row → detail (Slice 3); `+ Add member`; multi-select → Send pay-link to N |
| Feedback | ✓ count strip; toast on add; existing BulkResults panel on send |
| Error | ✓ list error → ErrorState+retry; 403 (wrong role / no 2FA) → friendly role=alert |
| Recovery | ✓ add duplicate → "already a member" (importRosterMembers `skipped`); failed row → reason |
| Exit | ✓ stays on directory; new member appears after refetch |

**Gaps folded in (from design Round-2 A1–A4):**
1. **First-run empty state** — zero members ⇒ calm EmptyState with `Import roster` + `Add member`
   CTAs, never a blank/scary screen. (Note: freshly-imported members are `active`, so they read as
   "Active", not 200 scary "unpaid" rows — the calm post-import state is satisfied by the status
   derivation, not a special banner.)
2. **Add ONE member** — small form over `importRosterMembers` one-row payload (no CSV on a phone).
3. **Bulk pay-link survives the new IA** — preserve today's multi-select → Send pay-link.
4. **Graceful role-gate** — Secretary/Society-Officer/President allowed; Treasurer or no-2FA ⇒
   friendly notice, not a raw 403.

**Out-of-journey gaps (deferred, named):** ₱-outstanding in the strip (`generateDuesReport` is
TREASURER/PRESIDENT-gated + needs aggregation → v1.x); `Due soon` amber highlighting (v1.x); the
member-detail screen itself = Slice 3.

## Grounded engine facts (anchor to HANDLER, not SDK types)

- `listRosterMembers` → `GET /association/member/roster`. **Returns `{ data, totalCount }`** (handler
  `ctx.json({ data, totalCount: result.total })`) — the generated validator's `pagination{}` envelope
  is DRIFT; anchor mocks/types to `{ data, totalCount }`.
- Query params: `organizationId` (required), `page`, `pageSize` (≤100), `search`, `status` (enum),
  `duesStatus` (string), `categoryId`. Row fields incl: `name`, `email`, `status`, `memberNumber`,
  `categoryName`, `tier`(categoryName), `duesExpiryDate` (Date via transformer), `joinedAt` (Date),
  `duesInvoiceStatus`. Status enum: `pendingPayment|active|gracePeriod|lapsed|expired|suspended|…`.
- Status → StatusBadge map: `pendingPayment→pending`, `active→active`, `gracePeriod→grace`,
  `lapsed→lapsed`, `suspended→suspended` (StatusBadge known set: active/grace/lapsed/pending/suspended).
- **Unpaid derivation** = `status==='pendingPayment'` OR `duesInvoiceStatus ∈ {generated,sent,overdue}`.
  Chips map to the server `status` param (Unpaid→`pendingPayment`, Lapsed→`lapsed`, Due→`gracePeriod`).
  ⚠️ v1 approximation: the Unpaid chip's server filter catches `pendingPayment` but not
  `active`-with-open-invoice; documented, refined when `duesStatus` enum is confirmed. Per-row badge
  still shows the full derivation.
- `importRosterMembers` → `POST /association/member/roster/import`, body
  `{ organizationId, tierId, members: [{ firstName?, lastName?, email?, licenseNumber?, memberNumber? }] }`.
  One-row OK. Needs `email` OR `licenseNumber`; `firstName` if creating new. Returns
  `{ imported, skipped, failed, errors[] }`. Tiers from `listMembershipTiers` (already used in `/import`).
- Bulk send: reuse `apps/org/src/features/roster/use-bulk-send.ts` (per-member `listDuesInvoices` →
  `sendPaymentLink`) + `BulkResults`. Single-row "Send pay-link" link → `/members/$membershipId/send`.

## Tasks (vertical, FE-only)

1. **`use-members` hook** — wraps `listRosterMembers` with `{ orgId, page, search, statusFilter }`;
   returns drift-anchored rows (`{ data, totalCount }`), `status` (idle/loading/ready/empty/error),
   refetch. Money/dates already coerced by the response transformer.
2. **`MembersDirectory` feature** (replaces `Roster`): AppHeader-less main; search `Input`;
   filter chips (`ToggleGroup`: All/Unpaid/Lapsed/Due); thin count strip (`{totalCount} members`
   + active tally); list-item rows (name + `StatusBadge` + one present-facts meta line:
   `Member since {joinedAt} · {tier}` or `· ₱due`); `Skeleton`/`EmptyState`/`ErrorState`. Desktop
   reflow to `Table` via container width. Tap row → member detail route (Slice 3) — for now the
   existing send-link deep link stays reachable.
3. **`AddMemberDialog`** — `Dialog` + form (firstName, lastName, email or license, tier `Select`);
   submit → `importRosterMembers` one-row; toast success / "already a member" (skipped) / error;
   refetch. No confirm step (not a money action).
4. **Bulk send** — multi-select checkboxes + "Send pay-link to N" toolbar; reuse `use-bulk-send` +
   `BulkResults` + the money confirm step that flow already has.
5. **Wire `/` (index route)** to `MembersDirectory`; keep `/members/$id/send` reachable.
6. **Tests:** `use-members` unit (drift-anchored `{data,totalCount}`, filter→param mapping, empty);
   `MembersDirectory` component (rows, chips drive refetch, empty state, role-403 friendly);
   `AddMemberDialog` (one-row payload shape, skipped/failed messaging); E2E real flow — sign in →
   directory lists → filter Unpaid → add a member → bulk-select → send pay-link. Anchor mocks to
   the **handler** `{ data, totalCount }` shape (not SDK `pagination`).

## Scope locks honored

Engine/specs/SDK untouched (all frozen endpoints). DESIGN.md: 18px, ≥48px taps, `StatusBadge`
text+color, `centavosToPhp`, money-action confirm (bulk send), labeled controls, mobile-first,
no new abstractions, `packages/ui` only. Drift guard: anchor to handler shapes + typecheck tests.

## Verification (step d)

`bun dev`; sign in as president; `/` lists real roster; Unpaid filter ⇒ `status=pendingPayment`
query; fresh org ⇒ EmptyState with Import/Add CTAs; `+ Add member` creates one (appears on refetch);
bulk-select sends N pay-links via the existing confirm flow; wrong-role/no-2FA ⇒ friendly notice.
Gates: ui+org typecheck, full org unit + e2e, build, lint:no-skips/shallow. Engine untouched.
