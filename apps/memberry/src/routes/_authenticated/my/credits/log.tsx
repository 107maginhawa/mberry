import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'

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
      await api.post('/api/persons/me/credit-entries', {
        activityName: activityName.trim(),
        activityDate,
        creditAmount: parseFloat(creditAmount),
        description: description.trim() || undefined,
      })
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
      <PageHeader
        title="Log Manual Credit"
        subtitle="Self-report CPD credits from external activities (BR-13: no officer approval required)"
        breadcrumbs={[
          { label: 'Credits', href: '/my/credits' },
          { label: 'Log Manual Credit' },
        ]}
      />

      <GlassCard className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
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
      </GlassCard>
    </div>
  )
}
