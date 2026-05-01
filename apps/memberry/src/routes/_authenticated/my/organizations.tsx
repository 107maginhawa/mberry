import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/_authenticated/my/organizations')({
  component: MyOrganizationsPage,
})

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  gracePeriod: 'bg-yellow-100 text-yellow-800',
  lapsed: 'bg-red-100 text-red-800',
  pendingPayment: 'bg-orange-100 text-orange-800',
  suspended: 'bg-gray-100 text-gray-800',
  terminated: 'bg-gray-200 text-gray-600',
  expired: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  gracePeriod: 'Grace Period',
  lapsed: 'Lapsed',
  pendingPayment: 'Pending Payment',
  suspended: 'Suspended',
  terminated: 'Terminated',
  expired: 'Expired',
}

function MyOrganizationsPage() {
  const [memberships, setMemberships] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/persons/me/memberships')
      .then(res => res.json())
      .then(res => {
        setMemberships(res?.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">My Organizations</h1>
      <p className="text-sm text-muted-foreground">
        Your association memberships across all organizations.
      </p>

      {loading && (
        <div className="text-center text-muted-foreground">Loading...</div>
      )}

      {!loading && memberships.length === 0 && (
        <div className="border rounded-lg p-6 text-center text-muted-foreground">
          You haven't joined any organizations yet.
        </div>
      )}

      {!loading && memberships.length > 0 && (
        <div className="space-y-3">
          {memberships.map((m: any) => (
            <Link
              key={m.id}
              to="/org/$orgId/members"
              params={{ orgId: m.orgId }}
              className="block border rounded-lg p-4 hover:border-[#554B68]/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.orgName || m.orgId}</div>
                  {m.memberNumber && (
                    <div className="text-xs text-muted-foreground">Member #{m.memberNumber}</div>
                  )}
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[m.status] || 'bg-gray-100 text-gray-800'}`}>
                  {STATUS_LABELS[m.status] || m.status}
                </span>
              </div>
              {m.duesExpiryDate && (
                <div className="text-xs text-muted-foreground mt-2">
                  Dues expire: {new Date(m.duesExpiryDate).toLocaleDateString()}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
