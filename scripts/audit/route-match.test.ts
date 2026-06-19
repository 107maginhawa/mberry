import { test, expect } from 'bun:test'
import { buildRouteMatcher } from './route-match'

function matches(urlPath: string, body: string): boolean {
  const re = buildRouteMatcher(urlPath)
  return re ? re.test(body) : false
}

test('matches a literal page.goto', () => {
  expect(matches('/audit', `await page.goto('/audit')`)).toBe(true)
})

test('matches a nav-helper call (the false-positive class)', () => {
  expect(matches('/audit', `await signInAndNavigate(page, '/audit')`)).toBe(true)
  expect(matches('/members', `signInAndNavigate(page, '/members')`)).toBe(true)
})

test('matches a data-driven path: array entry with a templated org slug', () => {
  const body = "{ name: 'Invoices', path: `/org/pda-metro-manila/officer/finances/invoices` }"
  expect(matches('/org/$orgSlug/officer/finances/invoices', body)).toBe(true)
})

test('matches a param route against a runtime-interpolated id', () => {
  expect(matches('/members/$personId', '`/members/${memberId}`')).toBe(true)
  expect(matches('/members/$personId', `'/members/abc-123'`)).toBe(true)
})

test('does not match a different route that shares a prefix', () => {
  expect(matches('/compliance', `page.goto('/complaints')`)).toBe(false)
  expect(matches('/audit', `page.goto('/dashboard')`)).toBe(false)
})

test('skips the index route to avoid matching every slash', () => {
  expect(buildRouteMatcher('/')).toBeNull()
})

test('a trailing-slash index route matches the un-slashed literal', () => {
  expect(matches('/audit/', `signInAndNavigate(page, '/audit')`)).toBe(true)
  expect(matches('/members/', `signInAndNavigate(page, '/members')`)).toBe(true)
})
