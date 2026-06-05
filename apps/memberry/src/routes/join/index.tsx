import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input, Badge, Skeleton, Button } from '@monobase/ui'
import { api } from '@/lib/api'
import { ErrorState } from '@/components/patterns/error-state'

// oli-ui: exempt-pageshell — pre-auth discovery page with centered hero chrome
export const Route = createFileRoute('/join/')({
  component: JoinPage,
})

interface PublicOrg {
  id: string
  name: string
  slug: string | null
  orgType: string
  region: string | null
  status: string
  associationName: string | null
  memberCount: number
}

interface ListOrgsResponse {
  data: PublicOrg[]
  meta: { total: number; limit: number; offset: number }
}

function JoinPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(value: string) {
    setSearch(value)
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => setDebouncedSearch(value), 300)
    setDebounceTimer(timer)
  }

  const orgsQuery = useQuery<ListOrgsResponse>({
    queryKey: ['public-orgs', debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      params.set('limit', '25')
      const qs = params.toString()
      return await api.get(`/api/public/orgs${qs ? `?${qs}` : ''}`)
    },
  })

  const orgs = orgsQuery.data?.data ?? []
  const total = orgsQuery.data?.meta?.total ?? 0
  const loading = orgsQuery.isLoading

  function handleOrgClick(org: PublicOrg) {
    if (org.slug) {
      navigate({ to: '/join/$slug', params: { slug: org.slug } })
    }
  }

  const orgTypeLabel: Record<string, string> = {
    chapter: 'Chapter',
    society: 'Society',
    national: 'National',
    clinic: 'Clinic',
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Find Your Organization</h1>
          <p className="mt-2 text-muted-foreground">
            Discover and join professional associations and chapters
          </p>
        </div>

        <div className="mb-8">
          <Input
            placeholder="Search organizations..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full"
          />
        </div>

        {orgsQuery.isError ? (
          <ErrorState message="Could not load organizations" onRetry={() => orgsQuery.refetch()} />
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-6">
                <Skeleton className="mb-2 h-5 w-3/4" />
                <Skeleton className="mb-4 h-4 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : orgs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              {debouncedSearch ? 'No organizations found' : 'No organizations available'}
            </p>
            {debouncedSearch && (
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search term
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {total} organization{total !== 1 ? 's' : ''} found
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {orgs.map((org) => (
                <Button
                  key={org.id}
                  variant="ghost"
                  onClick={() => handleOrgClick(org)}
                  disabled={!org.slug}
                  className="h-auto rounded-lg border bg-card p-6 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <h3 className="font-semibold">{org.name}</h3>
                  {org.associationName && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {org.associationName}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {orgTypeLabel[org.orgType] ?? org.orgType}
                    </Badge>
                    {org.region && (
                      <Badge variant="outline">{org.region}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {org.memberCount} member{org.memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
