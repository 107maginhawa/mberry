import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, CreditCard, Settings } from 'lucide-react'
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

  const expiringCount = data?.expiringThisMonth ?? 0
  const pendingCount = data?.pendingCount ?? 0
  const hasGateway = data?.gatewayConfigured ?? false

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {expiringCount > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-amber-900">{expiringCount} members with expiring dues</p>
              <p className="text-amber-700">Send reminders before they lapse</p>
            </div>
          </div>
        )}
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50">
            <CreditCard className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-blue-900">{pendingCount} pending payments</p>
              <p className="text-blue-700">Review and confirm</p>
            </div>
          </div>
        )}
        {!hasGateway && (
          <Link
            to="/org/$orgId/officer/settings/gateway"
            params={{ orgId }}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100"
          >
            <Settings className="h-5 w-5 text-gray-600 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-gray-900">Gateway not configured</p>
              <p className="text-gray-600">Set up online payments</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
