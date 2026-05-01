import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/my/id-card')({
  component: MyIdCard,
})

function MyIdCard() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Digital ID Card</h1>
      <p className="text-sm text-muted-foreground">Your verified member identification card</p>

      <div className="max-w-md mx-auto border-2 rounded-xl p-6 space-y-4 bg-card">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 rounded-full bg-muted mx-auto flex items-center justify-center text-2xl font-bold text-muted-foreground">?</div>
          <p className="font-bold text-lg">Member Name</p>
          <p className="text-sm text-muted-foreground">License: —</p>
        </div>
        <div className="border-t pt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Organization</span><span>—</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>—</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>—</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Valid Until</span><span>—</span></div>
        </div>
        <div className="border-t pt-4 text-center">
          <div className="w-24 h-24 bg-muted mx-auto rounded flex items-center justify-center text-xs text-muted-foreground">QR Code</div>
          <p className="text-xs text-muted-foreground mt-2">Verified by Memberry</p>
        </div>
      </div>

      <div className="text-center">
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium" disabled>
          Download PDF
        </button>
      </div>
    </div>
  )
}
