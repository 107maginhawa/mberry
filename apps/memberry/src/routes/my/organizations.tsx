import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getStatusLabel, getStatusColor } from '@/features/membership/lib/membership-status'

export const Route = createFileRoute('/my/organizations')({
  component: MyOrganizationsPage,
})

function MyOrganizationsPage() {
  // Uses the custom getMyMemberships handler (not generated SDK — custom endpoint)
  // For now, show placeholder until the endpoint is wired via TypeSpec
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">My Organizations</h1>
      <p className="text-muted-foreground">
        Your association memberships across all organizations.
      </p>
      <div className="border rounded-lg p-6 text-center text-muted-foreground">
        Organizations will appear here once you join an association.
      </div>
    </div>
  )
}
