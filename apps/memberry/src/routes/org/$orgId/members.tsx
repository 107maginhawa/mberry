import { createFileRoute } from '@tanstack/react-router'
import { DirectorySearch } from '@/features/directory/components/directory-search'

export const Route = createFileRoute('/org/$orgId/members')({
  component: MembersDirectoryPage,
})

function MembersDirectoryPage() {
  const { orgId } = Route.useParams()

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Member Directory</h1>
      <DirectorySearch orgId={orgId} tenantId={orgId} />
    </div>
  )
}
