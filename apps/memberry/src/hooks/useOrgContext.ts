/**
 * Centralized org context hook.
 *
 * - Routes under /org/$orgSlug/*: reads from OrgProvider context (authoritative).
 *   Returns the resolved UUID orgId (not the slug).
 * - Routes under /my/*: reads from localStorage (display-only, for org switcher pill).
 *   /my/ routes show cross-org data — localStorage orgId is NOT used for data scoping.
 */

import { useLocation } from '@tanstack/react-router'
import { useOrgProviderOptional } from '@/providers/OrgProvider'

const LS_KEY = 'memberry:selectedOrgId'

export function useOrgContext(): { orgId: string | null; source: 'url' | 'localStorage' } {
  const orgCtx = useOrgProviderOptional()
  const location = useLocation()

  // OrgProvider present → we're on /org/$orgSlug/* routes
  if (orgCtx?.orgId) {
    return { orgId: orgCtx.orgId, source: 'url' }
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
