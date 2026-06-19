import { useQuery } from '@tanstack/react-query'
import { listChapterAffiliationsOptions } from '@monobase/sdk-ts/generated/react-query'
import type { ChapterAffiliation } from '@monobase/sdk-ts/generated/types.gen'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { StatusBadge } from '@/components/patterns/status-badge'

interface AffiliationListProps {
  orgId: string
  tenantId: string
}

export function AffiliationList({ orgId, tenantId }: AffiliationListProps) {
  const { data, isLoading, error } = useQuery({
    ...listChapterAffiliationsOptions({
      headers: { 'x-org-id': tenantId },
    }),
  })

  if (isLoading) return <div className="p-6 text-center text-[var(--color-muted)]">Loading affiliations...</div>
  if (error) return <div role="alert" aria-live="polite" className="p-6 text-center text-[var(--color-error)]">Failed to load affiliations</div>

  const affiliations: ChapterAffiliation[] = data?.data ?? []

  if (affiliations.length === 0) {
    return <div className="p-6 text-center text-[var(--color-muted)]">No chapter affiliations.</div>
  }

  return (
    <Table className="text-sm">
      <TableHeader>
        <TableRow>
          <TableHead className="px-4 py-3">Member</TableHead>
          <TableHead className="px-4 py-3">Chapter</TableHead>
          <TableHead className="px-4 py-3">Primary</TableHead>
          <TableHead className="px-4 py-3">Status</TableHead>
          <TableHead className="px-4 py-3">Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {affiliations.map((a: any) => (
          <TableRow key={a.id} className="hover:bg-[var(--color-surface-warm)]">
            <TableCell className="px-4 py-3">{a.personId}</TableCell>
            <TableCell className="px-4 py-3">{a.chapterId}</TableCell>
            <TableCell className="px-4 py-3">{a.isPrimary ? 'Yes' : 'No'}</TableCell>
            <TableCell className="px-4 py-3">
              <StatusBadge variant={a.status === 'active' ? 'success' : 'muted'}>
                {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
              </StatusBadge>
            </TableCell>
            <TableCell className="px-4 py-3 text-xs">{a.affiliatedAt instanceof Date ? a.affiliatedAt.toLocaleDateString() : a.affiliatedAt}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
