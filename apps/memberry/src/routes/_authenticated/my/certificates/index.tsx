import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/my/certificates/')({
  component: MyCertificates,
})

function MyCertificates() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">My Certificates</h1>
      <p className="text-sm text-muted-foreground">Training certificates and credentials issued to you</p>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Certificate</th>
              <th className="text-left p-3 font-medium">Organization</th>
              <th className="text-left p-3 font-medium">Issued</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td colSpan={5} className="p-8 text-center text-muted-foreground">
                No certificates issued yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
