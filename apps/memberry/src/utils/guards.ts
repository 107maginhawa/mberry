import { redirect } from '@tanstack/react-router'
import type { RouterContext } from '@/router'
import type { User } from 'better-auth'
import { api } from '@/lib/api'

export interface AuthContext {
  user: User
}

export interface OfficerContext {
  officerPositions: Array<{ title: string; [key: string]: unknown }>
  orgId: string
}

/**
 * Requires authenticated user. Redirects to sign-in if not.
 */
export async function requireAuth({ context, location }: { context: RouterContext; location?: any }): Promise<AuthContext> {
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
 * Requires user to be an active officer for the org specified by $orgId route param.
 * Checks org+role (per BR-09, BR-21: roles are per-org, not global).
 * Returns officer positions in route context for downstream use.
 */
export async function requireOrgOfficer({ context, params }: { context: RouterContext; params: { orgId: string } }): Promise<OfficerContext> {
  const user = context.auth?.user
  if (!user) {
    throw redirect({
      to: '/auth/$authView',
      params: { authView: 'sign-in' },
    })
  }

  const orgId = params.orgId
  if (!orgId) {
    throw redirect({ to: '/' })
  }

  try {
    const { data } = await api.get<{ data: { isOfficer: boolean; positions: Array<{ title: string; [key: string]: unknown }> } }>(`/api/persons/me/officer-role/${orgId}`)
    if (!data.isOfficer) {
      throw redirect({ to: '/dashboard' })
    }
    return { officerPositions: data.positions, orgId }
  } catch (err) {
    if (err instanceof Error && 'to' in (err as any)) throw err
    throw redirect({ to: '/dashboard' })
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
