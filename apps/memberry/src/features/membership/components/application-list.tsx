import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listMembershipApplicationsOptions,
  listMembershipApplicationsQueryKey,
  approveMembershipApplicationMutation,
  denyMembershipApplicationMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

interface ApplicationListProps {
  orgId: string
  tenantId: string
}

export function ApplicationList({ orgId, tenantId }: ApplicationListProps) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    ...listMembershipApplicationsOptions({
      query: { organizationId: orgId },
      headers: { 'x-org-id': tenantId },
    }),
  })

  const approveMutation = useMutation({
    ...approveMembershipApplicationMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listMembershipApplicationsQueryKey() })
    },
  })

  const denyMutation = useMutation({
    ...denyMembershipApplicationMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listMembershipApplicationsQueryKey() })
    },
  })

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading applications...</div>
  }

  if (error) {
    return <div className="p-6 text-center text-destructive">Failed to load applications</div>
  }

  const applications = (data as any)?.data ?? []

  if (applications.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        No pending applications.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-4 py-3 font-medium">Applicant</th>
            <th className="px-4 py-3 font-medium">Tier</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app: any) => (
            <tr key={app.id} className="border-b hover:bg-muted/50">
              <td className="px-4 py-3">{app.personId}</td>
              <td className="px-4 py-3">{app.tierId}</td>
              <td className="px-4 py-3">{app.applicationDate instanceof Date ? app.applicationDate.toLocaleDateString() : app.applicationDate}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {app.status}
                </span>
              </td>
              <td className="px-4 py-3 space-x-2">
                {['submitted', 'underReview'].includes(app.status) && (
                  <>
                    <button
                      onClick={() => approveMutation.mutate({
                        path: { applicationId: app.id },
                        headers: { 'x-org-id': tenantId },
                      })}
                      disabled={approveMutation.isPending}
                      className="text-xs text-green-700 hover:underline disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => denyMutation.mutate({
                        path: { applicationId: app.id },
                        headers: { 'x-org-id': tenantId },
                        body: {},
                      } as any)}
                      disabled={denyMutation.isPending}
                      className="text-xs text-red-700 hover:underline disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
