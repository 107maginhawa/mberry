import { createFileRoute, Link } from '@tanstack/react-router'
import { Building, ArrowLeft, Pencil, Play, Pause, Archive } from 'lucide-react'

export const Route = createFileRoute('/organizations/$organizationId')({
  component: OrganizationDetailPage,
})

function OrganizationDetailPage() {
  const { organizationId } = Route.useParams()

  return (
    <div className="p-8">
      <Link
        to="/organizations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Organizations
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Building className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Organization Detail
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              ID: {organizationId}
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors">
          <Pencil className="w-4 h-4" />
          Edit Organization
        </button>
      </div>

      {/* Detail Card */}
      <div className="rounded-lg border bg-card p-6 mb-8">
        <h2 className="text-lg font-medium mb-4">Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="text-sm font-medium mt-1">--</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Association</p>
            <p className="text-sm font-medium mt-1">--</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="text-sm font-medium mt-1">--</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-sm font-medium mt-1">--</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="text-sm font-medium mt-1">--</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Member Count</p>
            <p className="text-sm font-medium mt-1">--</p>
          </div>
        </div>
      </div>

      {/* Lifecycle Controls */}
      <div className="rounded-lg border bg-card p-6 mb-8">
        <h2 className="text-lg font-medium mb-4">Lifecycle Controls</h2>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors">
            <Play className="w-4 h-4" />
            Activate
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-700 transition-colors">
            <Pause className="w-4 h-4" />
            Suspend
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
            <Archive className="w-4 h-4" />
            Archive
          </button>
        </div>
      </div>

      {/* Members sub-table */}
      <h2 className="text-lg font-medium mb-4">Members</h2>
      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                No members loaded. Connect SDK to populate data.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
