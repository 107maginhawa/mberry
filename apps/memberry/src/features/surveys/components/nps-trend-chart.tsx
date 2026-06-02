import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Skeleton } from '@monobase/ui'
import { api } from '@/lib/api'

interface NpsTrendPoint {
  date: string
  score: number
  surveyTitle: string
  responseCount: number
}

interface NpsTrendChartProps {
  orgId: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', year: '2-digit' })
}

function TrendIndicator({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) return null
  const diff = current - previous
  if (Math.abs(diff) < 1) {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
        <Minus className="w-3 h-3" />
        Stable
      </span>
    )
  }
  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--color-success)]">
        <TrendingUp className="w-3 h-3" />
        +{diff.toFixed(0)}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-[var(--color-error)]">
      <TrendingDown className="w-3 h-3" />
      {diff.toFixed(0)}
    </span>
  )
}

export function NpsTrendChart({ orgId }: NpsTrendChartProps) {
  const { data: trends, isLoading, isError } = useQuery({
    queryKey: ['nps-trends', orgId],
    queryFn: () => api.get<NpsTrendPoint[]>(`/api/surveys/analytics/nps-trends?organizationId=${orgId}`),
  })

  if (isLoading) {
    return <Skeleton className="h-48 rounded-lg" />
  }

  if (isError) {
    return (
      <div role="alert" className="border rounded-lg p-4 bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
        Unable to load NPS trends. Please try refreshing the page.
      </div>
    )
  }

  if (!trends || trends.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-[var(--color-muted)]">
        <p className="text-sm">No NPS data yet</p>
        <p className="text-xs mt-1">NPS trends will appear after surveys are completed</p>
      </div>
    )
  }

  const latest = trends[trends.length - 1]!
  const previous = trends.length > 1 ? trends[trends.length - 2] : undefined
  const maxScore = Math.max(...trends.map((t) => Math.abs(t.score)), 50)
  const chartHeight = 120

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">NPS Trend</p>
          <p className="text-xs text-[var(--color-muted)]">Across all surveys</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-display">
            {latest.score > 0 ? '+' : ''}{latest.score.toFixed(0)}
          </p>
          <TrendIndicator current={latest.score} previous={previous?.score} />
        </div>
      </div>

      {/* CSS bar chart */}
      <div className="flex items-end gap-1" style={{ height: chartHeight }}>
        {trends.map((point, i) => {
          const normalizedHeight = (Math.abs(point.score) / maxScore) * chartHeight * 0.8
          const isPositive = point.score >= 0
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end group relative"
              style={{ height: chartHeight }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-popover border rounded-lg shadow-md p-2 text-xs whitespace-nowrap">
                <p className="font-medium">{point.surveyTitle}</p>
                <p>NPS: {point.score > 0 ? '+' : ''}{point.score.toFixed(0)}</p>
                <p className="text-[var(--color-muted)]">{point.responseCount} responses</p>
                <p className="text-[var(--color-muted)]">{formatDate(point.date)}</p>
              </div>
              {/* Bar */}
              <div
                className={`w-full rounded-t transition-all ${
                  isPositive ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]'
                } opacity-70 hover:opacity-100`}
                style={{ height: Math.max(4, normalizedHeight) }}
              />
            </div>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
        {trends.length > 0 && <span>{formatDate(trends[0]!.date)}</span>}
        {trends.length > 1 && <span>{formatDate(trends[trends.length - 1]!.date)}</span>}
      </div>
    </div>
  )
}
