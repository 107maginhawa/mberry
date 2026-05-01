import { useQuery } from '@tanstack/react-query'
import { listChapterAffiliationsOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

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

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading affiliations...</div>
  if (error) return <div className="p-6 text-center text-destructive">Failed to load affiliations</div>

  const affiliations = (data as any)?.data ?? []

  if (affiliations.length === 0) {
    return <div className="p-6 text-center text-muted-foreground">No chapter affiliations.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-4 py-3 font-medium">Member</th>
            <th className="px-4 py-3 font-medium">Chapter</th>
            <th className="px-4 py-3 font-medium">Primary</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody>
          {affiliations.map((a: any) => (
            <tr key={a.id} className="border-b hover:bg-muted/50">
              <td className="px-4 py-3">{a.personId}</td>
              <td className="px-4 py-3">{a.chapterId}</td>
              <td className="px-4 py-3">{a.isPrimary ? 'Yes' : 'No'}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {a.status}
                </span>
              </td>
              <td className="px-4 py-3 text-xs">{a.affiliatedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
