import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchDirectoryOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { Button } from '@monobase/ui'
import { Users, Search } from 'lucide-react'
import { Input } from '@monobase/ui'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { TrustCard } from './trust-card'
import { DirectoryFilters, type DirectoryFilterValues } from './directory-filters'
import { api } from '@/lib/api'

interface TrustDirectoryProps {
  orgId: string
  orgSlug: string
}

export function TrustDirectory({ orgId, orgSlug }: TrustDirectoryProps) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<DirectoryFilterValues>({
    specialty: '',
    chapter: '',
    duesStatus: '',
    tier: '',
  })

  const queryParams: Record<string, string | undefined> = {
    q: search || undefined,
    chapter: filters.chapter || undefined,
    duesStatus: filters.duesStatus || undefined,
    tier: filters.tier || undefined,
  }

  const { data, isLoading, error } = useQuery({
    ...searchDirectoryOptions({
      query: queryParams as any,
      headers: { 'x-org-id': orgId },
    }),
  })

  const profiles: any[] = data?.data ?? []

  // Fetch chapters for this org
  const { data: chaptersData } = useQuery({
    queryKey: ['org-chapters', orgId],
    queryFn: async () => {
      const res = await api.get<{ data: Array<{ id: string; chapterId: string; chapterName?: string }> }>(
        '/api/association/member/chapters',
        { 'x-org-id': orgId },
      )
      return res?.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const chapters = useMemo(() => {
    if (!chaptersData) return []
    const seen = new Map<string, string>()
    chaptersData.forEach((c: any) => {
      if (c.chapterId && !seen.has(c.chapterId)) {
        seen.set(c.chapterId, c.chapterName || c.chapterId)
      }
    })
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [chaptersData])

  // Extract unique specialties from results for filter dropdown
  const specialties = useMemo(() => {
    const set = new Set<string>()
    profiles.forEach((p: any) => {
      if (p.specialty) set.add(p.specialty)
    })
    return Array.from(set).sort()
  }, [profiles])

  const hasActiveFilters = filters.specialty || filters.chapter || filters.duesStatus || filters.tier

  return (
    <div className="flex gap-6">
      {/* Sidebar filters */}
      <aside className="hidden lg:block w-[220px] shrink-0">
        <div className="sticky top-4">
          <h3 className="text-sm font-semibold mb-3">Filters</h3>
          <DirectoryFilters
            filters={filters}
            onChange={setFilters}
            specialties={specialties}
            chapters={chapters}
          />
          {hasActiveFilters && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setFilters({ specialty: '', chapter: '', duesStatus: '', tier: '' })}
              className="text-xs mt-3"
            >
              Clear filters
            </Button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, specialty, location..."
            className="w-full pl-10 pr-4 py-2.5 rounded-[10px] border border-[var(--color-border-light)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {/* Error */}
        {error && (
          <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
            Unable to load directory. Please try again.
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && profiles.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {profiles.map((p: any) => (
              <TrustCard key={p.id} profile={p} orgSlug={orgSlug} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && profiles.length === 0 && (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            headline={search || hasActiveFilters ? 'No members found' : 'No directory profiles'}
            description={
              search || hasActiveFilters
                ? 'Try a different search or filter.'
                : 'Members will appear here once they publish their profiles.'
            }
          />
        )}

        {/* Pagination info */}
        {data?.pagination && data.pagination.totalCount > 0 && (
          <div className="text-xs text-[var(--color-muted)] text-center pt-2">
            Showing {profiles.length} of {data.pagination.totalCount} members
          </div>
        )}
      </div>
    </div>
  )
}
