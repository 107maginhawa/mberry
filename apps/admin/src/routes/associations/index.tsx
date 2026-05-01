import { createFileRoute, Link } from '@tanstack/react-router'
import { Building2, Plus } from 'lucide-react'

export const Route = createFileRoute('/associations/')({
  component: AssociationsPage,
})

function AssociationsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Associations
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage healthcare associations across the platform
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Create Association
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Total Associations</p>
          <p className="text-3xl font-bold mt-1">--</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-3xl font-bold mt-1">--</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-3xl font-bold mt-1">--</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Country</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Members</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Created</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="p-8 text-center text-muted-foreground">
                No associations loaded. Connect SDK to populate data.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
