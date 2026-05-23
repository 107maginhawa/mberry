import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { CardSkeleton } from '@/components/patterns/skeleton-loader'
import { useOrg } from '@/hooks/useOrg'
import { api } from '@/lib/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/settings/cpd')({
  component: CpdSettings,
})

function CpdSettings() {
  const { orgId } = useOrg()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['cpd-config', orgId],
    queryFn: () => api.get(`/api/association/member/cpd-config/${orgId}`),
    enabled: !!orgId,
  })

  const config = (data as any)?.data

  const [requiredCredits, setRequiredCredits] = useState(60)
  const [cycleLengthYears, setCycleLengthYears] = useState('3')
  const [sdlCapPercent, setSdlCapPercent] = useState(40)
  const [cycleStartMonth, setCycleStartMonth] = useState('1')

  useEffect(() => {
    if (config) {
      setRequiredCredits(config.requiredCredits ?? 60)
      setCycleLengthYears(String(config.cycleLengthYears ?? 3))
      setSdlCapPercent(config.sdlCapPercent ?? 40)
      setCycleStartMonth(String(config.cycleStartMonth ?? 1))
    }
  }, [config])

  const updateMutation = useMutation({
    mutationFn: (body: any) => api.patch(`/api/association/member/cpd-config/${orgId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cpd-config'] })
      toast.success('CPD configuration updated')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to update'),
  })

  const handleSave = () => {
    updateMutation.mutate({
      requiredCredits,
      cycleLengthYears: parseInt(cycleLengthYears, 10),
      sdlCapPercent,
      cycleStartMonth: parseInt(cycleStartMonth, 10),
    })
  }

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="CPD Settings" subtitle="Configure credit requirements and cycles" />
        <CardSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CPD Settings"
        subtitle="Configure credit requirements and cycles"
        actions={<Settings className="w-5 h-5 text-[var(--color-muted)]" />}
      />

      <GlassCard className="p-5 max-w-xl">
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium">Required Credits per Cycle</label>
            <input
              type="number"
              value={requiredCredits}
              onChange={e => setRequiredCredits(parseInt(e.target.value, 10) || 0)}
              min={1}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Cycle Length (years)</label>
            <Select value={cycleLengthYears} onValueChange={setCycleLengthYears}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 year</SelectItem>
                <SelectItem value="2">2 years</SelectItem>
                <SelectItem value="3">3 years</SelectItem>
                <SelectItem value="4">4 years</SelectItem>
                <SelectItem value="5">5 years</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">SDL Cap (%)</label>
            <input
              type="number"
              value={sdlCapPercent}
              onChange={e => setSdlCapPercent(parseInt(e.target.value, 10) || 0)}
              min={0}
              max={100}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-sm"
            />
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Maximum percentage of required credits that can come from Self-Directed Learning.
              Currently: {Math.floor((sdlCapPercent / 100) * requiredCredits)} credits max.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Cycle Start Month</label>
            <Select value={cycleStartMonth} onValueChange={setCycleStartMonth}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm hover:opacity-90 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
