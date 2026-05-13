import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'

export const Route = createFileRoute('/org/$slug')({
  component: PublicOrgProfile,
})

/**
 * Public organization profile page — no auth required.
 * Visitors see org info and can apply to join.
 */
function PublicOrgProfile() {
  const { slug } = Route.useParams()

  const orgQuery = useQuery<any>({
    queryKey: ['public-org', slug],
    queryFn: async () => {
      return await api.get(`/api/public/org/${encodeURIComponent(slug)}`)
    },
    retry: false,
  })

  const loading = orgQuery.isLoading
  const org = orgQuery.data ?? null
  const error = orgQuery.error ? 'Organization not found' : null

  // Apply dialog state
  const [applyOpen, setApplyOpen] = useState(false)
  const [tiers, setTiers] = useState<any[]>([])
  const [tiersLoading, setTiersLoading] = useState(false)
  const [selectedTierId, setSelectedTierId] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [personId, setPersonId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  async function handleApplyClick() {
    // Check auth first
    if (!authChecked) {
      try {
        const person: any = await api.get('/api/persons/me')
        setPersonId(person?.data?.id ?? person?.id ?? null)
        setAuthChecked(true)
      } catch {
        // Not logged in — redirect to sign-in
        window.location.href = `/auth/sign-in?redirect=/org/${encodeURIComponent(slug)}`
        return
      }
    }

    // Fetch tiers for this org
    setApplyOpen(true)
    setTiersLoading(true)
    try {
      const data: any = await api.get('/api/association/member/tiers', { 'x-org-id': org.id })
      const tierList = data?.data ?? []
      setTiers(tierList)
      if (tierList.length === 1) setSelectedTierId(tierList[0].id)
    } catch {
      // Silently handle — user can still see the form without tiers
    } finally {
      setTiersLoading(false)
    }
  }

  async function handleSubmitApplication(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTierId && tiers.length > 0) {
      toast.error('Please select a membership tier')
      return
    }
    if (!personId) {
      toast.error('Could not identify your account. Please sign in again.')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/api/association/member/applications', {
        personId,
        organizationId: org.id,
        tierId: selectedTierId || (tiers[0]?.id ?? ''),
        applicationDate: new Date().toISOString().split('T')[0],
      }, { 'x-org-id': org.id })

      toast.success('Application submitted! The organization will review it shortly.')
      setApplyOpen(false)
      setMessage('')
      setSelectedTierId('')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          window.location.href = `/auth/sign-in?redirect=/org/${encodeURIComponent(slug)}`
          return
        }
        if (err.status === 409) {
          toast.error('You already have a pending application for this organization.')
          setApplyOpen(false)
          return
        }
        toast.error((err.body as any)?.error ?? 'Failed to submit application. Please try again.')
      } else {
        toast.error('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full border rounded-lg p-8 bg-white text-center space-y-4">
          <h1 className="text-xl font-bold">Organization Not Found</h1>
          <p className="text-[var(--color-muted)]">The organization you're looking for doesn't exist or is no longer active.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6 mt-8">
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="bg-[#554B68] p-8 text-white">
            <h1 className="text-[26px] font-bold font-display">{org.name}</h1>
            {org.associationName && (
              <p className="text-sm opacity-80 mt-1">{org.associationName}</p>
            )}
          </div>

          <div className="p-6 space-y-4">
            <div className="grid gap-3 text-sm">
              {org.orgType && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Type</span>
                  <span className="font-medium capitalize">{org.orgType}</span>
                </div>
              )}
              {org.region && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Region</span>
                  <span className="font-medium">{org.region}</span>
                </div>
              )}
              {org.contactEmail && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Contact</span>
                  <a href={`mailto:${org.contactEmail}`} className="font-medium text-[var(--color-primary)] hover:underline">
                    {org.contactEmail}
                  </a>
                </div>
              )}
              {org.memberCount != null && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Active Members</span>
                  <span className="font-medium">{org.memberCount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--color-muted)]">Status</span>
                <span className="font-medium capitalize">{org.status}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={handleApplyClick}
            className="inline-flex items-center justify-center rounded-md bg-[#554B68] px-6 py-3 text-sm font-medium text-white hover:bg-[#443b55] transition-colors"
          >
            Apply to Join
          </button>
        </div>

        <div className="text-center text-xs text-[var(--color-muted)]">
          Powered by Memberry
        </div>
      </div>

      {/* Apply to Join dialog */}
      {applyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => { if (!submitting) setApplyOpen(false) }} />
          <div className="relative bg-white rounded-lg border p-6 max-w-md w-full mx-4 shadow-lg">
            <h3 className="text-lg font-bold mb-1">Apply to Join {org.name}</h3>
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Your application will be reviewed by the organization's officers.
            </p>

            <form onSubmit={handleSubmitApplication} className="space-y-4">
              {tiersLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--color-muted)] py-2">
                  <div className="animate-spin h-4 w-4 border-2 border-[#554B68] border-t-transparent rounded-full" />
                  Loading membership tiers…
                </div>
              ) : tiers.length > 1 ? (
                <div>
                  <label className="text-sm font-medium block mb-1.5" htmlFor="tier-select">
                    Membership Tier <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="tier-select"
                    value={selectedTierId}
                    onChange={e => setSelectedTierId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#554B68] focus:border-transparent"
                  >
                    <option value="">Select a tier…</option>
                    {tiers.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.annualFee != null ? ` — ₱${Number(t.annualFee)}/yr` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : tiers.length === 1 ? (
                <div className="text-sm text-[var(--color-muted)]">
                  Tier: <span className="font-medium text-gray-900">{tiers[0].name}</span>
                  {tiers[0].annualFee != null && (
                    <span className="ml-1">— ₱{Number(tiers[0].annualFee)}/yr</span>
                  )}
                </div>
              ) : (
                <div className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                  No membership tiers are available at this time. Please contact the organization directly.
                </div>
              )}

              <div>
                <label className="text-sm font-medium block mb-1.5" htmlFor="apply-message">
                  Message <span className="text-[var(--color-muted)] font-normal">(optional)</span>
                </label>
                <textarea
                  id="apply-message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Introduce yourself or share why you'd like to join…"
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#554B68] focus:border-transparent resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setApplyOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || tiersLoading || (tiers.length > 0 && !selectedTierId)}
                  className="px-4 py-2 rounded-md bg-[#554B68] text-white text-sm font-medium hover:bg-[#443b55] transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
