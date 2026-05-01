import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/my/credits/log')({
  component: CreditLog,
})

function CreditLog() {
  return (
    <div className="space-y-6 p-6">
      <a href="/my/credits" className="text-sm text-muted-foreground hover:text-foreground">← Back to Credits</a>
      <h1 className="text-2xl font-bold">Credit Log</h1>
      <p className="text-sm text-muted-foreground">Complete history of all credits earned and carried over</p>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Activity</th>
              <th className="text-left p-3 font-medium">Provider</th>
              <th className="text-left p-3 font-medium">Organization</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-left p-3 font-medium">Cycle</th>
              <th className="text-right p-3 font-medium">Credits</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td colSpan={7} className="p-8 text-center text-muted-foreground">
                No credit entries yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
