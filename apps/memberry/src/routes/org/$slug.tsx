import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/org/$slug')({
  component: PublicOrgProfile,
})

/**
 * Public organization profile page — no auth required.
 * Visitors see org info and can apply to join.
 */
function PublicOrgProfile() {
  const { slug } = Route.useParams()
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/public/org/${encodeURIComponent(slug)}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then(data => {
        setOrg(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Organization not found')
        setLoading(false)
      })
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full border rounded-lg p-8 bg-white text-center space-y-4">
          <h1 className="text-xl font-bold">Organization Not Found</h1>
          <p className="text-muted-foreground">The organization you're looking for doesn't exist or is no longer active.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6 mt-8">
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="bg-[#554B68] p-8 text-white">
            <h1 className="text-2xl font-bold">{org.name}</h1>
            {org.associationName && (
              <p className="text-sm opacity-80 mt-1">{org.associationName}</p>
            )}
          </div>

          <div className="p-6 space-y-4">
            <div className="grid gap-3 text-sm">
              {org.orgType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium capitalize">{org.orgType}</span>
                </div>
              )}
              {org.region && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Region</span>
                  <span className="font-medium">{org.region}</span>
                </div>
              )}
              {org.contactEmail && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact</span>
                  <a href={`mailto:${org.contactEmail}`} className="font-medium text-primary hover:underline">
                    {org.contactEmail}
                  </a>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{org.status}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <a
            href={`/register?org=${encodeURIComponent(slug)}`}
            className="inline-flex items-center justify-center rounded-md bg-[#554B68] px-6 py-3 text-sm font-medium text-white hover:bg-[#443b55] transition-colors"
          >
            Apply to Join
          </a>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Powered by Memberry
        </div>
      </div>
    </div>
  )
}
