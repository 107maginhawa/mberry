import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getDuesConfigOptions,
  getDuesConfigQueryKey,
  createDuesConfigMutation,
  updateDuesConfigMutation,
} from '@monobase/sdk-ts/generated/react-query'
import type { GetDuesConfigData } from '@monobase/sdk-ts/generated/types.gen'

/** SDK path type doesn't include `headers`; extend locally until TypeSpec is updated. */
type GetDuesConfigDataWithHeaders = GetDuesConfigData & {
  headers?: Record<string, string>
}

/**
 * Hand-wired endpoint shape — extends the TypeSpec DuesConfig with extra fields
 * returned by the association:member dues-configs endpoint.
 */
interface HandwiredDuesConfig {
  id?: string
  annualAmount?: number | bigint
  defaultAmount?: number | bigint
  currency?: string
  billingFrequency?: 'annual' | 'semi-annual' | 'quarterly'
  dueDateMonth?: number
  dueDateDay?: number
  gracePeriodDays?: number
  reminderSchedules?: Array<{
    daysOffset: number
    enabled: boolean
    channelInapp: boolean
    channelPush: boolean
    channelEmail: boolean
    isCustom: boolean
  }>
}
import { Button } from '@monobase/ui'
import { Checkbox } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { Switch } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { toast } from 'sonner'
import { parseCentsInput } from '../lib/money'
import { chooseMutationAction, buildCreatePayload, buildUpdatePayload } from './dues-config-form.utils'

const duesConfigSchema = z.object({
  defaultAmount: z
    .number({ error: 'Amount is required' })
    .positive('Amount must be greater than 0'),
  gracePeriodDays: z
    .number({ error: 'Grace period is required' })
    .int('Grace period must be a whole number')
    .min(0, 'Grace period must be 0 or more days')
    .max(90, 'Grace period must be 90 days or fewer'),
})

type DuesConfigFormData = z.infer<typeof duesConfigSchema>

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

function getBillingDates(frequency: string, cycleStartMonth: number, dueDateDay: number): string {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const ordinal = (d: number) => d + (['th','st','nd','rd'][(d % 100 - 20) % 10] || ['th','st','nd','rd'][d % 100] || 'th')
  const dayStr = ordinal(dueDateDay)

  switch (frequency) {
    case 'annual':
      return `Dues due on the ${dayStr} of ${months[cycleStartMonth - 1]} each year`
    case 'semi-annual': {
      const m2 = (cycleStartMonth + 5) % 12 // +6 months, 0-indexed
      return `Dues due on the ${dayStr} of ${months[cycleStartMonth - 1]} and ${months[m2]}`
    }
    case 'quarterly': {
      const qMonths = [0, 3, 6, 9].map(offset => months[(cycleStartMonth - 1 + offset) % 12])
      return `Dues due on the ${dayStr} of ${qMonths.join(', ')}`
    }
    default:
      return ''
  }
}

export function DuesConfigForm({ orgId }: DuesConfigFormProps) {
  const queryClient = useQueryClient()

  const [currency, setCurrency] = useState('PHP')
  const [billingFrequency, setBillingFrequency] = useState<'annual' | 'semi-annual' | 'quarterly'>('annual')
  const [dueDateMonth, setDueDateMonth] = useState('1')
  const [dueDateDay, setDueDateDay] = useState('1')
  const [reminders, setReminders] = useState<ReminderRow[]>(DEFAULT_REMINDERS)
  const [hasChanges, setHasChanges] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<DuesConfigFormData>({
    mode: 'onBlur',
    resolver: zodResolver(duesConfigSchema),
    defaultValues: {
      defaultAmount: undefined,
      gracePeriodDays: 30,
    },
  })

  // Hand-wired endpoint shape differs from TypeSpec DuesConfig.
  // Stable select avoids new object ref on every render (prevents re-fetch loop).
  const selectConfig = useCallback(
    (res: unknown) => (res as { data?: HandwiredDuesConfig } | null)?.data ?? (res as HandwiredDuesConfig | null),
    []
  )

  const { data: config, isLoading } = useQuery({
    ...getDuesConfigOptions(
      { path: { duesConfigId: orgId }, headers: { 'x-org-id': orgId } } as unknown as GetDuesConfigDataWithHeaders
    ),
    select: selectConfig,
    // 404 = org has no config yet (expected). Don't retry — show defaults immediately.
    retry: false,
  })

  const configAmount = config?.annualAmount ?? config?.defaultAmount
  const hasConfig = config && configAmount != null

  // Sync server config into form state when data loads or orgId changes.
  // Using orgId as a key dependency ensures the form resets cleanly on org-switch.
  useEffect(() => {
    if (!hasConfig || !config) return
    setValue('defaultAmount', Number(configAmount) / 100)
    setValue('gracePeriodDays', config.gracePeriodDays ?? 30)
    setCurrency(config.currency ?? 'PHP')
    setBillingFrequency((config.billingFrequency as 'annual' | 'semi-annual' | 'quarterly') ?? 'annual')
    setDueDateMonth(String(config.dueDateMonth ?? 1))
    setDueDateDay(String(config.dueDateDay ?? 1))
    if ((config.reminderSchedules?.length ?? 0) > 0) {
      setReminders(config.reminderSchedules ?? [])
    }
    setHasChanges(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, hasConfig])

  const onMutationSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: getDuesConfigQueryKey(
        { path: { duesConfigId: orgId }, headers: { 'x-org-id': orgId } } as unknown as GetDuesConfigDataWithHeaders
      ),
    })
    toast.success('Dues configuration saved', { description: 'Applies to future billing cycles.' })
    setHasChanges(false)
  }

  const onMutationError = () => {
    toast.error('Failed to save', { description: 'Please try again.' })
  }

  const createMutation = useMutation({
    ...createDuesConfigMutation(),
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  })

  const updateMutation = useMutation({
    ...updateDuesConfigMutation(),
    onSuccess: onMutationSuccess,
    onError: onMutationError,
  })

  const action = chooseMutationAction(config)
  const saveMutation = action === 'create' ? createMutation : updateMutation

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
  }

  function onSubmit(data: DuesConfigFormData) {
    const formState = {
      defaultAmount: String(data.defaultAmount),
      gracePeriodDays: String(data.gracePeriodDays),
    }
    if (action === 'create') {
      createMutation.mutate({ body: buildCreatePayload(orgId, formState, { currency }), headers: { 'x-org-id': orgId } })
    } else {
      updateMutation.mutate({ path: { duesConfigId: orgId }, body: buildUpdatePayload(formState), headers: { 'x-org-id': orgId } })
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {!hasConfig && (
        <p className="text-sm text-[var(--color-muted)]">Set up your dues structure to start collecting membership dues.</p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <section className="space-y-4">
          <h3 className="text-h3">Default Dues</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="defaultAmount">Annual Dues Amount</Label>
              <Input
                id="defaultAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                aria-describedby={errors.defaultAmount ? 'defaultAmount-error' : undefined}
                {...register('defaultAmount', { valueAsNumber: true, onChange: () => setHasChanges(true) })}
              />
              {errors.defaultAmount && (
                <p id="defaultAmount-error" role="alert" className="text-xs text-[var(--color-error)] mt-1">
                  {errors.defaultAmount.message}
                </p>
              )}
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => { setCurrency(v); setHasChanges(true) }}>
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
              <Select value={billingFrequency} onValueChange={(v) => { setBillingFrequency(v as 'annual' | 'semi-annual' | 'quarterly'); setHasChanges(true) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="semi-annual">Semi-Annual</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <div className="flex gap-2">
                {(billingFrequency === 'annual' || billingFrequency === 'semi-annual' || billingFrequency === 'quarterly') && (
                  <Select value={dueDateMonth} onValueChange={(v) => { setDueDateMonth(v); setHasChanges(true) }}>
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
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={dueDateDay}
                  onChange={(e) => { setDueDateDay(e.target.value); setHasChanges(true) }}
                  className="w-20"
                />
              </div>
            </div>
          </div>
          {getBillingDates(billingFrequency, Number(dueDateMonth), Number(dueDateDay)) && (
            <p className="text-sm text-muted-foreground mt-2">
              {getBillingDates(billingFrequency, Number(dueDateMonth), Number(dueDateDay))}
            </p>
          )}
          <div>
            <Label htmlFor="gracePeriodDays">Grace Period (days)</Label>
            <Input
              id="gracePeriodDays"
              type="number"
              min="0"
              max="90"
              className="w-32"
              aria-describedby={errors.gracePeriodDays ? 'gracePeriodDays-error' : 'gracePeriodDays-hint'}
              {...register('gracePeriodDays', { valueAsNumber: true, onChange: () => setHasChanges(true) })}
            />
            {errors.gracePeriodDays && (
              <p id="gracePeriodDays-error" role="alert" className="text-xs text-[var(--color-error)] mt-1">
                {errors.gracePeriodDays.message}
              </p>
            )}
            <p id="gracePeriodDays-hint" className="text-xs text-[var(--color-muted)] mt-1">Members have this many days after due date before status changes to Lapsed (0–90 days).</p>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-h3">Reminder Schedule</h3>
          <div className="space-y-2">
            {reminders.map((r, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <Switch checked={r.enabled} onCheckedChange={(checked) => { const updated = [...reminders]; updated[i] = { ...updated[i]!, enabled: checked }; setReminders(updated); setHasChanges(true) }} />
                <span className="w-40">{r.daysOffset < 0 ? `${Math.abs(r.daysOffset)} days before` : r.daysOffset === 0 ? 'Day of expiry' : `${r.daysOffset} days after`}</span>
                <Label className="flex items-center gap-1"><Checkbox checked={r.channelPush} onCheckedChange={(checked) => { const updated = [...reminders]; updated[i] = { ...updated[i]!, channelPush: checked as boolean }; setReminders(updated); setHasChanges(true) }} />Push</Label>
                <Label className="flex items-center gap-1"><Checkbox checked={r.channelEmail} onCheckedChange={(checked) => { const updated = [...reminders]; updated[i] = { ...updated[i]!, channelEmail: checked as boolean }; setReminders(updated); setHasChanges(true) }} />Email</Label>
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-3">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
          {hasChanges && <span className="text-xs text-[var(--color-muted)] self-center">Unsaved changes</span>}
        </div>
      </form>
    </div>
  )
}
