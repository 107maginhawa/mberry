# Phase 8: Frontend Unit Tests - Research

**Researched:** 2026-05-06
**Domain:** Vitest + @testing-library/react for Vite/React frontend
**Confidence:** HIGH

## Summary

The memberry app has `@testing-library/react`, `@testing-library/user-event`, and `happy-dom` already installed as devDependencies. Vitest is NOT installed. The `test` script is `bun test src/` — which runs Bun's native test runner, not Vitest.

There are 6 existing lib unit tests in `src/features/*/lib/`, all using `bun:test` — EXCEPT `fund-math.test.ts` which imports from `vitest` (broken — vitest not installed, so that test silently fails under `bun test`). There are no component tests (`.test.tsx`) anywhere.

Phase 7 completed: components now import from `@monobase/ui` (Button, Badge, Input, Skeleton, Checkbox, Select, Tabs, etc.) instead of local files. The `src/components/ui/` directory was deleted. Component tests must mock or use `@monobase/ui` exports.

The CI `unit-tests` job only runs `cd services/api-ts && bun test` — frontend unit tests are NOT wired into CI. Phase success requires adding a frontend unit test step.

**Primary recommendation:** Install Vitest, configure it with `happy-dom`, add `vitest` script to package.json, fix `fund-math.test.ts` imports, write component tests for `MemberDashboard`, `DuesInvoiceList`, and `MemberTable`, then add a step to the CI `unit-tests` job.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — infrastructure phase, discuss skipped.

### Claude's Discretion
All implementation choices are at Claude's discretion. Use ROADMAP phase goal, success criteria, and codebase conventions.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-07 | Frontend unit tests exist for critical Memberry app components (vitest + testing-library) | Vitest + @testing-library/react already in devDeps; need vitest install + config + component tests for dashboard, dues table, member list |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Unit test config | Frontend (build tool) | CI workflow | Vitest runs in Vite context; config lives with the app |
| Component rendering tests | Frontend (Browser/jsdom) | — | @testing-library/react renders components in happy-dom |
| Lib/utility tests | Frontend (Node-like) | — | Pure functions, no DOM; bun:test or vitest both work |
| CI integration | GitHub Actions | — | New step in `unit-tests` job |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.5 (registry) | Test runner for Vite projects | Vite-native, zero-config with Vite, same transform pipeline |
| @testing-library/react | 16.3.2 (installed) | Component rendering + queries | Industry standard for React component tests |
| @testing-library/user-event | 14.6.1 (installed) | User interaction simulation | Realistic events vs fireEvent |
| happy-dom | 20.9.0 (installed) | DOM environment | Faster than jsdom, works with Vitest |

[VERIFIED: npm registry — versions confirmed via `npm view <pkg> version`]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/jest-dom | ^6 | Extended matchers (toBeInTheDocument, etc.) | Add for richer assertions on DOM elements |
| vitest/coverage-v8 | bundled with vitest | Coverage reports | Optional, add when coverage gate needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Bun test (`bun:test`) | Bun test works for pure libs but lacks Vite transform; can't handle CSS imports, Radix UI, `@monobase/ui` path aliases without extra setup |
| happy-dom | jsdom | jsdom heavier and slower; happy-dom adequate for component tests |

**Installation:**
```bash
cd apps/memberry && bun add -d vitest @testing-library/jest-dom
```
(`@testing-library/react`, `@testing-library/user-event`, `happy-dom` already installed)

**Version verification:** vitest 4.1.5 confirmed via npm registry. [VERIFIED: npm registry]

## Architecture Patterns

### System Architecture Diagram

```
vitest.config.ts (extends vite.config.ts)
        │
        ▼
Vitest runner (Vite transform pipeline)
        │
   ┌────┴────────────────────┐
   │                         │
lib tests                component tests
(pure functions)         (React components)
fund-math, money,        MemberDashboard,
visibility, etc.         DuesInvoiceList,
                         MemberTable
        │                         │
        ▼                         ▼
   Node env               happy-dom (browser-like)
                          + @testing-library/react
                          + mock: useQuery, useRouter
```

### Recommended Project Structure
```
apps/memberry/
├── vitest.config.ts          # new — vitest config
├── src/
│   ├── test/
│   │   └── setup.ts          # new — jest-dom matchers import
│   └── features/
│       ├── dashboard/
│       │   └── components/
│       │       └── member-dashboard.test.tsx  # new
│       ├── dues/
│       │   └── components/
│       │       └── dues-invoice-list.test.tsx # new
│       │   └── lib/
│       │       └── fund-math.test.ts          # fix import: vitest -> bun:test OR keep vitest
│       └── membership/
│           └── components/
│               └── member-table.test.tsx      # new
```

### Pattern 1: Vitest Config for Vite App
**What:** Extends existing `vite.config.ts` so aliases and plugins are inherited
**When to use:** Always — avoids duplicating tsconfig paths, proxy config

```typescript
// apps/memberry/vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
}))
```
[ASSUMED — pattern from Vitest docs; mergeConfig API confirmed in Vitest docs]

### Pattern 2: Setup File
```typescript
// apps/memberry/src/test/setup.ts
import '@testing-library/jest-dom'
```

### Pattern 3: Component Test with Mocked useQuery
**What:** Test component rendering with mocked TanStack Query data
**When to use:** Components that call `useQuery` — mock at the hook level, not at network level

```tsx
// Example: member-dashboard.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock @tanstack/react-query useQuery
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

// Mock @tanstack/react-router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}))
```
[ASSUMED — standard pattern for testing TanStack Query components]

### Pattern 4: Existing Lib Tests — Unify to Vitest
`fund-math.test.ts` already imports from `vitest`. The other 5 lib tests use `bun:test`. After installing Vitest, update lib tests to `import { describe, test, expect } from 'vitest'` for consistency. [VERIFIED: codebase grep]

### Anti-Patterns to Avoid
- **Testing implementation details:** Test what renders, not internal state. Use `screen.getByText`, `screen.getByRole`, not component refs.
- **Mocking too much:** Don't mock `@monobase/ui` components — let them render; they're just Radix wrappers with no network calls.
- **Using `bun test` for component tests:** Bun's native runner lacks Vite transform; CSS modules and path aliases break. Use `vitest` for `.test.tsx`.
- **Mixing `bun:test` and `vitest` imports:** Pick one runner. Since Vitest is needed for components, migrate all lib tests to `vitest` imports.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM environment | Custom JSDOM setup | happy-dom (already installed) | Pre-configured, faster |
| Query wrapper in tests | Manual QueryClientProvider boilerplate per test | Helper factory function in test/utils.tsx | DRY across all component tests |
| Router mock | Partial @tanstack/react-router stub | `vi.mock('@tanstack/react-router', ...)` | Router `<Link>` used in MemberDashboard, MemberTable |
| API mock | MSW service worker | `vi.mock('@/lib/api')` | Simpler for unit tests; MSW warranted for integration |

## Common Pitfalls

### Pitfall 1: TanStack Router `<Link>` in happy-dom
**What goes wrong:** `@tanstack/react-router` Link requires a router context; rendering without it throws "No RouterContext found"
**Why it happens:** Link reads from RouterContext at render time
**How to avoid:** Mock the entire `@tanstack/react-router` module: `vi.mock('@tanstack/react-router', () => ({ Link: ({children, to}) => <a href={to}>{children}</a> }))`
**Warning signs:** "RouterContext" error in test output

### Pitfall 2: @monobase/ui path resolution
**What goes wrong:** `@monobase/ui` is a workspace package that exports from `./src/index.ts` — Vitest must resolve it via the Vite alias/tsconfig paths
**Why it happens:** `mergeConfig(viteConfig, ...)` inherits `vite-tsconfig-paths` plugin; workspace: protocol must be in bun.lock
**How to avoid:** Use `mergeConfig` pattern so tsconfig paths resolve; verify with `bun install` run before tests
**Warning signs:** "Cannot find module @monobase/ui" errors

### Pitfall 3: `bun:test` vs `vitest` import split
**What goes wrong:** 5 existing lib tests import `{ describe, test, expect } from 'bun:test'`; `fund-math.test.ts` imports from `vitest`. Running `vitest` on all `src/**/*.test.ts` will fail the `bun:test` imports.
**Why it happens:** Tests were written before this phase; no unified runner decision was made
**How to avoid:** Migrate all 6 existing lib tests to use `vitest` imports (trivial find-replace). Remove `bun:test` imports.
**Warning signs:** "Cannot find package 'bun:test'" in vitest output

### Pitfall 4: `test` script still points to `bun test`
**What goes wrong:** `package.json` has `"test": "bun test src/"` — this won't run vitest
**Why it happens:** Was pre-existing before this phase
**How to avoid:** Change to `"test": "vitest run"` and add `"test:watch": "vitest"`; update CI `unit-tests` job to run `cd apps/memberry && bun run test`
**Warning signs:** Tests pass locally with `vitest` but CI runs old command

### Pitfall 5: TanStack Query requires QueryClient in test tree
**What goes wrong:** Components using `useQuery` or `useMutation` need a `QueryClient` provider or they throw
**Why it happens:** React context not provided in test render
**How to avoid:** Create a `renderWithProviders` helper that wraps with `QueryClientProvider` and a fresh `QueryClient` per test. Set `retry: 0` on the test QueryClient.
**Warning signs:** "No QueryClient set, use QueryClientProvider" console error

## Code Examples

### vitest.config.ts
```typescript
// Source: Vitest documentation (mergeConfig pattern)
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
}))
```

### Test utility wrapper
```tsx
// src/test/utils.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'

export function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}
```

### MemberDashboard component test pattern
```tsx
// src/features/dashboard/components/member-dashboard.test.tsx
import { screen } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import { MemberDashboard } from './member-dashboard'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={String(to)}>{children}</a>,
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}))

describe('MemberDashboard', () => {
  test('renders empty state when no memberships', async () => {
    renderWithProviders(<MemberDashboard />)
    expect(await screen.findByText('No memberships yet')).toBeInTheDocument()
  })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| bun:test for all | vitest for component tests | This phase | Enables DOM testing with Vite transform |
| No component tests | @testing-library/react component tests | This phase | TEST-07 requirement |

**Deprecated/outdated:**
- `"test": "bun test src/"` — replace with `"test": "vitest run"` after vitest installed

## Runtime State Inventory

Not applicable — greenfield test infrastructure addition, no rename/migration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Build + test runner | ✓ | 1.2.21 | — |
| Node.js (via bun) | Vitest runtime | ✓ | via bun | — |
| @testing-library/react | Component tests | ✓ | 16.3.2 (installed) | — |
| @testing-library/user-event | Interaction tests | ✓ | 14.6.1 (installed) | — |
| happy-dom | DOM environment | ✓ | 20.9.0 (installed) | — |
| vitest | Test runner | ✗ | Not installed | None — must install |
| @testing-library/jest-dom | DOM matchers | ✗ | Not installed | Use basic expect assertions |

**Missing dependencies with no fallback:**
- vitest — must install: `cd apps/memberry && bun add -d vitest`

**Missing dependencies with fallback:**
- @testing-library/jest-dom — not strictly required but strongly recommended; without it, assertions are verbose (check text content instead of `toBeInTheDocument`)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (to be installed) |
| Config file | `apps/memberry/vitest.config.ts` (Wave 0 — create) |
| Quick run command | `cd apps/memberry && bun run test` |
| Full suite command | `cd apps/memberry && bun run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-07 | MemberDashboard renders org cards / empty state | unit | `cd apps/memberry && bun run test` | ❌ Wave 0 |
| TEST-07 | DuesInvoiceList renders invoice rows / loading state | unit | `cd apps/memberry && bun run test` | ❌ Wave 0 |
| TEST-07 | MemberTable renders member rows, status tabs, filters | unit | `cd apps/memberry && bun run test` | ❌ Wave 0 |
| TEST-07 | Vitest configured and `bun run test` exits 0 | infra | `cd apps/memberry && bun run test` | ❌ Wave 0 |
| TEST-07 | Unit tests run in CI alongside E2E and contract | ci | GitHub Actions `unit-tests` job | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/memberry && bun run test`
- **Per wave merge:** `cd apps/memberry && bun run test`
- **Phase gate:** All vitest tests green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/memberry/vitest.config.ts` — Vitest config extending vite.config.ts
- [ ] `apps/memberry/src/test/setup.ts` — jest-dom import
- [ ] `apps/memberry/src/test/utils.tsx` — renderWithProviders helper
- [ ] `apps/memberry/src/features/dashboard/components/member-dashboard.test.tsx`
- [ ] `apps/memberry/src/features/dues/components/dues-invoice-list.test.tsx`
- [ ] `apps/memberry/src/features/membership/components/member-table.test.tsx`
- [ ] Fix `apps/memberry/src/features/dues/lib/fund-math.test.ts` — `vitest` import already correct; other 5 lib tests need import migration from `bun:test` → `vitest`
- [ ] Update `apps/memberry/package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`
- [ ] Add step to `.github/workflows/ci.yml` `unit-tests` job: `cd apps/memberry && bun run test`
- [ ] Install: `cd apps/memberry && bun add -d vitest @testing-library/jest-dom`

## Security Domain

Security enforcement enabled (ASVS Level 1). Unit tests for frontend UI components have minimal security surface — no auth, no crypto, no input processing at the API boundary.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | Tests don't process user input through validation |
| V6 Cryptography | no | — |

No ASVS controls required for this phase (test infrastructure only).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `mergeConfig(viteConfig, ...)` correctly inherits tsconfig paths plugin and resolves `@monobase/ui` | Code Examples / Pitfall 2 | If not, need explicit `resolve.alias` in vitest.config.ts |
| A2 | `vi.mock('@/lib/api')` path resolves correctly via tsconfig paths in test context | Code Examples | If not, use relative path `../../lib/api` in mock |
| A3 | `@tanstack/react-router` mock fully satisfies Link usage in components | Code Examples | Some components may use useRouter, useParams — mock would need expansion |

## Open Questions

1. **Should lib tests stay on `bun:test` or migrate to `vitest`?**
   - What we know: 5 lib tests use `bun:test`; `fund-math.test.ts` uses `vitest`; running `vitest` on all `src/**/*.test.ts` would fail `bun:test` imports
   - What's unclear: Whether the project wants to split runners (vitest for components, bun test for libs)
   - Recommendation: Migrate all 6 lib tests to `vitest` imports — trivial, eliminates runner split, simplifies CI to one command

2. **CI `unit-tests` job currently needs Postgres/Minio services but frontend unit tests don't**
   - What we know: The `unit-tests` job has full service spin-up just for `bun test` in api-ts
   - What's unclear: Should frontend tests run in same job (wasteful services) or separate job
   - Recommendation: Add a separate lightweight `unit-tests-frontend` job or add the memberry step to the existing job (services are harmless if unused)

## Sources

### Primary (HIGH confidence)
- Codebase grep — `apps/memberry/package.json`, all test files, `vite.config.ts`, `ci.yml` [VERIFIED]
- npm registry — vitest 4.1.5, @testing-library/react 16.3.2, happy-dom 20.9.0 [VERIFIED]

### Secondary (MEDIUM confidence)
- Vitest `mergeConfig` pattern — standard documented approach for Vite apps [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages already installed (except vitest), versions verified from registry
- Architecture: HIGH — all component code read directly; patterns derived from actual code structure
- Pitfalls: HIGH — runner split and missing vitest directly observed in codebase

**Research date:** 2026-05-06
**Valid until:** 2026-08-06 (vitest version may advance; patterns stable)
