/**
 * Tests for route guard functions and guard composition utilities.
 *
 * Guards use `throw redirect(...)` from @tanstack/react-router to signal
 * redirects — we verify this by catching the thrown value and inspecting it.
 *
 * RouterContext shape:
 *   { auth: { user: User | null, session: Session | null, person: Person | null } }
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test'

// ---------------------------------------------------------------------------
// Mock @tanstack/react-router so `redirect()` produces a plain inspectable
// object rather than requiring the full router runtime.
// ---------------------------------------------------------------------------
mock.module('@tanstack/react-router', () => ({
  redirect: (opts: unknown) => {
    // Return a tagged object so tests can inspect it.
    return { __redirect: true, ...( opts as object ) }
  },
}))

// Import AFTER mock.module so the mock is in place.
import {
  requireAuth,
  requireGuest,
  requirePerson,
  requireNoPerson,
  requireEmailVerified,
  requireNotEmailVerified,
  composeGuards,
} from './guards'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal User-shaped object. */
const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'user@example.com',
  emailVerified: true,
  name: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

/** Minimal Person-shaped object. */
const makePerson = (overrides: Record<string, unknown> = {}) => ({
  id: 'person-1',
  userId: 'user-1',
  firstName: 'Test',
  lastName: 'Person',
  ...overrides,
})

/** RouterContext with a signed-in user AND a person profile. */
const ctxFull = () => ({
  auth: {
    user: makeUser(),
    session: { id: 'sess-1' } as any,
    person: makePerson(),
  },
})

/** RouterContext with a signed-in user but NO person profile. */
const ctxUserNoPerson = () => ({
  auth: {
    user: makeUser(),
    session: { id: 'sess-1' } as any,
    person: null,
  },
})

/** RouterContext with no user (guest). */
const ctxGuest = () => ({
  auth: {
    user: null,
    session: null,
    person: null,
  },
})

/**
 * Call a guard and capture either the return value or the thrown redirect.
 * Guards throw (not reject) when they need to redirect.
 */
async function callGuard(
  guardFn: (opts: any) => Promise<any>,
  opts: object,
): Promise<{ returned: any; threw: any }> {
  try {
    const returned = await guardFn(opts)
    return { returned, threw: null }
  } catch (threw) {
    return { returned: undefined, threw }
  }
}

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

describe('requireAuth', () => {
  test('returns user object when authenticated', async () => {
    const ctx = ctxFull()
    const { returned, threw } = await callGuard(requireAuth, {
      context: ctx,
      location: { href: '/dashboard' },
    })

    expect(threw).toBeNull()
    expect(returned).toEqual({ user: ctx.auth.user })
  })

  test('throws redirect to sign-in when not authenticated', async () => {
    const { returned, threw } = await callGuard(requireAuth, {
      context: ctxGuest(),
      location: { href: '/dashboard' },
    })

    expect(returned).toBeUndefined()
    expect(threw).toBeTruthy()
    expect((threw as any).__redirect).toBe(true)
    expect((threw as any).to).toBe('/auth/$authView')
    expect((threw as any).params?.authView).toBe('sign-in')
  })

  test('redirect includes the current location as search.redirect', async () => {
    const { threw } = await callGuard(requireAuth, {
      context: ctxGuest(),
      location: { href: '/settings?tab=billing' },
    })

    expect((threw as any).search?.redirect).toBe('/settings?tab=billing')
  })

  test('falls back to window.location when location param is absent', async () => {
    // happy-dom sets window.location.pathname = '/' and search = ''
    const { threw } = await callGuard(requireAuth, {
      context: ctxGuest(),
      // no location prop
    })

    expect((threw as any).search?.redirect).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// requireGuest
// ---------------------------------------------------------------------------

describe('requireGuest', () => {
  test('does not throw when user is a guest', async () => {
    const { returned, threw } = await callGuard(requireGuest, {
      context: ctxGuest(),
    })

    expect(threw).toBeNull()
    // Guard returns nothing (undefined) when the condition is satisfied
    expect(returned).toBeUndefined()
  })

  test('throws redirect to /dashboard when user is authenticated', async () => {
    const { threw } = await callGuard(requireGuest, {
      context: ctxFull(),
    })

    expect(threw).toBeTruthy()
    expect((threw as any).__redirect).toBe(true)
    expect((threw as any).to).toBe('/dashboard')
  })
})

// ---------------------------------------------------------------------------
// requirePerson
// ---------------------------------------------------------------------------

describe('requirePerson', () => {
  test('returns person object when person profile exists', async () => {
    const ctx = ctxFull()
    const { returned, threw } = await callGuard(requirePerson, {
      context: ctx,
    })

    expect(threw).toBeNull()
    expect(returned).toEqual({ person: ctx.auth.person })
  })

  test('throws redirect to /onboarding when person profile is absent', async () => {
    const { threw } = await callGuard(requirePerson, {
      context: ctxUserNoPerson(),
    })

    expect(threw).toBeTruthy()
    expect((threw as any).__redirect).toBe(true)
    expect((threw as any).to).toBe('/onboarding')
  })
})

// ---------------------------------------------------------------------------
// requireNoPerson
// ---------------------------------------------------------------------------

describe('requireNoPerson', () => {
  test('does not throw when person profile is absent', async () => {
    const { returned, threw } = await callGuard(requireNoPerson, {
      context: ctxUserNoPerson(),
    })

    expect(threw).toBeNull()
    expect(returned).toBeUndefined()
  })

  test('throws redirect to /dashboard when person profile exists', async () => {
    const { threw } = await callGuard(requireNoPerson, {
      context: ctxFull(),
    })

    expect(threw).toBeTruthy()
    expect((threw as any).__redirect).toBe(true)
    expect((threw as any).to).toBe('/dashboard')
  })
})

// ---------------------------------------------------------------------------
// requireEmailVerified
// ---------------------------------------------------------------------------

describe('requireEmailVerified', () => {
  // NOTE: The guard body is commented out in the source — it currently does
  // nothing. Tests verify observable no-op behaviour.

  test('does not throw when email is verified', async () => {
    const { returned, threw } = await callGuard(requireEmailVerified, {
      context: ctxFull(),
    })

    expect(threw).toBeNull()
  })

  test('does not throw when email is NOT verified (guard body is disabled)', async () => {
    // This is the no-op behaviour while the redirect is commented-out.
    // If the body is re-enabled this test should be updated to expect a throw.
    const ctx = {
      auth: { user: makeUser({ emailVerified: false }), session: null, person: null },
    }
    const { threw } = await callGuard(requireEmailVerified, { context: ctx })

    expect(threw).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// requireNotEmailVerified
// ---------------------------------------------------------------------------

describe('requireNotEmailVerified', () => {
  test('does not throw when email is NOT verified', async () => {
    const ctx = {
      auth: {
        user: makeUser({ emailVerified: false }),
        session: null,
        person: null,
      },
    }
    const { returned, threw } = await callGuard(requireNotEmailVerified, { context: ctx })

    expect(threw).toBeNull()
    expect(returned).toBeUndefined()
  })

  test('throws redirect to /dashboard when email IS verified', async () => {
    const { threw } = await callGuard(requireNotEmailVerified, {
      context: ctxFull(), // user has emailVerified: true
    })

    expect(threw).toBeTruthy()
    expect((threw as any).__redirect).toBe(true)
    expect((threw as any).to).toBe('/dashboard')
  })

  test('does not throw when user is null', async () => {
    const { threw } = await callGuard(requireNotEmailVerified, {
      context: ctxGuest(),
    })

    // user is null — optional chaining yields undefined, no redirect
    expect(threw).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// composeGuards
// ---------------------------------------------------------------------------

describe('composeGuards', () => {
  test('runs guards in order and merges return values', async () => {
    const g1 = async (_opts: any) => ({ a: 1 })
    const g2 = async (_opts: any) => ({ b: 2 })
    const composed = composeGuards(g1, g2)

    const result = await composed({})
    expect(result).toEqual({ a: 1, b: 2 })
  })

  test('later guard values override earlier ones on key collision', async () => {
    const g1 = async (_opts: any) => ({ key: 'first' })
    const g2 = async (_opts: any) => ({ key: 'second' })
    const composed = composeGuards(g1, g2)

    const result = await composed({})
    expect(result).toEqual({ key: 'second' })
  })

  test('skips undefined/void guard return values', async () => {
    const g1 = async (_opts: any) => undefined
    const g2 = async (_opts: any) => ({ value: 42 })
    const composed = composeGuards(g1, g2)

    const result = await composed({})
    expect(result).toEqual({ value: 42 })
  })

  test('composed guard returns empty object when all guards return nothing', async () => {
    const g1 = async (_opts: any) => undefined
    const g2 = async (_opts: any) => undefined
    const composed = composeGuards(g1, g2)

    const result = await composed({})
    expect(result).toEqual({})
  })

  test('rethrows a redirect thrown by any inner guard', async () => {
    const guardWithRedirect = async (_opts: any) => {
      // Simulate what requireAuth does
      throw { __redirect: true, to: '/auth/$authView' }
    }
    const neverReached = async (_opts: any) => ({ unreachable: true })
    const composed = composeGuards(guardWithRedirect, neverReached)

    const { threw } = await callGuard(composed, {})

    expect(threw).toBeTruthy()
    expect((threw as any).__redirect).toBe(true)
    expect((threw as any).to).toBe('/auth/$authView')
  })

  test('passes opts to each guard', async () => {
    const received: any[] = []
    const g1 = async (opts: any) => { received.push(opts); return {} }
    const g2 = async (opts: any) => { received.push(opts); return {} }
    const sentinel = { context: { auth: { user: null } } }
    const composed = composeGuards(g1, g2)

    await composed(sentinel)

    expect(received).toHaveLength(2)
    expect(received[0]).toBe(sentinel)
    expect(received[1]).toBe(sentinel)
  })

  test('composes requireAuth + requirePerson successfully for authenticated user with person', async () => {
    const ctx = ctxFull()
    const composed = composeGuards(requireAuth, requirePerson)
    const result = await composed({ context: ctx, location: { href: '/profile' } })

    expect(result).toMatchObject({
      user: ctx.auth.user,
      person: ctx.auth.person,
    })
  })

  test('composeGuards stops at first redirecting guard', async () => {
    const ctx = ctxGuest() // no user → requireAuth redirects
    const composed = composeGuards(requireAuth, requirePerson)

    const { threw } = await callGuard(composed, {
      context: ctx,
      location: { href: '/profile' },
    })

    expect(threw).toBeTruthy()
    expect((threw as any).to).toBe('/auth/$authView')
  })

  test('works with zero guards and returns empty object', async () => {
    const composed = composeGuards()
    const result = await composed({})
    expect(result).toEqual({})
  })

  test('works with a single guard', async () => {
    const ctx = ctxFull()
    const composed = composeGuards(requireAuth)
    const result = await composed({ context: ctx, location: { href: '/' } })
    expect(result).toEqual({ user: ctx.auth.user })
  })
})
