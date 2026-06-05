import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Info, MapPin } from 'lucide-react'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { DateTimePicker } from '@/components/patterns/date-picker'
import {
  createTrainingMutation,
  updateTrainingMutation,
  searchTrainingsQueryKey,
} from '@monobase/sdk-ts/generated/react-query'

interface TrainingFormProps {
  orgId: string
  initial?: any
  trainingId?: string
}

const TYPES = [
  { value: 'seminar', label: 'Seminar' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'convention', label: 'Convention' },
  { value: 'online_course', label: 'Online Course' },
  { value: 'skills_training', label: 'Skills Training' },
]

export function TrainingForm({ orgId, initial, trainingId }: TrainingFormProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = !!trainingId

  const [form, setForm] = useState({
    type: initial?.type ?? 'seminar',
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    startDate: initial?.startDate ? new Date(initial.startDate).toISOString().slice(0, 16) : '',
    endDate: initial?.endDate ? new Date(initial.endDate).toISOString().slice(0, 16) : '',
    location: initial?.location ?? '',
    creditAmount: initial?.creditAmount ?? '0',
    registrationFee: initial?.registrationFee ?? 0,
    capacity: initial?.capacity ?? '',
  })

  const set = (key: string, val: unknown) => setForm((f) => ({ ...f, [key]: val }))
  const field = (key: string) => ({
    value: (form as Record<string, unknown>)[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(key, e.target.value),
  })

  const createMut = useMutation(createTrainingMutation())
  const updateMut = useMutation(updateTrainingMutation())

  const saveMutation = useMutation({
    mutationFn: async (status: 'draft' | 'published') => {
      const payload = {
        title: form.title,
        organizationId: orgId,
        type: form.type as 'seminar' | 'workshop' | 'webinar' | 'self_paced' | 'hands_on',
        startDate: form.startDate ? new Date(form.startDate) : new Date(),
        endDate: form.endDate ? new Date(form.endDate) : undefined,
        location: form.location || undefined,
        creditAmount: parseFloat(String(form.creditAmount)) || 0,
        registrationFee: BigInt(Math.round((parseInt(String(form.registrationFee)) || 0) * 100)),
        capacity: form.capacity ? parseInt(String(form.capacity)) : undefined,
        description: form.description || undefined,
      }
      if (isEdit && trainingId) {
        return updateMut.mutateAsync({ path: { trainingId }, body: payload, headers: { 'x-org-id': orgId } } as any)
      } else {
        return createMut.mutateAsync({ body: payload, headers: { 'x-org-id': orgId } } as any)
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: searchTrainingsQueryKey() })
      const id = data?.id ?? data?.data?.id ?? trainingId
      if (id) {
        navigate({ to: '/org/$orgSlug/officer/training/$trainingId', params: { orgSlug, trainingId: id } })
      }
    },
    onError: (err) => toast.error(err.message || 'Failed to save training'),
  })

  const sectionClass = 'border rounded-xl p-5 space-y-4 bg-[var(--color-surface)]'

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Core info */}
      <div className={sectionClass}>
        <h2 className="text-h4 flex items-center gap-2"><Info className="w-4 h-4" /> Basic Info</h2>

        <div>
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(val) => set('type', val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Title <span className="text-[var(--color-error)]">*</span></Label>
          <Input type="text" placeholder="Training title" {...field('title')} />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            rows={4}
            placeholder="What will participants learn?"
            {...field('description')}
          />
        </div>
      </div>

      {/* Schedule */}
      <div className={sectionClass}>
        <h2 className="text-h4">Schedule</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Start Date & Time <span className="text-[var(--color-error)]">*</span></Label>
            <DateTimePicker
              value={form.startDate ? new Date(form.startDate).toISOString() : undefined}
              onValueChange={(iso) => set('startDate', new Date(iso).toISOString().slice(0, 16))}
              placeholder="Select start date & time"
            />
          </div>
          <div>
            <Label>End Date & Time</Label>
            <DateTimePicker
              value={form.endDate ? new Date(form.endDate).toISOString() : undefined}
              onValueChange={(iso) => set('endDate', new Date(iso).toISOString().slice(0, 16))}
              placeholder="Select end date & time"
            />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className={sectionClass}>
        <h2 className="text-h4 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Location
        </h2>
        <div>
          <Label>Location</Label>
          <Input type="text" placeholder="e.g. Manila Hotel, Ballroom or https://zoom.us/j/..." {...field('location')} />
        </div>
      </div>

      {/* Credits */}
      <div className={sectionClass}>
        <h2 className="text-h4">Credits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>CPE Credit Amount</Label>
            <Input type="number" min={0} step={0.5} {...field('creditAmount')} />
          </div>
          <div>
            <Label>Capacity</Label>
            <Input type="number" min={1} placeholder="Unlimited" {...field('capacity')} />
          </div>
        </div>
        <div>
          <Label>Registration Fee (PHP)</Label>
          <Input type="number" min={0} {...field('registrationFee')} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          type="button"
          disabled={saveMutation.isPending || !form.title || !form.startDate}
          onClick={() => saveMutation.mutate('draft')}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
        </Button>
        <Button
          size="sm"
          type="button"
          disabled={saveMutation.isPending || !form.title || !form.startDate}
          onClick={() => saveMutation.mutate('published')}
        >
          {saveMutation.isPending ? 'Publishing…' : 'Publish'}
        </Button>
        {saveMutation.isError && (
          <span className="text-sm text-[var(--color-error)] self-center">Failed to save. Try again.</span>
        )}
      </div>
    </div>
  )
}
