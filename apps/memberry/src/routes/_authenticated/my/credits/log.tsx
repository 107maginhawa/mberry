import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/my/credits/log')({
  component: CreditLog,
})

function CreditLog() {
  const [activityName, setActivityName] = useState('')
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0])
  const [creditAmount, setCreditAmount] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activityName.trim() || !creditAmount) {
      toast.error('Activity name and credit amount are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/persons/me/credit-entries', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityName: activityName.trim(),
          activityDate,
          creditAmount: parseFloat(creditAmount),
          description: description.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success('Credit entry added')
      setActivityName('')
      setCreditAmount('')
      setDescription('')
    } catch {
      toast.error('Failed to add credit entry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <a href="/my/credits" className="text-[13px] text-[var(--color-muted)] hover:text-[var(--color-text)]">← Back to Credits</a>
      <h1 className="text-[24px] font-display font-bold">Log Manual Credit</h1>
      <p className="text-[14px] text-[var(--color-muted)]">Self-report CPD credits from external activities (BR-13: no officer approval required)</p>

      <form onSubmit={handleSubmit} className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-6 space-y-4 max-w-lg">
        <div className="space-y-1.5">
          <Label>Activity Name *</Label>
          <Input
            value={activityName}
            onChange={(e) => setActivityName(e.target.value)}
            placeholder="e.g. Dental Photography Workshop"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Date *</Label>
            <Input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Credit Hours *</Label>
            <Input
              type="number"
              min="0.5"
              step="0.5"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="e.g. 4"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Description (optional)</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the activity"
          />
        </div>
        <Button type="submit" disabled={saving || !activityName.trim() || !creditAmount}>
          {saving ? 'Saving...' : 'Add Credit Entry'}
        </Button>
      </form>
    </div>
  )
}
