import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createElectionMutation,
  listElectionsQueryKey,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

interface Position {
  id: string
  title: string
  sortOrder: number
}

interface ElectionFormProps {
  orgId: string
  onSuccess?: (election: any) => void
  onCancel?: () => void
}

type Step = 'basics' | 'positions' | 'timeline'

const STEPS: { key: Step; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'positions', label: 'Positions' },
  { key: 'timeline', label: 'Timeline' },
]

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 16)
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function ElectionForm({ orgId, onSuccess, onCancel }: ElectionFormProps) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('basics')
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    type: 'officer' as 'officer' | 'bylaw',
    votingMode: 'online' as 'online' | 'in_person' | 'hybrid',
    passageThreshold: '',
    nominationsOpenAt: '',
    nominationsCloseAt: '',
    votingOpenAt: '',
    votingCloseAt: '',
  })

  const [positions, setPositions] = useState<Position[]>([
    { id: generateId(), title: '', sortOrder: 0 },
  ])

  function setField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addPosition() {
    setPositions((prev) => [
      ...prev,
      { id: generateId(), title: '', sortOrder: prev.length },
    ])
  }

  function removePosition(id: string) {
    setPositions((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, sortOrder: i })))
  }

  function updatePositionTitle(id: string, title: string) {
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)))
  }

  const mutation = useMutation({
    mutationFn: createElectionMutation().mutationFn,
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: listElectionsQueryKey({ query: { organizationId: orgId } }) })
      onSuccess?.(data)
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  function canProceed() {
    if (step === 'basics') return form.title.trim().length > 0
    if (step === 'positions') return positions.some((p) => p.title.trim().length > 0)
    return true
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i < stepIndex && setStep(s.key)}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                s.key === step
                  ? 'text-primary'
                  : i < stepIndex
                  ? 'text-foreground cursor-pointer hover:text-primary'
                  : 'text-muted-foreground cursor-default'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                s.key === step
                  ? 'bg-primary text-primary-foreground'
                  : i < stepIndex
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <span className="text-muted-foreground">›</span>}
          </div>
        ))}
      </div>

      {/* Step: Basics */}
      {step === 'basics' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Election Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. 2025 Board of Directors Election"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['officer', 'bylaw'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setField('type', t)}
                  className={`border rounded-lg p-3 text-left transition-colors ${
                    form.type === t ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <p className="font-medium capitalize">{t}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t === 'officer' ? 'Elect officers to positions' : 'Vote on bylaw amendments'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Voting Mode</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['online', 'in_person', 'hybrid'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setField('votingMode', m)}
                  className={`border rounded-lg p-2.5 text-sm text-center capitalize transition-colors ${
                    form.votingMode === m ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-muted/50'
                  }`}
                >
                  {m.replace('_', '-')}
                </button>
              ))}
            </div>
          </div>

          {form.type === 'bylaw' && (
            <div className="space-y-1.5">
              <Label htmlFor="threshold">Passage Threshold (%)</Label>
              <Input
                id="threshold"
                type="number"
                min="1"
                max="100"
                value={form.passageThreshold}
                onChange={(e) => setField('passageThreshold', e.target.value)}
                placeholder="e.g. 67"
              />
              <p className="text-xs text-muted-foreground">Percentage of votes needed to pass (e.g. 67 for two-thirds majority)</p>
            </div>
          )}
        </div>
      )}

      {/* Step: Positions */}
      {step === 'positions' && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Positions</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {form.type === 'officer' ? 'Add the officer positions to be elected' : 'Add the bylaw items to be voted on'}
            </p>
          </div>

          <div className="space-y-2">
            {positions.map((pos, i) => (
              <div key={pos.id} className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 cursor-grab" />
                <Input
                  value={pos.title}
                  onChange={(e) => updatePositionTitle(pos.id, e.target.value)}
                  placeholder={form.type === 'officer' ? `e.g. President` : `e.g. Amendment ${i + 1}`}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removePosition(pos.id)}
                  disabled={positions.length === 1}
                  className="p-2 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addPosition}
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Plus className="w-4 h-4" />
            Add position
          </button>
        </div>
      )}

      {/* Step: Timeline */}
      {step === 'timeline' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">All dates are optional. You can set them later.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nom-open">Nominations Open</Label>
              <Input
                id="nom-open"
                type="datetime-local"
                value={form.nominationsOpenAt}
                onChange={(e) => setField('nominationsOpenAt', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nom-close">Nominations Close</Label>
              <Input
                id="nom-close"
                type="datetime-local"
                value={form.nominationsCloseAt}
                onChange={(e) => setField('nominationsCloseAt', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vote-open">Voting Opens</Label>
              <Input
                id="vote-open"
                type="datetime-local"
                value={form.votingOpenAt}
                onChange={(e) => setField('votingOpenAt', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vote-close">Voting Closes</Label>
              <Input
                id="vote-close"
                type="datetime-local"
                value={form.votingCloseAt}
                onChange={(e) => setField('votingCloseAt', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => setStep(STEPS[stepIndex - 1]!.key)}
              className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
            >
              Back
            </button>
          )}
          {stepIndex < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(STEPS[stepIndex + 1]!.key)}
              disabled={!canProceed()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                mutation.mutate({
                  body: {
                    organizationId: orgId,
                    title: form.title,
                    electionType: form.type === 'bylaw' ? 'special' : 'general',
                    positions: positions.filter((p) => p.title.trim()).map((p) => p.id),
                    nominationStart: form.nominationsOpenAt ? new Date(form.nominationsOpenAt) : new Date(),
                    nominationEnd: form.nominationsCloseAt ? new Date(form.nominationsCloseAt) : new Date(),
                    votingStart: form.votingOpenAt ? new Date(form.votingOpenAt) : new Date(),
                    votingEnd: form.votingCloseAt ? new Date(form.votingCloseAt) : new Date(),
                    ...(form.type === 'bylaw' && form.passageThreshold ? { quorumRequired: parseInt(form.passageThreshold, 10) } : {}),
                  },
                })
              }}
              disabled={mutation.isPending || !form.title.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Save as Draft'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
