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
 * Requires user to be an active officer for the org specified by $orgSlug route param.
 * Resolves slug to UUID via /public/org/:slug, then checks org+role
 * (per BR-09, BR-21: roles are per-org, not global).
 * Uses queryClient.ensureQueryData for caching — subsequent navigations
 * within the same org hit cache (staleTime from ApiProvider defaults).
 * Returns officer positions in route context for downstream use.
 */
export async function requireOrgOfficer({ context, params }: { context: RouterContext; params: { orgSlug: string } }): Promise<OfficerContext> {
  const user = context.auth?.user
  if (!user) {
    throw redirect({
      to: '/auth/$authView',
      params: { authView: 'sign-in' },
    })
  }

  const orgSlug = params.orgSlug
  if (!orgSlug) {
    throw redirect({ to: '/' })
  }

  // Resolve slug to UUID
  let orgId: string
  try {
    const orgData = await context.queryClient.ensureQueryData({
      queryKey: ['org-by-slug', orgSlug],
      queryFn: () => api.get<any>(`/api/public/org/${orgSlug}`),
      staleTime: Infinity,
    })
    orgId = orgData?.id ?? orgData?.data?.id
    if (!orgId) throw new Error('Org not found')
  } catch (err) {
    if (err && typeof err === 'object' && 'to' in err) throw err
    throw redirect({ to: '/dashboard' })
  }

  try {
    const json = await context.queryClient.ensureQueryData({
      queryKey: ['me-officer-role-raw', orgId],
      queryFn: () => api.get<any>(`/api/persons/me/officer-role/${orgId}`),
      // Officer roster of an org doesn't change mid-session. Without an
      // explicit staleTime the query falls back to the SDK 5-minute
      // default, which under E2E parallel pressure occasionally serves
      // a stale empty-array response and trips the redirect-to-/dashboard
      // path even for users who DO have an officer term. See
      // docs/audits/E2E_REMEDIATION_FINAL.md §Root cause 2.
      staleTime: Infinity,
    })
    const positions = Array.isArray(json?.data) ? json.data : []
    if (positions.length === 0) {
      throw redirect({ to: '/dashboard' })
    }
    return { officerPositions: positions.map((p: any) => ({ title: p.positionTitle, ...p })), orgId }
  } catch (err) {
    if (err && typeof err === 'object' && 'to' in err) throw err
    throw redirect({ to: '/dashboard' })
  }
}

/**
 * Requires user to have a person profile. Redirects to onboarding if missing.
 */
export async function requirePerson({ context }: { context: RouterContext }) {
  if (!context.auth.person) {
    throw redirect({ to: '/onboarding' })
  }
  return { person: context.auth.person }
}

/**
 * Requires user to NOT have a person profile (for onboarding).
 * Redirects to dashboard if person already exists.
 */
export async function requireNoPerson({ context }: { context: RouterContext }) {
  if (context.auth.person) {
    throw redirect({ to: '/dashboard' })
  }
}

/**
 * Requires user to have a verified email.
 * Redirects to verify-email if not verified.
 */
export async function requireEmailVerified({ context }: { context: RouterContext }) {
  if (!context.auth.user?.emailVerified) {
    throw redirect({ to: '/verify-email' })
  }
}

/**
 * Requires user to NOT have a verified email (for verify-email page).
 * Redirects to dashboard if already verified.
 */
export async function requireNotEmailVerified({ context }: { context: RouterContext }) {
  if (context.auth.user?.emailVerified) {
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
