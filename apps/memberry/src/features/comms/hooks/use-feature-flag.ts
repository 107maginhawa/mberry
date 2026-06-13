/**
 * Tiny client read of the backend feature-flag surface.
 *
 * Fetches the public, hand-wired `GET /feature-flags` endpoint (NOT in the SDK)
 * which returns `parseFeatureFlags()`: env `FF_*` → camelCase keys, value
 * `'true'`/`'1'` → true, absent/anything-else → false. No `/api` prefix — the
 * SDK base URL already points at the API origin.
 *
 * Fail-closed: while loading, on error, or when the key is absent the flag reads
 * `false`. Callers gate optimistic/privileged UI off the honest default.
 */
import { useQuery } from '@tanstack/react-query'
import { getSdkBaseUrl } from '@monobase/sdk-ts/client'

export type FeatureFlags = Record<string, boolean>

async function fetchFeatureFlags(): Promise<FeatureFlags> {
  const res = await fetch(`${getSdkBaseUrl()}/feature-flags`, { credentials: 'include' })
  if (!res.ok) return {}
  const data = (await res.json()) as unknown
  return data && typeof data === 'object' ? (data as FeatureFlags) : {}
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60_000,
  })
}

/**
 * Read a single flag as a boolean. Defaults to `false` (fail-closed) while
 * loading, on error, or when the flag is absent.
 */
export function useFeatureFlag(flag: string): boolean {
  const { data } = useFeatureFlags()
  return data?.[flag] === true
}
