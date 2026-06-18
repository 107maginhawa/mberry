// Unit tests for the clause-1 (silent error surface) decision logic.
// Pure functions — no browser/stack. Run: `bun test error-surface`
import { describe, expect, test } from 'bun:test'
import { isUnexpectedApiFailure, isUnexpectedConsoleError } from './error-surface'

describe('isUnexpectedApiFailure (clause 1 — unhandled 4xx/5xx)', () => {
  const base = { method: 'GET', allow: [] as RegExp[], failOn4xx: true }

  test('ignores non-api/non-auth paths', () => {
    expect(
      isUnexpectedApiFailure({ ...base, pathname: '/assets/x.js', status: 404 }),
    ).toBe(false)
  })

  test('passes a 2xx success', () => {
    expect(
      isUnexpectedApiFailure({ ...base, pathname: '/api/persons/me', status: 200 }),
    ).toBe(false)
  })

  test('flags an unhandled 5xx even when failOn4xx is off', () => {
    expect(
      isUnexpectedApiFailure({ ...base, failOn4xx: false, pathname: '/api/dues/payments', status: 500 }),
    ).toBe(true)
  })

  test('flags an unhandled 4xx when failOn4xx is on', () => {
    expect(
      isUnexpectedApiFailure({ ...base, pathname: '/api/billing/merchant-accounts/me', status: 404 }),
    ).toBe(true)
  })

  test('does NOT flag a 4xx when failOn4xx is off (legacy default)', () => {
    expect(
      isUnexpectedApiFailure({ ...base, failOn4xx: false, pathname: '/api/billing/merchant-accounts/me', status: 404 }),
    ).toBe(false)
  })

  test('respects the allow-list for an expected 4xx', () => {
    expect(
      isUnexpectedApiFailure({
        ...base,
        pathname: '/api/billing/merchant-accounts/me',
        status: 404,
        allow: [/GET \/api\/billing\/merchant-accounts\/me → 404/],
      }),
    ).toBe(false)
  })

  test('matches /auth/ paths too', () => {
    expect(
      isUnexpectedApiFailure({ ...base, pathname: '/auth/sign-in/email', status: 401 }),
    ).toBe(true)
  })
})

describe('isUnexpectedConsoleError (clause 1 — console.error)', () => {
  const base = { allow: [] as RegExp[], failOnConsoleError: true }

  test('ignores the React DevTools banner', () => {
    expect(
      isUnexpectedConsoleError('Download the React DevTools for a better experience', base),
    ).toBe(false)
  })

  test('ignores duplicate-key warnings', () => {
    expect(
      isUnexpectedConsoleError('Encountered two children with the same key', base),
    ).toBe(false)
  })

  test('flags a real console.error when failOnConsoleError is on', () => {
    expect(isUnexpectedConsoleError('TypeError: x is not a function', base)).toBe(true)
  })

  test('does NOT flag when failOnConsoleError is off (warn-only legacy)', () => {
    expect(
      isUnexpectedConsoleError('TypeError: x is not a function', { ...base, failOnConsoleError: false }),
    ).toBe(false)
  })

  test('respects the allow-list', () => {
    expect(
      isUnexpectedConsoleError('expected dev warning: foo', {
        ...base,
        allow: [/expected dev warning/],
      }),
    ).toBe(false)
  })
})
