import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/reports/credits')({
  component: CreditReport,
})

function CreditReport() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Credit Compliance Report</h1>
      <p className="text-sm text-muted-foreground">Member CPD credit status across the organization</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Compliant</p>
          <p className="text-2xl font-bold text-green-600">0</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">At Risk</p>
          <p className="text-2xl font-bold text-yellow-600">0</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Non-Compliant</p>
          <p className="text-2xl font-bold text-red-600">0</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Member</th>
              <th className="text-left p-3 font-medium">Cycle</th>
              <th className="text-right p-3 font-medium">Earned</th>
              <th className="text-right p-3 font-medium">Required</th>
              <th className="text-right p-3 font-medium">Remaining</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td colSpan={6} className="p-8 text-center text-muted-foreground">
                No member credit data available.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
