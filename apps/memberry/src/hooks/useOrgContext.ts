/**
 * Centralized org context hook.
 *
 * - Routes under /org/$orgId/*: reads orgId from URL params (authoritative).
 * - Routes under /my/*: reads from localStorage (display-only, for org switcher pill).
 *   /my/ routes show cross-org data — localStorage orgId is NOT used for data scoping.
 */

import { useParams, useLocation } from '@tanstack/react-router'

const LS_KEY = 'memberry:selectedOrgId'

export function useOrgContext(): { orgId: string | null; source: 'url' | 'localStorage' } {
  const params = useParams({ strict: false }) as { orgId?: string }
  const location = useLocation()

  // URL param takes priority — present on /org/$orgId/* routes
  if (params.orgId) {
    return { orgId: params.orgId, source: 'url' }
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
