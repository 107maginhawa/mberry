/**
 * Clause 1 of the journey DoD — "no silent error surface".
 *
 * A success-path test must FAIL if the running app emitted an unexpected
 * error the UI swallowed: a JS `pageerror`, a `console.error`, or an
 * unhandled 4xx/5xx API response. Expected errors are declared explicitly
 * via allow-lists.
 *
 * The decision logic lives in pure functions (`isUnexpectedApiFailure`,
 * `isUnexpectedConsoleError`) so it is unit-tested without a browser
 * (error-surface.test.ts). `attachErrorSurface` is the thin Playwright glue
 * shared by the auto `page` fixture (test-fixture.ts) AND by multi-context
 * specs that create pages via `browser.newContext()` (J1, J5) and therefore
 * never touch the fixture's default `page`.
 *
 * Strictness is OPT-IN. The legacy default (5xx + pageerror fail; 4xx +
 * console.error are warn-only) is preserved so the ~140 existing specs are
 * unaffected. Must-never-break journeys opt into full clause-1 enforcement.
 */
import { expect, type Page } from '@playwright/test'

const BUILTIN_CONSOLE_IGNORES = [
  'Download the React DevTools',
  'Encountered two children with the same key',
  // Chromium's native log of a failed fetch ("Failed to load resource: …").
  // Network failures are classified by isUnexpectedApiFailure (with allow-list
  // semantics); the console clause must not double-count them.
  'Failed to load resource',
]

const allowed = (text: string, rules: RegExp[]): boolean => rules.some((rx) => rx.test(text))

/**
 * Should this API response fail the test?
 * - Only `/api/` and `/auth/` paths are in scope.
 * - 5xx is always unexpected (unless allow-listed).
 * - 4xx is unexpected only when `failOn4xx` is set (unless allow-listed).
 */
export function isUnexpectedApiFailure(opts: {
  pathname: string
  status: number
  method: string
  allow: RegExp[]
  failOn4xx: boolean
}): boolean {
  const { pathname, status, method, allow, failOn4xx } = opts
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/auth/')) return false
  if (status < 400) return false
  if (status < 500 && !failOn4xx) return false
  const key = `${method} ${pathname} → ${status}`
  return !allowed(key, allow)
}

/**
 * Should this console.error fail the test?
 * - Built-in framework noise is always ignored.
 * - When `failOnConsoleError` is off (legacy default), nothing fails.
 */
export function isUnexpectedConsoleError(
  text: string,
  opts: { allow: RegExp[]; failOnConsoleError: boolean },
): boolean {
  if (BUILTIN_CONSOLE_IGNORES.some((s) => text.includes(s))) return false
  if (!opts.failOnConsoleError) return false
  return !allowed(text, opts.allow)
}

export interface ErrorSurfaceOptions {
  /** Console.error patterns to tolerate (e.g. known dev warnings). */
  allowConsoleErrors?: RegExp[]
  /** API-failure keys to tolerate, matched against `METHOD /path → status`. */
  allowApiFailures?: RegExp[]
  /** Fail on unhandled 4xx (clause-1 strict). Default false (legacy). */
  failOnUnexpected4xx?: boolean
  /** Fail on unexpected console.error. Default false (legacy warn-only). */
  failOnConsoleError?: boolean
}

/**
 * Attach clause-1 listeners to a page. Returns an assert function the caller
 * runs after the success path completes (the fixture calls it post-`use`;
 * multi-context specs call it before closing each context).
 */
export function attachErrorSurface(page: Page, opts: ErrorSurfaceOptions = {}): () => void {
  const allowConsoleErrors = opts.allowConsoleErrors ?? []
  const allowApiFailures = opts.allowApiFailures ?? []
  const failOnUnexpected4xx = opts.failOnUnexpected4xx ?? false
  const failOnConsoleError = opts.failOnConsoleError ?? false

  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const apiFailures: string[] = []

  page.on('pageerror', (err) => {
    pageErrors.push(err.stack || err.message)
  })

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (isUnexpectedConsoleError(text, { allow: allowConsoleErrors, failOnConsoleError })) {
      consoleErrors.push(text)
    }
  })

  page.on('response', (res) => {
    const req = res.request()
    if (!['fetch', 'xhr'].includes(req.resourceType())) return
    try {
      const url = new URL(res.url())
      if (
        isUnexpectedApiFailure({
          pathname: url.pathname,
          status: res.status(),
          method: req.method(),
          allow: allowApiFailures,
          failOn4xx: failOnUnexpected4xx,
        })
      ) {
        apiFailures.push(`${req.method()} ${url.pathname} → ${res.status()}`)
      }
    } catch {
      // URL parse failure — skip
    }
  })

  // Returned assert. `expect` is imported lazily to keep the pure functions
  // above importable under `bun test` without pulling in @playwright/test.
  return () => {
    expect(pageErrors, 'Clause 1: unhandled page errors during success path').toEqual([])
    expect(apiFailures, 'Clause 1: unhandled API 4xx/5xx during success path').toEqual([])
    expect(consoleErrors, 'Clause 1: unexpected console.error during success path').toEqual([])
  }
}
