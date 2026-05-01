import { createFileRoute } from '@tanstack/react-router'
import { ShieldCheck, Plus } from 'lucide-react'

export const Route = createFileRoute('/operators/')({
  component: OperatorsPage,
})

function OperatorsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Operators
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage platform administrators and their roles
            </p>
          </div>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Invite Operator
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Name</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Last Active</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                No operators loaded. Connect SDK to populate data.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
