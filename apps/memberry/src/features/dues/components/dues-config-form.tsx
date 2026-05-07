import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getDuesConfigOptions,
  getDuesConfigQueryKey,
  updateDuesConfigMutation,
} from '@monobase/sdk-ts/generated/react-query'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Switch } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { toast } from 'sonner'
import { parseCentsInput } from '../lib/money'

interface DuesConfigFormProps {
  orgId: string
}

interface ReminderRow {
  daysOffset: number
  enabled: boolean
  channelInapp: boolean
  channelPush: boolean
  channelEmail: boolean
  isCustom: boolean
}

const DEFAULT_REMINDERS: ReminderRow[] = [
  { daysOffset: -60, enabled: true, channelInapp: true, channelPush: true, channelEmail: true, isCustom: false },
  { daysOffset: -30, enabled: true, channelInapp: true, channelPush: true, channelEmail: true, isCustom: false },
  { daysOffset: -7, enabled: true, channelInapp: true, channelPush: true, channelEmail: true, isCustom: false },
  { daysOffset: 0, enabled: true, channelInapp: true, channelPush: true, channelEmail: false, isCustom: false },
  { daysOffset: 7, enabled: true, channelInapp: true, channelPush: false, channelEmail: true, isCustom: false },
  { daysOffset: 30, enabled: true, channelInapp: true, channelPush: false, channelEmail: true, isCustom: false },
]

export function DuesConfigForm({ orgId }: DuesConfigFormProps) {
  const queryClient = useQueryClient()

  const [defaultAmount, setDefaultAmount] = useState('')
  const [currency, setCurrency] = useState('PHP')
  const [billingFrequency, setBillingFrequency] = useState<'annual' | 'quarterly'>('annual')
  const [dueDateMonth, setDueDateMonth] = useState('1')
  const [dueDateDay, setDueDateDay] = useState('1')
  const [gracePeriodDays, setGracePeriodDays] = useState('30')
  const [reminders, setReminders] = useState<ReminderRow[]>(DEFAULT_REMINDERS)
  const [hasChanges, setHasChanges] = useState(false)

  // Config shape from hand-wired endpoint differs from TypeSpec DuesConfig — cast to any
   
  const { data: config, isLoading } = useQuery({
    ...getDuesConfigOptions({ path: { duesConfigId: orgId } }) as any,
    select: (res: any) => res?.data ?? res,
  }) as { data: any; isLoading: boolean }

  const configAmount = config?.annualAmount ?? config?.defaultAmount
  const hasConfig = config && configAmount != null

  useEffect(() => {
    if (hasConfig) {
      setDefaultAmount((Number(configAmount) / 100).toFixed(2))
      setCurrency(config.currency ?? 'PHP')
      setBillingFrequency(config.billingFrequency ?? 'annual')
      setDueDateMonth(String(config.dueDateMonth ?? 1))
      setDueDateDay(String(config.dueDateDay ?? 1))
      setGracePeriodDays(String(config.gracePeriodDays ?? 30))
      if (config.reminderSchedules?.length > 0) {
        setReminders(config.reminderSchedules)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when config existence changes
  }, [hasConfig])

  const saveMutation = useMutation({
    ...updateDuesConfigMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getDuesConfigQueryKey({ path: { duesConfigId: orgId } }) })
      toast.success('Dues configuration updated', { description: 'Applies to future billing cycles.' })
      setHasChanges(false)
    },
    onError: () => {
      toast.error('Failed to save', { description: 'Please try again.' })
    },
  } as any)

  const handleChange = () => setHasChanges(true)

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
  }

  const gracePeriodError = parseInt(gracePeriodDays) < 0 || parseInt(gracePeriodDays) > 365

  return (
    <div className="space-y-8 max-w-2xl">
      {!hasConfig && (
        <p className="text-sm text-muted-foreground">Set up your dues structure to start collecting membership dues.</p>
      )}

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Default Dues</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Default Amount</Label>
            <Input type="number" step="0.01" min="0" value={defaultAmount} onChange={(e) => { setDefaultAmount(e.target.value); handleChange() }} placeholder="0.00" />
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={(v) => { setCurrency(v); handleChange() }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PHP">PHP</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Billing Frequency</Label>
            <Select value={billingFrequency} onValueChange={(v) => { setBillingFrequency(v as any); handleChange() }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Due Date</Label>
            <div className="flex gap-2">
              {billingFrequency === 'annual' && (
                <Select value={dueDateMonth} onValueChange={(v) => { setDueDateMonth(v); handleChange() }}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {new Date(2000, i).toLocaleString('default', { month: 'short' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input type="number" min="1" max="31" value={dueDateDay} onChange={(e) => { setDueDateDay(e.target.value); handleChange() }} className="w-20" />
            </div>
          </div>
        </div>
        <div>
          <Label>Grace Period (days)</Label>
          <Input type="number" min="0" max="365" value={gracePeriodDays} onChange={(e) => { setGracePeriodDays(e.target.value); handleChange() }} className="w-32" />
          {gracePeriodError && <p className="text-xs text-destructive mt-1">Grace period must be 0–365 days.</p>}
          <p className="text-xs text-muted-foreground mt-1">Members have this many days after due date before status changes to Lapsed.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Reminder Schedule</h3>
        <div className="space-y-2">
          {reminders.map((r, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <Switch checked={r.enabled} onCheckedChange={(checked) => { const updated = [...reminders]; updated[i] = { ...updated[i]!, enabled: checked }; setReminders(updated); handleChange() }} />
              <span className="w-40">{r.daysOffset < 0 ? `${Math.abs(r.daysOffset)} days before` : r.daysOffset === 0 ? 'Day of expiry' : `${r.daysOffset} days after`}</span>
              <label className="flex items-center gap-1"><input type="checkbox" checked={r.channelPush} onChange={(e) => { const updated = [...reminders]; updated[i] = { ...updated[i]!, channelPush: e.target.checked }; setReminders(updated); handleChange() }} className="rounded" />Push</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={r.channelEmail} onChange={(e) => { const updated = [...reminders]; updated[i] = { ...updated[i]!, channelEmail: e.target.checked }; setReminders(updated); handleChange() }} className="rounded" />Email</label>
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-3">
        <Button onClick={() => (saveMutation as any).mutate({ path: { duesConfigId: orgId }, body: { defaultAmount: parseCentsInput(defaultAmount), currency, billingFrequency, dueDateMonth: billingFrequency === 'annual' ? parseInt(dueDateMonth) : null, dueDateDay: parseInt(dueDateDay), gracePeriodDays: parseInt(gracePeriodDays), reminderSchedules: reminders } })} disabled={saveMutation.isPending || gracePeriodError || !defaultAmount}>
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
        {hasChanges && <span className="text-xs text-muted-foreground self-center">Unsaved changes</span>}
      </div>
    </div>
  )
}
