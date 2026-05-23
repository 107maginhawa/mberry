/**
 * Centralized org context hook.
 *
 * - Routes under /org/$orgSlug/*: reads orgSlug from URL params (authoritative).
 *   Use the useOrg() hook for full slug-to-UUID resolution on /org/ routes.
 * - Routes under /my/*: reads from localStorage (display-only, for org switcher pill).
 *   /my/ routes show cross-org data — localStorage orgId is NOT used for data scoping.
 */

import { useParams, useLocation } from '@tanstack/react-router'

const LS_KEY = 'memberry:selectedOrgId'

export function useOrgContext(): { orgId: string | null; source: 'url' | 'localStorage' } {
  const params = useParams({ strict: false }) as { orgSlug?: string }
  const location = useLocation()

  // URL param takes priority — present on /org/$orgSlug/* routes
  // Note: orgSlug is a slug, not a UUID. For UUID-based orgId, use useOrg() instead.
  if (params.orgSlug) {
    return { orgId: params.orgSlug, source: 'url' }
  }

  // On /my/* routes, read from localStorage for pill display
  if (location.pathname.startsWith('/my/') || location.pathname === '/my') {
    try {
      const stored = localStorage.getItem(LS_KEY)
      return { orgId: stored, source: 'localStorage' }
    } catch {
      return { orgId: null, source: 'localStorage' }
    }
  }

  return { orgId: null, source: 'url' }
}

/** Persist selected org to localStorage (called when user switches org). */
export function setSelectedOrg(orgId: string | null) {
  try {
    if (orgId) {
      localStorage.setItem(LS_KEY, orgId)
    } else {
      localStorage.removeItem(LS_KEY)
    }
  } catch {
    // SSR or storage unavailable
  }
}
