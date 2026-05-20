import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
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

const creditLogSchema = z.object({
  activityName: z.string().min(1, 'Activity name is required'),
  activityDate: z.string().min(1, 'Date is required'),
  creditAmount: z
    .number()
    .positive('Credit hours must be greater than 0')
    .min(0.5, 'Minimum 0.5 credit hours'),
  description: z.string().optional(),
})

type CreditLogFormData = z.infer<typeof creditLogSchema>

function CreditLog() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreditLogFormData>({
    resolver: zodResolver(creditLogSchema),
    defaultValues: {
      activityName: '',
      activityDate: new Date().toISOString().split('T')[0],
      creditAmount: undefined,
      description: '',
    },
  })

  async function onSubmit(data: CreditLogFormData) {
    try {
      await api.post('/api/persons/me/credit-entries', {
        activityName: data.activityName.trim(),
        activityDate: data.activityDate,
        creditAmount: data.creditAmount,
        description: data.description?.trim() || undefined,
      })
      toast.success('Credit entry added')
      reset({
        activityName: '',
        activityDate: new Date().toISOString().split('T')[0],
        creditAmount: undefined,
        description: '',
      })
    } catch {
      toast.error('Failed to add credit entry')
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="activityName">Activity Name *</Label>
            <Input
              id="activityName"
              placeholder="e.g. Dental Photography Workshop"
              aria-describedby={errors.activityName ? 'activityName-error' : undefined}
              {...register('activityName')}
            />
            {errors.activityName && (
              <p id="activityName-error" role="alert" className="text-xs text-[var(--color-error)]">
                {errors.activityName.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="activityDate">Date *</Label>
              <Input
                id="activityDate"
                type="date"
                aria-describedby={errors.activityDate ? 'activityDate-error' : undefined}
                {...register('activityDate')}
              />
              {errors.activityDate && (
                <p id="activityDate-error" role="alert" className="text-xs text-[var(--color-error)]">
                  {errors.activityDate.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creditAmount">Credit Hours *</Label>
              <Input
                id="creditAmount"
                type="number"
                min="0.5"
                step="0.5"
                placeholder="e.g. 4"
                aria-describedby={errors.creditAmount ? 'creditAmount-error' : undefined}
                {...register('creditAmount', { valueAsNumber: true })}
              />
              {errors.creditAmount && (
                <p id="creditAmount-error" role="alert" className="text-xs text-[var(--color-error)]">
                  {errors.creditAmount.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="Brief description of the activity"
              {...register('description')}
            />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add Credit Entry'}
          </Button>
        </form>
      </GlassCard>
    </div>
  )
}
