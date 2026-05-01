import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchDirectoryOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

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
        className="w-full px-4 py-2 border rounded-md text-sm"
      />

      {isLoading && <div className="text-center text-muted-foreground">Searching...</div>}
      {error && <div className="text-center text-destructive">Search failed</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((p: any) => (
          <div key={p.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-3">
              {p.photoUrl ? (
                <img src={p.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                  {(p.displayName || '?')[0]}
                </div>
              )}
              <div>
                <div className="font-medium text-sm">{p.displayName}</div>
                {p.title && <div className="text-xs text-muted-foreground">{p.title}</div>}
              </div>
            </div>
            {p.specialty && (
              <div className="text-xs text-muted-foreground">{p.specialty}</div>
            )}
            {p.location && (
              <div className="text-xs text-muted-foreground">{p.location}</div>
            )}
          </div>
        ))}
      </div>

      {!isLoading && profiles.length === 0 && search && (
        <div className="text-center text-muted-foreground">No members found.</div>
      )}
    </div>
  )
}
