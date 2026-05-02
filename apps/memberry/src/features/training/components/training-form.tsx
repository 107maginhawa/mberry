import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Info, MapPin, Globe } from 'lucide-react'

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

const ENROLLMENT_MODES = [
  { value: 'open', label: 'Open — anyone can enroll' },
  { value: 'approval_required', label: 'Approval Required' },
  { value: 'invitation_only', label: 'Invitation Only' },
]

const REGULATORY_OPTIONS = [
  { value: 'not_applicable', label: 'Not Applicable' },
  { value: 'prc_approved', label: 'PRC Approved' },
  { value: 'pending_approval', label: 'Pending Approval' },
]

const VISIBILITY_OPTIONS = [
  { value: 'network', label: 'Network — all members' },
  { value: 'private', label: 'Private — invite only' },
  { value: 'public', label: 'Public — anyone with link' },
]

export function TrainingForm({ orgId, initial, trainingId }: TrainingFormProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = !!trainingId

  const [form, setForm] = useState({
    type: initial?.type ?? 'seminar',
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    startAt: initial?.startAt ? new Date(initial.startAt).toISOString().slice(0, 16) : '',
    endAt: initial?.endAt ? new Date(initial.endAt).toISOString().slice(0, 16) : '',
    scheduleDescription: initial?.scheduleDescription ?? '',
    locationType: initial?.locationType ?? 'in_person',
    venue: initial?.locationDetails?.venue ?? '',
    address: initial?.locationDetails?.address ?? '',
    meetingUrl: initial?.locationDetails?.meetingUrl ?? '',
    coverImage: initial?.coverImage ?? '',
    creditValue: initial?.creditValue ?? '0',
    regulatoryApproval: initial?.regulatoryApproval ?? 'not_applicable',
    regulatoryReference: initial?.regulatoryReference ?? '',
    enrollmentMode: initial?.enrollmentMode ?? 'open',
    fee: initial?.fee ?? 0,
    capacity: initial?.capacity ?? '',
    visibility: initial?.visibility ?? 'network',
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
        startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
        locationDetails: {
          venue: form.venue,
          address: form.address,
          meetingUrl: form.meetingUrl,
        },
        creditValue: parseFloat(form.creditValue) || 0,
        fee: parseInt(String(form.fee)) || 0,
        capacity: form.capacity ? parseInt(String(form.capacity)) : undefined,
        status,
      }
      const url = isEdit
        ? `/api/training/update/${trainingId}`
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
            <input type="datetime-local" className={inputClass} {...field('startAt')} />
          </div>
          <div>
            <label className={labelClass}>End Date & Time</label>
            <input type="datetime-local" className={inputClass} {...field('endAt')} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Multi-session schedule (optional)</label>
          <textarea
            rows={2}
            className={inputClass}
            placeholder="e.g. Saturdays, Jan 4–Feb 1, 9am–12pm"
            {...field('scheduleDescription')}
          />
        </div>
      </div>

      {/* Location */}
      <div className={sectionClass}>
        <h2 className="font-semibold flex items-center gap-2">
          {form.locationType === 'online' ? <Globe className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
          Location
        </h2>

        <div className="flex gap-3">
          {['in_person', 'online', 'hybrid'].map((lt) => (
            <label key={lt} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="locationType"
                value={lt}
                checked={form.locationType === lt}
                onChange={() => set('locationType', lt)}
              />
              <span className="capitalize">{lt.replace('_', '-')}</span>
            </label>
          ))}
        </div>

        {form.locationType !== 'online' && (
          <>
            <div>
              <label className={labelClass}>Venue Name</label>
              <input type="text" className={inputClass} placeholder="e.g. Manila Hotel, Ballroom" {...field('venue')} />
            </div>
            <div>
              <label className={labelClass}>Address</label>
              <input type="text" className={inputClass} placeholder="Full address" {...field('address')} />
            </div>
          </>
        )}
        {form.locationType !== 'in_person' && (
          <div>
            <label className={labelClass}>Meeting URL</label>
            <input type="url" className={inputClass} placeholder="https://zoom.us/j/..." {...field('meetingUrl')} />
          </div>
        )}
      </div>

      {/* Credits & Regulatory */}
      <div className={sectionClass}>
        <h2 className="font-semibold">Credits & Regulatory</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>CPE Credit Value</label>
            <input type="number" min="0" step="0.5" className={inputClass} {...field('creditValue')} />
          </div>
          <div>
            <label className={labelClass}>Regulatory Approval</label>
            <select className={inputClass} {...field('regulatoryApproval')}>
              {REGULATORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        {form.regulatoryApproval !== 'not_applicable' && (
          <div>
            <label className={labelClass}>Regulatory Reference No.</label>
            <input type="text" className={inputClass} placeholder="e.g. PRC Resolution No. ..." {...field('regulatoryReference')} />
          </div>
        )}
      </div>

      {/* Enrollment */}
      <div className={sectionClass}>
        <h2 className="font-semibold">Enrollment & Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Enrollment Mode</label>
            <select className={inputClass} {...field('enrollmentMode')}>
              {ENROLLMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Capacity</label>
            <input type="number" min="1" className={inputClass} placeholder="Unlimited" {...field('capacity')} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fee (PHP)</label>
            <input type="number" min="0" className={inputClass} {...field('fee')} />
          </div>
          <div>
            <label className={labelClass}>Visibility</label>
            <select className={inputClass} {...field('visibility')}>
              {VISIBILITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Cover image */}
      <div className={sectionClass}>
        <h2 className="font-semibold">Cover Image</h2>
        <div>
          <label className={labelClass}>Image URL</label>
          <input type="url" className={inputClass} placeholder="https://..." {...field('coverImage')} />
        </div>
        {form.coverImage && (
          <img src={form.coverImage} alt="Cover preview" className="rounded-lg h-32 object-cover" />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={saveMutation.isPending || !form.title || !form.startAt}
          onClick={() => saveMutation.mutate('draft')}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          type="button"
          disabled={saveMutation.isPending || !form.title || !form.startAt}
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
