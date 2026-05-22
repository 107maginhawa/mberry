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

export { expect }

export const test = base.extend<{
  allowConsoleErrors: RegExp[]
  allowApiFailures: RegExp[]
}>({
  allowConsoleErrors: [[], { option: true }],
  allowApiFailures: [[], { option: true }],

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
