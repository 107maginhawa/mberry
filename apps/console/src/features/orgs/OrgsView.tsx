import React, { useState } from 'react'
import {
  Button,
  Card,
  Input,
  StatusBadge,
  type StatusBadgeVariant,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
  EmptyState,
  ErrorState,
  centavosToPhp,
} from '@monobase/ui'
import type { OrgRow } from './use-orgs'
import type { PlatformStats } from './use-platform-stats'

// Org lifecycle status → StatusBadge variant (status = text + color, DESIGN.md).
function orgStatusVariant(status: string): StatusBadgeVariant {
  if (status === 'active') return 'success'
  if (status === 'pending') return 'info'
  if (status === 'suspended' || status === 'archived') return 'error'
  return 'muted'
}

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

type Props = {
  orgs: OrgRow[]
  total: number
  orgsStatus: 'loading' | 'ready' | 'error'
  associationsCount: number | undefined
  stats: PlatformStats
  statsStatus: 'loading' | 'ready' | 'error'
  hasSnapshot: boolean
  onCreate: () => void
}

const EMDASH = '—'

function StatTile({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <Card className="p-4 flex flex-col gap-1">
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className={`text-section font-semibold${mono ? ' tabular-amount' : ''}`}>{value}</span>
    </Card>
  )
}

export default function OrgsView({
  orgs,
  total,
  orgsStatus,
  associationsCount,
  stats,
  statsStatus,
  hasSnapshot,
  onCreate,
}: Props) {
  const [query, setQuery] = useState('')
  const filtered = query.trim()
    ? orgs.filter((o) => {
        const q = query.trim().toLowerCase()
        return (
          o.name.toLowerCase().includes(q) ||
          (o.region ?? '').toLowerCase().includes(q) ||
          o.orgType.toLowerCase().includes(q)
        )
      })
    : orgs

  const [sort, setSort] = useState<{ key: 'name' | 'createdAt'; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  })
  const sorted = [...filtered].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1
    if (sort.key === 'name') return a.name.localeCompare(b.name) * dir
    const t = (v: OrgRow['createdAt']) =>
      v instanceof Date ? v.getTime() : Date.parse(String(v)) || 0
    return (t(a.createdAt) - t(b.createdAt)) * dir
  })
  const toggleSort = (key: 'name' | 'createdAt') =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const ariaSort = (key: 'name' | 'createdAt') =>
    sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
  const caret = (key: 'name' | 'createdAt') => (sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <div className="mx-auto max-w-6xl p-6 flex flex-col gap-6 text-body">
      <div className="flex items-center justify-between">
        <h1 className="text-title font-bold">Organizations</h1>
        <Button className="min-h-tap" onClick={onCreate} aria-label="Create organization">
          Create organization
        </Button>
      </div>

      {/* Stats strip — grouped so hierarchy isn't a flat 6-card row */}
      <div className="flex flex-col gap-4">
        {/* Live tiles — always show real values from live tables */}
        <div className="flex flex-col gap-2">
          <span className="text-caption uppercase tracking-wide text-muted-foreground">Live counts</span>
          <div className="grid grid-cols-2 gap-4">
            <StatTile label="Organizations" value={total} />
            <StatTile label="Associations" value={associationsCount ?? EMDASH} />
          </div>
        </div>

        {/* Snapshot-derived tiles — branch on statsStatus first (I1) */}
        <div className="flex flex-col gap-2">
          <span className="text-caption uppercase tracking-wide text-muted-foreground">This month (snapshot)</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statsStatus === 'loading' ? (
          <>
            <StatTile label="Members" value={<Skeleton className="h-7 w-16" />} />
            <StatTile label="Active" value={<Skeleton className="h-7 w-16" />} />
            <StatTile label="Revenue" value={<Skeleton className="h-7 w-20" />} />
            <StatTile label="Avg collection" value={<Skeleton className="h-7 w-16" />} />
          </>
        ) : statsStatus === 'error' ? (
          <>
            <StatTile label="Members" value={EMDASH} />
            <StatTile label="Active" value={EMDASH} />
            <StatTile label="Revenue" value={EMDASH} />
            <StatTile label="Avg collection" value={EMDASH} />
          </>
        ) : hasSnapshot ? (
          <>
            <StatTile label="Members" value={stats.totalMembers} />
            <StatTile label="Active" value={stats.activeMembers} />
            <StatTile
              label="Revenue"
              mono
              value={centavosToPhp(Number(stats.totalRevenueCents))}
            />
            <StatTile
              label="Avg collection"
              value={`${stats.avgCollectionRate.toFixed(0)}%`}
            />
          </>
        ) : (
          <>
            <StatTile label="Members" value={EMDASH} />
            <StatTile label="Active" value={EMDASH} />
            <StatTile label="Revenue" value={EMDASH} />
            <StatTile label="Avg collection" value={EMDASH} />
          </>
            )}
          </div>
        </div>
      </div>

      {/* Status notes below the strip */}
      {statsStatus === 'error' && (
        <p className="text-sm text-destructive" role="alert">
          Stats unavailable
        </p>
      )}
      {/* Empty-state note only when stats are ready but no snapshot yet (I1) */}
      {statsStatus === 'ready' && !hasSnapshot && (
        <p className="text-sm text-muted-foreground" role="note">
          No snapshot for this month yet
        </p>
      )}

      {/* Organizations table */}
      <div>
        {orgsStatus === 'loading' && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {orgsStatus === 'error' && (
          <ErrorState message="Failed to load organizations." />
        )}

        {orgsStatus === 'ready' && orgs.length === 0 && (
          <EmptyState
            headline="No organizations yet"
            description="Create the first organization to get the platform started."
            action={{ label: 'Create your first organization', onClick: onCreate }}
          />
        )}

        {orgsStatus === 'ready' && orgs.length > 0 && (
          <div className="flex flex-col gap-3">
            <Input
              type="search"
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              placeholder="Search by name, region, or type"
              aria-label="Search organizations"
              className="max-w-sm min-h-tap"
            />
            {filtered.length === 0 ? (
              <EmptyState
                headline="No organizations match your search."
                description={`No results for “${query}”.`}
                action={{ label: 'Clear search', onClick: () => setQuery('') }}
              />
            ) : (
              <Table>
            <TableHeader>
              <TableRow>
                <TableHead aria-sort={ariaSort('name')}>
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="min-h-tap inline-flex items-center gap-1 rounded-md px-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Name{caret('name')}
                  </button>
                </TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead aria-sort={ariaSort('createdAt')}>
                  <button
                    type="button"
                    onClick={() => toggleSort('createdAt')}
                    className="min-h-tap inline-flex items-center gap-1 rounded-md px-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Created{caret('createdAt')}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(org => (
                <TableRow key={org.id}>
                  <TableCell>{org.name}</TableCell>
                  <TableCell>{org.region ?? EMDASH}</TableCell>
                  <TableCell>{titleCase(org.orgType)}</TableCell>
                  <TableCell>
                    <StatusBadge variant={orgStatusVariant(org.status)}>
                      {titleCase(org.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {org.createdAt instanceof Date
                      ? org.createdAt.toLocaleDateString()
                      : String(org.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
