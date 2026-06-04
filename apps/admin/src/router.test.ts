import { describe, test, expect } from 'bun:test'
import type { AdminUser, RouterContext } from './router'

describe('Router types', () => {
  test('AdminUser type accepts valid roles', () => {
    const superUser: AdminUser = { email: 'a@b.com', name: 'A', role: 'super' }
    const supportUser: AdminUser = { email: 'b@b.com', name: 'B', role: 'support' }
    const analystUser: AdminUser = { email: 'c@b.com', name: 'C', role: 'analyst' }

    expect(superUser.role).toBe('super')
    expect(supportUser.role).toBe('support')
    expect(analystUser.role).toBe('analyst')
  })

  test('RouterContext contains auth with user and loading', () => {
    const context: RouterContext = {
      auth: {
        user: { email: 'test@test.com', name: 'Test', role: 'super' },
        loading: false,
      },
    }

    expect(context.auth.user).toBeDefined()
    expect(context.auth.loading).toBe(false)
  })

  test('RouterContext supports null user (not authenticated)', () => {
    const context: RouterContext = {
      auth: {
        user: null,
        loading: false,
      },
    }

    expect(context.auth.user).toBeNull()
  })
})
