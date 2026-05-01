import { redirect } from '@tanstack/react-router'
import type { RouterContext } from '@/router'

/**
 * Requires authenticated user. Redirects to sign-in if not.
 */
export async function requireAuth({ context, location }: { context: RouterContext; location?: any }) {
  if (!context.auth.user) {
    throw redirect({
      to: '/auth/$authView',
      params: { authView: 'sign-in' },
      search: {
        redirect: location?.href || `${window.location.pathname}${window.location.search}`,
      },
    })
  }
  return { user: context.auth.user }
}

/**
 * Requires guest (not authenticated). Redirects to dashboard if logged in.
 */
export async function requireGuest({ context }: { context: RouterContext }) {
  if (context.auth.user) {
    throw redirect({ to: '/' })
  }
}

/**
 * Compose multiple guards into a single beforeLoad handler.
 */
export function composeGuards(...guards: Array<(opts: any) => Promise<any> | any>) {
  return async (opts: any) => {
    let result = {}
    for (const guard of guards) {
      const guardResult = await guard(opts)
      if (guardResult) result = { ...result, ...guardResult }
    }
    return result
  }
}
