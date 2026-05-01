import { createFileRoute } from '@tanstack/react-router'
import { AffiliationList } from '@/features/chapters/components/affiliation-list'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/chapters')({
  component: ChaptersSettingsPage,
})

function ChaptersSettingsPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Chapter Affiliations</h1>
      <AffiliationList orgId={orgId} tenantId={orgId} />
    </div>
  )
}
