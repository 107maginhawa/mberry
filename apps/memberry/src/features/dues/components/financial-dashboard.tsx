import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCents } from '../lib/money'

interface FinancialDashboardProps {
  orgId: string
}

export function FinancialDashboard({ orgId }: FinancialDashboardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['dues-dashboard', orgId],
    queryFn: async () => {
      const json = await api.get<{ data: any }>(`/api/dues/dashboard/${orgId}`)
      return json.data
    },
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  const stats = [
    {
      label: 'Collection Rate',
      value: `${data?.collectionRate ?? 0}%`,
      color: (data?.collectionRate ?? 0) > 80 ? 'text-green-600' : (data?.collectionRate ?? 0) > 50 ? 'text-yellow-600' : 'text-red-600',
    },
    { label: 'Total Collected', value: formatCents(data?.totalCollected ?? 0), color: 'text-foreground' },
    { label: 'Outstanding', value: formatCents(data?.totalOutstanding ?? 0), color: 'text-foreground' },
    { label: 'Pending Payments', value: String(data?.pendingCount ?? 0), color: 'text-foreground' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  )
}
