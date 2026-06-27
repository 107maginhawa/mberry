import React from 'react'
import {
  Button,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
  centavosToPhp,
} from '@monobase/ui'
import type { OrgRow } from './use-orgs'
import type { PlatformStats } from './use-platform-stats'

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

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4 flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </Card>
  )
}

export default function OrgsView({
  orgs,
  total,
  orgsStatus,
  associationsCount,
  stats,
  statsStatus: _statsStatus,
  hasSnapshot,
  onCreate,
}: Props) {
  return (
    <div className="p-6 flex flex-col gap-6" style={{ fontSize: '18px' }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <Button className="min-h-tap" onClick={onCreate} aria-label="Create organization">
          Create organization
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Live tiles — always show real values from live tables */}
        <StatTile label="Organizations" value={total} />
        <StatTile label="Associations" value={associationsCount ?? EMDASH} />

        {/* Snapshot-derived tiles — I1: only show real values when hasSnapshot; else em-dash */}
        {hasSnapshot ? (
          <>
            <StatTile label="Members" value={stats.totalMembers} />
            <StatTile label="Active" value={stats.activeMembers} />
            <StatTile
              label="Revenue"
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

      {/* Empty-state note when no snapshot yet (I1) */}
      {!hasSnapshot && (
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
          <p role="alert" className="text-destructive">
            Failed to load organizations.
          </p>
        )}

        {orgsStatus === 'ready' && orgs.length === 0 && (
          <p className="text-muted-foreground text-sm">No organizations yet.</p>
        )}

        {orgsStatus === 'ready' && orgs.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map(org => (
                <TableRow key={org.id}>
                  <TableCell>{org.name}</TableCell>
                  <TableCell>{org.region ?? EMDASH}</TableCell>
                  <TableCell>{org.orgType}</TableCell>
                  <TableCell>{org.status}</TableCell>
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
    </div>
  )
}
