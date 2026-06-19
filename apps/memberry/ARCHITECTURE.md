# apps/memberry — Architecture

## Tech Stack

- **React 19** with `@vitejs/plugin-react`
- **Vite 7** — dev server, build, preview
- **TanStack Router** — file-based routing (`src/routes/`), type-safe navigation
- **TanStack Query** — server state, caching, generated hooks
- **Better-Auth** (`better-auth` + `@daveyplate/better-auth-tanstack`) — session management, sign-in/sign-up/verify
- **react-hook-form + zod** — form validation
- **sonner** — toast notifications (not shadcn `useToast`)
- **@monobase/ui** — shared UI primitives (shadcn/Radix-based)
- **@monobase/sdk-ts** — auto-generated TanStack Query hooks and API types from OpenAPI spec

## Directory Layout

```
src/
├── routes/             # File-based route tree (TanStack Router)
│   ├── __root.tsx      # Root layout + router context setup
│   ├── _authenticated.tsx  # Auth guard layout (wraps all protected routes)
│   ├── auth/           # /auth/$authView (sign-in, sign-up, …)
│   ├── org/$orgSlug/   # Org-scoped routes
│   │   ├── officer/    # Officer-gated subroutes
│   │   └── …
│   ├── join/           # /join/$slug, /join (public)
│   ├── invite/         # /invite/$token (public)
│   ├── pay/            # /pay/$token (public)
│   ├── verify/         # /verify/$id (public)
│   ├── discover/       # /discover/events (public)
│   └── dashboard.tsx   # /dashboard (authenticated)
├── features/           # Feature modules
│   ├── account/
│   ├── admin/
│   ├── billing/
│   ├── booking/
│   ├── certificates/
│   ├── chapters/
│   ├── comms/
│   ├── communications/
│   ├── dashboard/
│   ├── directory/
│   ├── documents/
│   ├── dues/
│   ├── elections/
│   ├── events/
│   ├── invite/
│   ├── membership/
│   ├── notifications/
│   ├── onboarding/
│   ├── person/
│   ├── profile/
│   ├── surveys/
│   └── training/
├── providers/          # React context providers
│   └── OrgProvider.tsx # Org+officer-role resolution for /org/$orgSlug/*
├── components/
│   ├── layout/         # App shell components (MemberSidebar, MemberHeader, …)
│   ├── patterns/       # Reusable UI patterns (ErrorBoundary, …)
│   └── motion/         # Framer Motion helpers
├── hooks/              # Shared custom hooks (use-my-orgs, …)
├── lib/                # Thin API client and utilities
│   └── api.ts          # Hand-rolled fetch client for non-generated calls
├── utils/
│   └── guards.ts       # Composable route guards (see Routing & Auth below)
└── test/               # Test helpers (not colocated)
    ├── setup.ts         # Vitest global setup
    ├── vitest-shim.ts   # Environment shims
    └── utils.tsx        # renderWithProviders and test utilities
```

Each feature in `src/features/<name>/` follows the structure:

```
features/<name>/
├── components/   # UI components (*.tsx, *.test.tsx colocated)
├── hooks/        # Feature-specific hooks
└── lib/          # Feature-specific utilities / helpers
```

## Routing & Auth

### Auth guard layout

`src/routes/_authenticated.tsx` is the layout route that wraps all authenticated pages. Its `beforeLoad` calls `requireAuth`, which redirects to `/auth/sign-in` if no session is present.

### Composable guards (`src/utils/guards.ts`)

Exported guards used in route `beforeLoad`:

| Guard | Purpose |
|-------|---------|
| `requireAuth` | Session must exist. Redirects to `/auth/$authView` (sign-in) with `?redirect=` param. |
| `requireGuest` | User must NOT be signed in. Redirects to `/` if logged in. |
| `requirePerson` | Person profile must exist. Redirects to `/onboarding` if missing. |
| `requireNoPerson` | Person profile must NOT exist (for onboarding). Redirects to `/dashboard` if present. |
| `requireEmailVerified` | Email must be verified. Redirects to `/verify-email` if not. |
| `requireNotEmailVerified` | Email must NOT be verified (for verify-email page). Redirects to `/dashboard` if already verified. |
| `requireOrgOfficer` | User must be an active officer for the org in `$orgSlug`. Returns officer positions in route context. |
| `composeGuards` | Combines multiple guards into a single `beforeLoad` handler. |

### Org scoping (`src/providers/OrgProvider.tsx`)

`/org/$orgSlug/*` routes are wrapped by `OrgProvider`, which resolves the slug to an org UUID, fetches the current user's officer positions for that org, and exposes `{ org, orgId, orgSlug, role, officerPositions, isOfficer, isLoading }` via context. The `$orgSlug` segment accepts both slug strings and raw UUIDs (post-migration back-compat).

Officer-gated subroutes live under `/org/$orgSlug/officer/*`. They use `requireOrgOfficer` in their `beforeLoad`.

### Auth path

Sign-in is at `/auth/sign-in` (routed via `/auth/$authView`). There is no `/login` route.

### Public routes

These routes are accessible without authentication:

| Route | Purpose |
|-------|---------|
| `/auth/$authView` | Sign-in, sign-up, forgot-password, etc. |
| `/join/$slug` | Org join page |
| `/join` | Generic join landing |
| `/invite/$token` | Org invitation acceptance |
| `/pay/$token` | Payment link |
| `/verify/$id` | Email/identity verification link |
| `/discover/events` | Public event discovery |
| `/events/$eventSlug` | Public event detail |

## Data Fetching

- **Generated hooks** from `@monobase/sdk-ts` (e.g. `useGetMembership`, `useListDuesInvoices`, `useCreateBooking`) cover the majority of API calls. Import from `@monobase/sdk-ts/generated/react-query`.
- **`@/lib/api`** — a thin fetch client used for hand-rolled calls not yet in the generated SDK.
- **`OrgProvider`** centralises org and officer-role resolution; child routes/components read from context rather than re-fetching.
- All mutations go through TanStack Query's `useMutation`. Use `sonner` (`toast.success` / `toast.error`) for feedback — not shadcn `useToast`.

## Testing Conventions

### Unit tests

- Colocated with source: `src/features/<name>/components/Foo.test.tsx` next to `Foo.tsx`.
- Import test helpers from `@/test/vitest-shim` (environment shims) and `renderWithProviders` from `@/test/utils`.
- Run via the isolated runner (`bun run test`) which auto-isolates files that `vi.mock` local siblings.
- Run flat (no isolation) with `bun run test:flat` or `bun run test:watch` from the repo root.

Exemplar unit tests:
- `src/features/dues/components/arrears-breakdown.test.tsx`
- `src/features/dues/components/record-payment-form.test.tsx`

### E2E tests

- Located under `tests/e2e/`, matched by `**/*.spec.ts`.
- Run with `bun run test:e2e` (headless) or `bun run test:e2e:headed`.
- Playwright pinned to `1.58.2` — version `1.59` breaks `test.describe`; do not bump until upstream fix confirmed.
- Global setup in `tests/e2e/global-setup.ts` resets mutated seed rows before workers spawn.
- Specs that mutate shared seed state opt out of parallel execution via `test.describe.configure({ mode: 'serial' })`.
