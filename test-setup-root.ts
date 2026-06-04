// Root bun:test preload — three responsibilities:
//
// 1. Skip Playwright E2E spec files picked up by Bun's auto-discovery
//    (Bun has no `testPathIgnorePatterns`).
// 2. Register happy-dom globals so React Testing Library can mount components
//    without a Vite/Vitest environment.
// 3. Register @testing-library/jest-dom matchers so existing tests using
//    `.toBeInTheDocument()` etc. continue to pass.
//
// The Vitest API (`import { vi, ... } from 'vitest'`) is handled by a
// workspace-local shim file at `src/test/vitest-shim.ts` in each app; test
// files import it via the `@/test/vitest-shim` alias.

import { plugin } from 'bun';
import { expect, afterEach } from 'bun:test';
// Direct path imports — these packages are installed at apps/memberry but the
// root has no devDep declaration; resolve against the workspace install tree.
import { GlobalRegistrator } from './apps/memberry/node_modules/@happy-dom/global-registrator/lib/index.js';
import matchersDefault from './apps/memberry/node_modules/@testing-library/jest-dom/dist/matchers.js';

// --- 1. Skip Playwright specs --------------------------------------------------
plugin({
  name: 'skip-playwright-specs',
  setup(build) {
    build.onLoad({ filter: /[/\\]tests[/\\]e2e[/\\].*\.spec\.ts$/ }, () => ({
      contents: '// skipped under bun:test runner (Playwright spec)\nexport {};\n',
      loader: 'ts',
    }));
  },
});

// --- 2. Register happy-dom globals --------------------------------------------
// Preserve Bun's native Request/Response/Headers BEFORE happy-dom overrides them.
// happy-dom enforces the Fetch spec's "forbidden request headers" list (cookie,
// host, etc.), which breaks backend tests that call `app.request('/x', { headers: { cookie: ... } })`.
const NativeRequest = (globalThis as any).Request;
const NativeResponse = (globalThis as any).Response;
const NativeHeaders = (globalThis as any).Headers;

if (!GlobalRegistrator.isRegistered) {
  GlobalRegistrator.register();
}

// Restore native fetch primitives so backend Hono apps see the unrestricted forms.
// Frontend tests render via React Testing Library on happy-dom's DOM, which is
// independent of these primitives.
if (NativeRequest) (globalThis as any).Request = NativeRequest;
if (NativeResponse) (globalThis as any).Response = NativeResponse;
if (NativeHeaders) (globalThis as any).Headers = NativeHeaders;

// --- 2b. Stub global fetch by default — frontend tests that don't override
//         must not hit the network. Returns an empty JSON 200 by default.
//         Backend tests (services/api-ts/**) call app.request() directly on
//         Hono apps and don't use the global fetch, so this is safe.
const ORIGINAL_FETCH = (globalThis as any).fetch;
(globalThis as any).__originalFetch = ORIGINAL_FETCH;
(globalThis as any).fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  // Allow loopback (localhost) calls so middleware integration tests can spin up Hono on a port if needed.
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)/.test(url) && ORIGINAL_FETCH) {
    return ORIGINAL_FETCH(input, _init);
  }
  return new Response(JSON.stringify({ data: [], items: [], pagination: { totalCount: 0 } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

// --- 3. Register @testing-library/jest-dom matchers --------------------------
expect.extend(matchersDefault as Record<string, any>);

// --- 3b. RTL cleanup between tests — bun:test does not auto-cleanup happy-dom
//         DOM nodes the way Vitest does, so multiple renders accumulate.
try {
  // Dynamic require to avoid hard-failing in environments without RTL.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rtl = require('./apps/memberry/node_modules/@testing-library/react/dist/index.js');
  if (typeof rtl.cleanup === 'function') {
    afterEach(() => rtl.cleanup());
  }
} catch {
  // RTL not installed at this path — skip.
}

// --- 3c. Globally overridable router state (used by tests that need to control
//         useLocation / useNavigate / useParams without mocking the whole module).
(globalThis as any).__routerParams = (globalThis as any).__routerParams ?? {};
(globalThis as any).__routerSearch = (globalThis as any).__routerSearch ?? {};
(globalThis as any).__routerLocation = (globalThis as any).__routerLocation ?? { pathname: '/', search: '', hash: '' };
(globalThis as any).__routerNavigate = (globalThis as any).__routerNavigate ?? (() => {});

// Router stub — proxies most exports to the REAL @tanstack/react-router (so
// `createFileRoute(...)` returns a proper Route object with `.options.component`
// accessible from tests). Only hooks (useLocation, useNavigate, useParams,
// useSearch) are overridden so tests can drive them via globalThis state.
import { mock as _bunMock } from 'bun:test';

const _realRouterPath = require.resolve('./apps/admin/node_modules/@tanstack/react-router');
const _realRouter = require(_realRouterPath);

_bunMock.module('@tanstack/react-router', () => {
  // Lazy-require React from the workspace install tree.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('./apps/memberry/node_modules/react/index.js');
  return {
    ..._realRouter,
    useParams: () => (globalThis as any).__routerParams ?? {},
    useSearch: () => (globalThis as any).__routerSearch ?? {},
    useLocation: () => (globalThis as any).__routerLocation ?? { pathname: '/', search: '', hash: '' },
    useNavigate: () => (globalThis as any).__routerNavigate ?? (() => {}),
    useRouter: () => ({ navigate: (globalThis as any).__routerNavigate ?? (() => {}) }),
    useRouteContext: () => ({}),
    useMatch: () => ({}),
    useLoaderData: () => undefined,
    Link: ({ children, to, ...props }: any) =>
      React.createElement('a', { href: String(to ?? ''), ...props }, children),
  };
});

// SDK stub — global mock with ALL real exports stubbed to jest.fn() factories.
// jest.fn() instances support `.mockReturnValue()` so tests that do
// `const m = sdkExport as ReturnType<typeof vi.fn>; m.mockReturnValue(...)` work.
// Local `vi.mock('@monobase/sdk-ts/generated/react-query', () => ({ ... }))`
// in tests REPLACES this stub entirely for that file, so tests that mock only
// a subset will see SyntaxError for unmocked exports their component imports.
// Tests should spread the global stub: `{ ...realStub, X: vi.fn() }` —
// or rely on the global stub directly and use `(realExport as any).mockReturnValue(...)`.
const _sdkStub = require('./packages/sdk-ts/src/generated/__test-stub__react-query.ts');
_bunMock.module('@monobase/sdk-ts/generated/react-query', () => _sdkStub);
_bunMock.module('@monobase/sdk-ts/generated/@tanstack/react-query.gen', () => _sdkStub);

// --- 4. Seed AUTH_SECRET so tests that load services/api-ts/core/config don't
//        trip the production zod-superRefine guard. Tests that intentionally
//        exercise the missing-secret branch override this via withEnv().
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = 'test-secret-32-characters-minimum-xx';
}
