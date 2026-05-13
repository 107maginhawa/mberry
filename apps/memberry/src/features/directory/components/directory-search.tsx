import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchDirectoryOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import { Users } from 'lucide-react'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'

interface DirectorySearchProps {
  orgId: string
  tenantId: string
}

export function DirectorySearch({ orgId, tenantId }: DirectorySearchProps) {
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    ...searchDirectoryOptions({
      query: { q: search || undefined },
      headers: { 'x-org-id': tenantId },
    }),
  })

  const profiles = (data as any)?.data ?? []

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search members by name, specialty..."
        className="w-full px-4 py-2.5 rounded-[10px] border border-[var(--color-border-light)] bg-[var(--color-surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}
      {error && <GlassCard className="p-6 text-center text-[var(--color-error)]">Search failed</GlassCard>}

      {!isLoading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p: any) => (
            <GlassCard key={p.id} className="p-4 space-y-2">
              <div className="flex items-center gap-3">
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--color-surface-warm)] flex items-center justify-center text-sm font-medium text-[var(--color-primary)]">
                    {(p.firstName || '?')[0]}
                  </div>
                )}
                <div>
                  <div className="font-medium text-sm">{[p.firstName, p.lastName].filter(Boolean).join(' ')}</div>
                  {p.title && <div className="text-xs text-[var(--color-muted)]">{p.title}</div>}
                </div>
              </div>
              {p.specialty && (
                <div className="text-xs text-[var(--color-muted)]">{p.specialty}</div>
              )}
              {p.location && (
                <div className="text-xs text-[var(--color-muted)]">{p.location}</div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {!isLoading && profiles.length === 0 && search && (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          headline="No members found"
          description="Try a different search term."
        />
      )}
    </div>
  )
}
