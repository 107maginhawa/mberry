import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/my/credits/')({
  component: MyCredits,
})

function MyCredits() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">CPD Credits</h1>
      <p className="text-sm text-muted-foreground">Your professional development credit summary across all organizations</p>

      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Earned</p>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Required</p>
          <p className="text-2xl font-bold">—</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Carryover</p>
          <p className="text-2xl font-bold">0</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Remaining</p>
          <p className="text-2xl font-bold">—</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Credit Log</h2>
        <a href="/my/credits/log" className="text-sm text-primary hover:underline">View full log →</a>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Activity</th>
              <th className="text-left p-3 font-medium">Organization</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-right p-3 font-medium">Credits</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                No credits earned yet. Attend training sessions to earn credits automatically.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
