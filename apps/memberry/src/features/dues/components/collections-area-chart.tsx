import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { GlassCard } from '@/components/motion/glass-card'
import { formatCents } from '../lib/money'

interface MonthlyData {
  month: string
  collected: number
  outstanding: number
}

interface CollectionsAreaChartProps {
  data: MonthlyData[]
  isLoading?: boolean
}

export function CollectionsAreaChart({ data, isLoading }: CollectionsAreaChartProps) {
  if (isLoading) {
    return (
      <GlassCard className="p-5">
        <h2 className="text-h4 mb-4">Collections Over Time</h2>
        <div className="h-[280px] flex items-center justify-center animate-pulse">
          <div className="w-full h-full bg-gray-100 rounded" />
        </div>
      </GlassCard>
    )
  }

  if (data.length === 0) {
    return (
      <GlassCard className="p-5">
        <h2 className="text-h4 mb-4">Collections Over Time</h2>
        <div className="h-[280px] flex items-center justify-center text-[var(--color-muted)] text-sm" role="status">
          No collection data yet. Charts appear after the first month of payment activity.
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-5">
      <h2 className="text-h4 mb-4">Collections Over Time</h2>
      <div aria-label="Collections over time area chart" role="img">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="outstandingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCents(v)} />
            <Tooltip
              formatter={(value, name) => [formatCents(Number(value ?? 0)), String(name)]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="collected"
              stroke="#22c55e"
              fill="url(#collectedGradient)"
              name="Collected"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="outstanding"
              stroke="#ef4444"
              fill="url(#outstandingGradient)"
              name="Outstanding"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}
