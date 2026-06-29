# @monobase/org

The officer PWA for a PH dental chapter: roster import, dues, events,
announcements, pay-links, and PayMongo payment settings. It is a thin
React/Vite app over the frozen `services/api-ts` engine, built on the shared
`@monobase/ui` design system. See [`../../DESIGN.md`](../../DESIGN.md) for the
design law and [`../../CLAUDE.md`](../../CLAUDE.md) for engine conventions.

## Commands

Run from the repo root.

| Purpose            | Command                                      | Notes                                                      |
|--------------------|----------------------------------------------|-----------------------------------------------------------|
| Dev                | `bun run --filter @monobase/org dev`         | Vite on **:3005**                                         |
| Test (unit/comp)   | `bun run --filter @monobase/org test`        | Vitest                                                     |
| E2E                | `bun run --filter @monobase/org test:e2e`    | Playwright; needs the dev server on :3005 (specs stub the API via `page.route`) |
| Typecheck          | `bun run --filter @monobase/org typecheck`   | `tsc --noEmit` (app + test config)                        |

## Feature-folder convention

Each feature lives in `src/features/<name>/`: a `use-*.ts` data hook +
`Component.tsx` + co-located `*.test.ts(x)`. Pages live in `src/routes/`.

## Multi-org model

The selected org id is stored in `localStorage` under the `org.selectedOrgId`
key (`src/features/org/use-org.ts`) and injected as the `x-org-id` header on
org-scoped requests by `src/lib/api.ts`. Org-scoped React Query keys include the
`orgId` so switching orgs refetches.

## CSRF

`src/lib/api.ts` mirrors the CSRF cookie token into the `x-csrf-token` header on
mutating, non-allowlisted requests. Its `CSRF_EXEMPT_PREFIXES` must track the
server allowlist in `services/api-ts/src/app.ts`.

## SDK drift convention

The generated `@monobase/sdk-ts` types can diverge from the real handler shapes
(money is bigint on the wire; some response envelopes are nested). Hooks
deliberately `Number()`-coerce money and use narrow `as any` casts at the SDK
seam, each with an inline comment. Never edit generated SDK files; never edit the
frozen engine — coerce at the app boundary.

## Error messages

Officer-facing errors must be plain language for older, non-technical users — see
`src/lib/friendly-error.ts`.
