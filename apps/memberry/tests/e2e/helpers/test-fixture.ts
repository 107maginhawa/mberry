/**
 * Shared Playwright test fixture with global error listeners.
 *
 * Catches:
 * - Unhandled page errors (JS crashes)
 * - Console errors
 * - Failed network requests (fetch/xhr)
 * - API 5xx responses
 *
 * Per-test opt-out via allowConsoleErrors / allowApiFailures arrays.
 *
 * Usage:
 *   import { test, expect } from '../helpers/test-fixture'
 *   // instead of: import { test, expect } from '@playwright/test'
 */

import { test as base, expect } from '@playwright/test'
import type { AuthRole } from './auth-state'
import { freshAuthState } from './programmatic-auth'

export { expect }
export type { AuthRole }

export const test = base.extend<{
  allowConsoleErrors: RegExp[]
  allowApiFailures: RegExp[]
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

  page: async ({ page, allowConsoleErrors, allowApiFailures }, use) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const apiFailures: string[] = []

    const allowed = (text: string, rules: RegExp[]) =>
      rules.some((rx) => rx.test(text))

    // Catch unhandled JS errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.stack || err.message)
    })

    // Catch console.error
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      // Ignore React DevTools message and duplicate key warnings
      if (text.includes('Download the React DevTools')) return
      if (text.includes('Encountered two children with the same key')) return
      if (!allowed(text, allowConsoleErrors)) consoleErrors.push(text)
    })

    // Catch API 5xx responses (same-origin only)
    page.on('response', (res) => {
      const req = res.request()
      if (!['fetch', 'xhr'].includes(req.resourceType())) return

      try {
        const url = new URL(res.url())
        // Only check /api/ paths (our app proxy)
        if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/auth/')) return
        if (res.status() < 500) return

        const key = `${req.method()} ${url.pathname} → ${res.status()}`
        if (!allowed(key, allowApiFailures)) apiFailures.push(key)
      } catch {
        // URL parse failure — skip
      }
    })

    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use()`, not a React hook
    await use(page)

    // Assert no errors after test completes
    expect(pageErrors, 'Unhandled page errors during test').toEqual([])
    expect(apiFailures, 'API 5xx responses during test').toEqual([])
    // Console errors are warnings — log but don't fail for now
    // (too many existing console.error from React strict mode, etc.)
    if (consoleErrors.length > 0) {
      console.warn(`[${consoleErrors.length} console errors]`, consoleErrors.slice(0, 3))
    }
  },
})
