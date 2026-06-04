/**
 * oli-runtime.config.ts — per-repo configuration for the OLI runtime loop.
 *
 * GENERATED ONCE by `/oli-check --runtime --live` (executor.md), then committed
 * and hand-tuned. The runner (`oli-runtime-loop.spec.ts`) reads this + the
 * CODE_* maps at run time and needs NO regeneration as routes/components grow.
 */
export interface DataSurfaceBinding {
  /** Route (CODE_ROUTE_MAP key, parameterized form e.g. /_workspace/$patientId) the surface lives on. */
  route: string;
  /** testid of the element that OPENS the surface (the tab/button). */
  openerTestid: string;
  /** testid of the surface that should appear after opening (the sheet/panel). */
  surfaceTestid: string;
  /** Human label for findings. */
  label: string;
  /** Component name from CODE_COMPONENT_REGISTRY (provenance; the map's loading_state_hygiene candidate). */
  component?: string;
}

export interface OliRuntimeConfig {
  baseURL: string;
  /**
   * Admin app origin. Memberry product app runs on 3004; admin ops dashboard
   * runs on 3003 (apps/admin/vite.config.ts → server.port=3003). Routes in
   * CODE_ROUTE_MAP tagged `module: "apps/admin"` (e.g. /associations/$associationId,
   * /organizations/$organizationId, /members/$personId) must be navigated
   * against this origin.
   */
  adminBaseURL: string;
  mapsDir: string;
  resultsOut: string;
  contractVersion: number;
  skeletonCeilingMs: number;
  skeletonSelectors: string;
  loadingTextSource: string;
  ignoreUrlSource: string;
  testids: Record<string, string>;
  dataSurfaces: DataSurfaceBinding[];
  paramFixtures: Record<string, string>;
  denyRoutes: string[];
  maxTargets: number;
  navLinkCheck: boolean;
}

export const config: OliRuntimeConfig = {
  baseURL: "http://localhost:3004",
  // TODO: confirm admin baseURL — apps/admin/vite.config.ts pins port 3003 in
  // dev; CI / staging may proxy this behind a different host.
  adminBaseURL: "http://localhost:3003",
  // Playwright runs with cwd = apps/memberry; maps + results live at repo root.
  mapsDir: "../../docs/audits/codebase-map",
  resultsOut: "../../docs/audits/runtime/runtime-exec-results.json",
  contractVersion: 6,

  // Memberry's data hooks settle fast (TanStack Query w/ generated SDK +
  // local-network postgres). A 2s ceiling catches the infinite-skeleton class
  // (query stuck pending, error swallowed silently) without false-failing on
  // a legitimate slow first-paint.
  skeletonCeilingMs: 2000,
  skeletonSelectors:
    '[aria-busy="true"], .skeleton, [data-loading="true"], [data-testid$="-skeleton"], [data-testid$="-loader"]',
  loadingTextSource: "\\b(loading|saving|fetching|please wait)\\b",
  ignoreUrlSource:
    "\\.(png|jpe?g|svg|gif|webp|ico|woff2?|ttf|css|map)(\\?|$)|/@vite/|/__vite|/hmr|/node_modules/|analytics|posthog|sentry|onesignal|intercom|hotjar|fullstory|segment",

  testids: {},

  // First-run: left empty. Tier-3 page-load + nav-links + 4xx-inclusive capture
  // run across all resolvable routes regardless. data-surface opener/surface
  // bindings need human review (grep app for opener+surface data-testids) before
  // they assert anything — see RUNTIME_EXEC_REPORT.md "needs human review".
  dataSurfaces: [],

  // orgSlug is the dominant param across /_authenticated/org/$orgSlug/* routes.
  // pda-metro-manila is the seeded NCR chapter (layer-1-foundation.ts) the seed
  // member belongs to. `slug` covers the public /org/$slug route.
  paramFixtures: {
    orgSlug: "pda-metro-manila",
    slug: "pda-metro-manila",
    authView: "sign-in",
  },

  // Auth flows the runner can't navigate post-sign-in (would either bounce to a
  // post-login redirect or invalidate the seeded session). Public marketing
  // routes are still walked.
  denyRoutes: [
    '/auth/sign-in',
    '/auth/sign-up',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email',
    '/auth/verify-email-better-auth',
    '/auth/sign-out',
    '/auth/email-otp',
    '/auth/two-factor',
    '/auth/recovery-code',
    '/auth/$authView',
    '/join/$inviteToken',
    '/verify-email',
    '/oauth-callback',
  ],
  maxTargets: 500,
  navLinkCheck: true,
};
