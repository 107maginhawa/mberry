/**
 * Shared Playwright test fixture with global error listeners (clause 1 of
 * the journey DoD — "no silent error surface").
 *
 * Catches: unhandled `pageerror`, `console.error`, and unhandled API
 * 4xx/5xx responses during a success path. The decision logic + listener
 * wiring live in `helpers/error-surface.ts` so multi-context specs (which
 * make pages via `browser.newContext()` and never touch this fixture's
 * `page`) share the exact same enforcement via `attachErrorSurface`.
 *
 * Strictness is OPT-IN, preserving the legacy default for the ~140 existing
 * specs: 5xx + pageerror always fail; 4xx + console.error are tolerated
 * unless a spec sets `failOnUnexpected4xx` / `failOnConsoleError`.
 *
 * Per-test config:
 *   test.use({
 *     failOnUnexpected4xx: true,
 *     failOnConsoleError: true,
 *     allowApiFailures: [/GET \/api\/billing\/merchant-accounts\/me → 404/],
 *   })
 *
 * Usage:
 *   import { test, expect } from '../helpers/test-fixture'
 *   // instead of: import { test, expect } from '@playwright/test'
 */

import { test as base, expect } from '@playwright/test'
import type { AuthRole } from './auth-state'
import { freshAuthState } from './programmatic-auth'
import { attachErrorSurface } from './error-surface'

export { expect }
export type { AuthRole }

export const test = base.extend<{
  allowConsoleErrors: RegExp[]
  allowApiFailures: RegExp[]
  /** Clause-1 strict: fail on unhandled 4xx (default false — legacy). */
  failOnUnexpected4xx: boolean
  /** Clause-1 strict: fail on unexpected console.error (default false). */
  failOnConsoleError: boolean
  /**
   * Persona to authenticate as. Specs opt in with
   * `test.use({ authRole: 'officer' })` — replaces the retired
   * `test.use({ storageState: authStateFile('officer') })` pattern.
   * Unset → unauthenticated context (same as no storageState).
   */
  authRole: AuthRole | undefined
}>({
  allowConsoleErrors: [[], { option: true }],
  allowApiFailures: [[], { option: true }],
  failOnUnexpected4xx: [false, { option: true }],
  failOnConsoleError: [false, { option: true }],
  authRole: [undefined, { option: true }],

  // Derive the built-in `storageState` from `authRole`: when set, mint a FRESH
  // session per test via the API (helpers/programmatic-auth.ts) instead of
  // reusing a long-lived .auth/<role>.json file. This removes the 401-cascade
  // class entirely — no spec depends on an aged/evicted/revoked shared session
  // (CONTINUE-55/56). Depending on `authRole` (not on storageState itself)
  // sidesteps fixture self-recursion and lets the default `context` fixture
  // keep applying viewport/device-emulation/etc.
  storageState: async ({ authRole }, use) => {
    const state = authRole ? await freshAuthState(authRole) : undefined
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use()`, not a React hook
    await use(state)
  },

  page: async (
    { page, allowConsoleErrors, allowApiFailures, failOnUnexpected4xx, failOnConsoleError },
    use,
  ) => {
    const assertNoErrorSurface = attachErrorSurface(page, {
      allowConsoleErrors,
      allowApiFailures,
      failOnUnexpected4xx,
      failOnConsoleError,
    })

    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use()`, not a React hook
    await use(page)

    assertNoErrorSurface()
  },
})
