import { BarChart3, PieChart, List, Clock } from 'lucide-react'

interface ReportSelectorProps {
  selected: string | null
  onSelect: (type: string) => void
}

const REPORTS = [
  { type: 'collection', label: 'Collection Summary', icon: BarChart3, description: 'Payments by month, online vs manual' },
  { type: 'fund_breakdown', label: 'Fund Breakdown', icon: PieChart, description: 'Per-fund totals with refund reversals' },
  { type: 'dues_status', label: 'Dues Status', icon: List, description: 'All members with payment status' },
  { type: 'aging', label: 'Aging Report', icon: Clock, description: 'Overdue payments by duration bucket' },
]

export function ReportSelector({ selected, onSelect }: ReportSelectorProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {REPORTS.map(({ type, label, icon: Icon, description }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className={`p-4 rounded-lg border text-left transition-colors ${
            selected === type ? 'border-[var(--color-primary)] bg-primary/5 ring-1 ring-primary' : 'hover:bg-[var(--color-surface-warm)]'
          }`}
        >
          <Icon className="h-5 w-5 mb-2 text-[var(--color-muted)]" />
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">{description}</p>
        </button>
      ))}
    </div>
  )
}
