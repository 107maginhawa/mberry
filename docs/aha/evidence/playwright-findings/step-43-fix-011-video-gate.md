# Step 43 — FIX-011 video-call panel gate — evidence

## Scope
Gate `VideoCallPanel` behind the `comms_video_calls` release flag (m07 MODULE_SPEC
`:392`, default false). Honest-state fix: flag OFF (default) → "Video calls aren't
available yet." card, no join control, no `joinVideoCallMutation`, no peer
connection. Flag ON → existing join UI unchanged. FE-only; no TypeSpec/schema/
regen/SDK.

## Component proof (RED → GREEN)
New test: `apps/memberry/src/features/comms/__tests__/video-call-panel.test.tsx`
- RED (before gate): flag-OFF honest-state assertion failed; `useFeatureFlag`
  never called by the panel (1/3 pass — only the pre-existing-UI case passed).
- GREEN (after gate): `bun test .../video-call-panel.test.tsx` → 3 pass / 0 fail / 6 expect().
  - flag OFF (default): honest "unavailable" card renders; no Start/Join control;
    no VideoCallUI surface mounts (join path unreachable).
  - flag OFF: panel reads the correct key `commsVideoCalls`.
  - flag ON + enabled: pre-existing Start/Join control mounts (gate is a real
    branch, not a permanent hide).

## Suite + typecheck
- `bun test apps/memberry/src/features/comms/` → 41 pass / 0 fail (38 Step-42
  baseline + 3 new). No regressions.
- `bunx tsc --noEmit` (apps/memberry) → exit 0, clean.

## Live E2E
`[BLOCKED BY ENVIRONMENT]` — booking-detail page `/my/bookings/$bookingId` is
behind `_authenticated`; app :3004 redirects to `/auth/sign-in` with no seeded
auth session/booking (confirmed Step 42, `step-42-fix-006-dm-create.md`). Gate
proven via the component nets above.

## Flag hook
New: `apps/memberry/src/features/comms/hooks/use-feature-flag.ts` — `useFeatureFlags()`
+ `useFeatureFlag(key)` fetch `GET /feature-flags` (no `/api` prefix; SDK base URL
is the API origin) via TanStack Query; fail-closed to `false` on loading/error/absent.
