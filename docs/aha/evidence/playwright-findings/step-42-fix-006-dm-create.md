# Step 42 — FIX-006 DM creation — verification evidence

**Date:** 2026-06-13
**Fix:** FIX-006 (G3) — DM creation flow (member-picker → `createChatRoom{ roomType:'dm' }`)

## Component + body-builder nets (GREEN)

`bun test apps/memberry/src/features/comms/__tests__/dm-member-picker.test.tsx`

```
3 pass / 0 fail / 12 expect() calls
```

Proves:
- `buildDmCreateBody(me, them, org)` emits `{ roomType:'dm', organizationId, participants:[me,them], upsert:true }`, no `context` hack.
- `buildDmCreateBody` dedupes duplicate participants.
- `DmMemberPicker`: typing a search term lists org roster members (self excluded),
  clicking a colleague calls the **real** `createChatRoomMutation` with
  `{ body: <valid dm body> }`, and on success opens the new room + closes the dialog.

Full comms feature suite: `bun test apps/memberry/src/features/comms/` → **38 pass / 0 fail**.
Typecheck (memberry workspace): `bunx tsc --noEmit` → **0 errors**.

## Live browse (E2E) — [BLOCKED BY ENVIRONMENT]

Dev stack up (app :3004 → 200, API :7213 → reachable), but `/browse goto
http://localhost:3004/` redirects to `/auth/sign-in` — no authenticated session
and no seeded org/roster in this environment. The full E2E (sign in → open
`/messages` DM tab → pick a colleague → DM opens + persists) cannot run headless
without auth + seed data.

Per `04-module-or-group-fix-tdd.md` §6 (#9) the E2E is proven via the component +
body-builder nets above and marked `[BLOCKED BY ENVIRONMENT]`. Playwright spec not
added this pass (would require auth fixtures + roster seed); pin Playwright 1.58.2
per `project_playwright_pin` when the live stack is available.
