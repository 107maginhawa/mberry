import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Info, MapPin } from 'lucide-react'

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

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }))
  const field = (key: string) => ({
    value: (form as any)[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(key, e.target.value),
  })

  const saveMutation = useMutation({
    mutationFn: async (status: 'draft' | 'published') => {
      const payload = {
        ...form,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        creditAmount: parseFloat(String(form.creditAmount)) || 0,
        registrationFee: parseInt(String(form.registrationFee)) || 0,
        capacity: form.capacity ? parseInt(String(form.capacity)) : undefined,
        status,
      }
      const url = isEdit
        ? `/api/training/update/${orgId}/${trainingId}`
        : `/api/training/create/${orgId}`
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to save training')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trainings', orgId] })
      navigate({ to: `/org/${orgId}/officer/training/${data.data.id}` as any })
    },
  })

  const inputClass =
    'w-full text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring'
  const labelClass = 'block text-sm font-medium mb-1'
  const sectionClass = 'border rounded-xl p-5 space-y-4 bg-card'

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Core info */}
      <div className={sectionClass}>
        <h2 className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" /> Basic Info</h2>

        <div>
          <label className={labelClass}>Type</label>
          <select className={inputClass} {...field('type')}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label className={labelClass}>Title <span className="text-destructive">*</span></label>
          <input type="text" className={inputClass} placeholder="Training title" {...field('title')} />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            rows={4}
            className={inputClass}
            placeholder="What will participants learn?"
            {...field('description')}
          />
        </div>
      </div>

      {/* Schedule */}
      <div className={sectionClass}>
        <h2 className="font-semibold">Schedule</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Start Date & Time <span className="text-destructive">*</span></label>
            <input type="datetime-local" className={inputClass} {...field('startDate')} />
          </div>
          <div>
            <label className={labelClass}>End Date & Time</label>
            <input type="datetime-local" className={inputClass} {...field('endDate')} />
          </div>
        </div>
      </div>

      {/* Location */}
      <div className={sectionClass}>
        <h2 className="font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Location
        </h2>
        <div>
          <label className={labelClass}>Location</label>
          <input type="text" className={inputClass} placeholder="e.g. Manila Hotel, Ballroom or https://zoom.us/j/..." {...field('location')} />
        </div>
      </div>

      {/* Credits */}
      <div className={sectionClass}>
        <h2 className="font-semibold">Credits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>CPE Credit Amount</label>
            <input type="number" min="0" step="0.5" className={inputClass} {...field('creditAmount')} />
          </div>
          <div>
            <label className={labelClass}>Capacity</label>
            <input type="number" min="1" className={inputClass} placeholder="Unlimited" {...field('capacity')} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Registration Fee (PHP)</label>
          <input type="number" min="0" className={inputClass} {...field('registrationFee')} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={saveMutation.isPending || !form.title || !form.startDate}
          onClick={() => saveMutation.mutate('draft')}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          type="button"
          disabled={saveMutation.isPending || !form.title || !form.startDate}
          onClick={() => saveMutation.mutate('published')}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Publishing…' : 'Publish'}
        </button>
        {saveMutation.isError && (
          <span className="text-sm text-destructive self-center">Failed to save. Try again.</span>
        )}
      </div>
    </div>
  )
}
