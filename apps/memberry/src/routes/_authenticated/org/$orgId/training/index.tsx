import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgId/training/')({
  component: OrgTraining,
})

function OrgTraining() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Training & Courses</h1>
      <p className="text-sm text-muted-foreground">Browse and enroll in training sessions</p>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Training</th>
              <th className="text-left p-3 font-medium">Instructor</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Credits</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                No training sessions available.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
