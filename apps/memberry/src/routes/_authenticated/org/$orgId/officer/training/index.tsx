import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/training/')({
  component: OfficerTraining,
})

function OfficerTraining() {
  const { orgId } = Route.useParams()

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Training</h1>
          <p className="text-sm text-muted-foreground">Manage training sessions and courses</p>
        </div>
        <a
          href={`/org/${orgId}/officer/training/new`}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
        >
          Create Training
        </a>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-left p-3 font-medium">Instructor</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Enrolled</th>
              <th className="text-left p-3 font-medium">Credits</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td colSpan={6} className="p-8 text-center text-muted-foreground">
                No training sessions yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
