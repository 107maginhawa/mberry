# apps/admin — Architecture

## Tech stack

- **Runtime**: Bun
- **UI framework**: React 19 + Vite 7
- **Routing**: TanStack Router v1 (file-based, `src/routes/`)
- **Data fetching**: TanStack Query v5 + auto-generated hooks from `@monobase/sdk-ts/generated/react-query`
- **UI components**: `@monobase/ui` (shadcn/Radix primitives), `lucide-react` icons
- **Toasts**: sonner
- **Styling**: Tailwind CSS v3
- **Language**: TypeScript 5

## Directory layout

```
apps/admin/
├── src/
│   ├── routes/              # File-based route tree (TanStack Router)
│   │   ├── __root.tsx       # Root layout: auth check, sidebar, mobile gate
│   │   ├── index.tsx        # Dashboard (/)
│   │   ├── associations/
│   │   ├── audit/
│   │   ├── committees/
│   │   ├── communications/  # index + moderation, templates, email sub-routes
│   │   ├── compliance/
│   │   ├── events/
│   │   ├── feature-flags/
│   │   ├── impersonate/
│   │   ├── members/
│   │   ├── national-dashboard/
│   │   ├── operators/
│   │   ├── organizations/
│   │   ├── surveys/
│   │   ├── training/
│   │   └── verifications/
│   ├── components/
│   │   └── patterns/        # Shared UI patterns (tables, filters, etc.)
│   ├── lib/
│   │   ├── role-gate.tsx    # AdminUserContext, useAdminUser, RequireRole, ROUTE_ROLES
│   │   └── utils.ts         # Shared utilities
│   ├── test/
│   │   ├── utils.tsx        # renderWithProviders + MOCK_*_ADMIN fixtures
│   │   ├── setup.ts         # Per-app test setup
│   │   └── routes/          # Unit tests per route
│   └── styles/
│       └── globals.css
├── tests/
│   └── e2e/                 # Playwright E2E specs
├── .env.example
├── bunfig.toml              # Points to root bunfig.toml (preload: test-setup-root.ts)
├── vite.config.ts
└── package.json
```

> The root `bunfig.toml` (monorepo root) configures `preload = ["./test-setup-root.ts"]`
> which is picked up by all `bun test` runs originating from the repo root.

## Auth & roles

### No in-app login UI

The admin app has no sign-in page. Authentication is delegated entirely to the memberry app.

**Flow:**

1. On startup, `main.tsx` calls `getAdminRole()` (API: `GET /platformadmin/role`). This returns the authenticated user's email, name, and role — or fails if the session cookie is absent.
2. If the call succeeds, the `AdminUser` is stored in `AdminUserContext` and passed to the TanStack Router `context`.
3. The root route (`__root.tsx`) runs `beforeLoad`. If `context.auth.user` is null, it immediately sets `window.location.href` to `${VITE_MEMBERRY_URL}/auth/sign-in?redirect=admin` and throws a redirect. No admin page is rendered.
4. Once authenticated, every page renders inside the root layout with the sidebar.

### Role model

Three roles are defined in `src/router.ts`:

```ts
export interface AdminUser {
  email: string
  name: string
  role: 'super' | 'support' | 'analyst'
}
```

| Role | Access level |
|---|---|
| `super` | Full access — all routes including operators, national dashboard, feature flags, impersonation |
| `support` | Operational access — associations, organizations, members, verifications, events, committees, communications, impersonation, audit |
| `analyst` | Read-only access — associations, organizations, members, compliance, training, surveys, communications email |

### RequireRole and ROUTE_ROLES coupling

Two independent mechanisms enforce role access, and **they must stay in sync**:

1. **`RequireRole` (route-level gate)** — wraps a route's component. Checks `useAdminUser().role` against the `allowed` prop. If the role is not allowed, renders an "Access Denied" panel. Fails closed.

2. **`ROUTE_ROLES` (sidebar nav filter)** — a `Record<string, AdminRole[]>` mapping every route path to its allowed roles. The sidebar reads this to hide links the current user cannot access.

**The coupling risk (FIX-007):** If a route's `RequireRole` is updated but `ROUTE_ROLES` is not (or vice versa), the sidebar and the route-level gate diverge — a user may see a nav link they cannot access, or find a usable route hidden from the sidebar. Always update both in the same change.

**Full access matrix** (from `src/lib/role-gate.tsx`):

| Route | super | support | analyst |
|---|---|---|---|
| `/` (dashboard) | yes | yes | yes |
| `/associations` | yes | yes | yes |
| `/organizations` | yes | yes | yes |
| `/members` | yes | yes | yes |
| `/verifications` | yes | yes | — |
| `/compliance` | yes | yes | yes |
| `/events` | yes | yes | — |
| `/training` | yes | yes | yes |
| `/national-dashboard` | yes | — | — |
| `/committees` | yes | yes | — |
| `/operators` | yes | — | — |
| `/impersonate` | yes | yes | — |
| `/feature-flags` | yes | — | — |
| `/audit` | yes | yes | — |
| `/surveys` | yes | yes | yes |
| `/communications` | yes | yes | — |
| `/communications/moderation` | yes | yes | — |
| `/communications/templates` | yes | — | — |
| `/communications/email` | yes | yes | yes |

### Mobile gate

`__root.tsx` renders a `MobileGate` overlay (`lg:hidden`, i.e. below 1024px) that blocks the entire UI. The admin dashboard is desktop-only.

## Data fetching

All API calls go through generated TanStack Query hooks from `@monobase/sdk-ts/generated/react-query`. The Vite dev proxy rewrites `/api/*` → `http://localhost:7213/*`, so hooks use relative `/api` URLs with no environment variable needed locally.

For mutations that are not covered by the generated hooks, the raw SDK functions from `@monobase/sdk-ts/generated/sdk.gen` are called directly.

## Testing conventions

### Unit tests (bun:test + React Testing Library)

- Test files: `src/test/routes/*.test.tsx`
- Runner: `bun test` (run from monorepo root as `bun test apps/admin/src`)
- Harness: `src/test/utils.tsx`
  - `renderWithProviders(ui, { user? })` — wraps component in `AdminUserContext.Provider` + `QueryClientProvider`. Defaults to `MOCK_SUPER_ADMIN`.
  - `MOCK_SUPER_ADMIN`, `MOCK_SUPPORT_ADMIN`, `MOCK_ANALYST_ADMIN` — pre-built `AdminUser` fixtures for all three roles.
- SDK auto-mock: the root `test-setup-root.ts` (preloaded via root `bunfig.toml`) stubs all exports of `@monobase/sdk-ts/generated/react-query` as `jest.fn()` factories. Tests prime specific hooks per-test via `.mockImplementation(...)`.
- `@tanstack/react-router` hooks (`useLocation`, `useNavigate`, `useParams`, `useSearch`) are overridden in `test-setup-root.ts` to read from `globalThis.__routerParams` etc., so tests can drive router state without mounting a full router.

### Deep exemplar

`src/test/routes/impersonate.test.tsx` demonstrates the full pattern:
- SDK gen mock (`mock.module('@monobase/sdk-ts/generated/sdk.gen', ...)`)
- `listPersonsOptions` stub primed per-test via `.mockImplementation`
- Role-gate assertions (renders vs. "Access Denied") for all three roles
- `userEvent` interaction (typing, clicking) with `waitFor` assertions

### E2E tests (Playwright)

- Specs: `tests/e2e/*.spec.ts`
- Runner: `bunx playwright test` (from `apps/admin/`)
- Config: `playwright.config.ts`
- The root `test-setup-root.ts` preload no-ops E2E spec files when Bun's test runner auto-discovers them (Bun has no `testPathIgnorePatterns`).
