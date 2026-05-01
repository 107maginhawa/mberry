import { createFileRoute, Link } from '@tanstack/react-router'
import { Building2, ArrowLeft, Pencil, Plus } from 'lucide-react'

export const Route = createFileRoute('/associations/$associationId')({
  component: AssociationDetailPage,
})

function AssociationDetailPage() {
  const { associationId } = Route.useParams()

  return (
    <div className="p-8">
      <Link
        to="/associations"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Associations
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Association Detail
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              ID: {associationId}
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors">
          <Pencil className="w-4 h-4" />
          Edit Association
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
            <p className="text-sm text-muted-foreground">Country</p>
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
        </div>
      </div>

      {/* Organizations within this association */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Organizations</h2>
        <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-accent transition-colors">
          <Plus className="w-4 h-4" />
          Add Organization
        </button>
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Members</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                No organizations loaded. Connect SDK to populate data.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
