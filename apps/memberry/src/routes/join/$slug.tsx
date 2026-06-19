import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@monobase/ui'
import { Label } from '@monobase/ui'
import { Textarea } from '@monobase/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, PageContainer } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { api, ApiError } from '@/lib/api'
import type { ApiErrorBody } from '@/types/api'

export const Route = createFileRoute('/join/$slug')({
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
  const [submitting, setSubmitting] = useState(false)
  const [personId, setPersonId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const applySchema = z.object({
    tierId: z.string().optional(),
    message: z.string().max(500, 'Message must be 500 characters or fewer').optional(),
  })
  type ApplyFormData = z.infer<typeof applySchema>

  const { register: applyRegister, handleSubmit: applyHandleSubmit, watch: applyWatch, reset: applyReset, formState: { errors: applyErrors } } = useForm<ApplyFormData>({
    mode: 'onBlur',
    resolver: zodResolver(applySchema),
    defaultValues: { tierId: '', message: '' },
  })

  const messageValue = applyWatch('message') ?? ''

  async function handleApplyClick() {
    // Check auth first
    if (!authChecked) {
      try {
        const person: any = await api.get('/api/persons/me')
        setPersonId(person?.data?.id ?? person?.id ?? null)
        setAuthChecked(true)
      } catch {
        // Not logged in — redirect to sign-in
        window.location.href = `/auth/sign-in?redirect=/join/${encodeURIComponent(slug)}`
        return
      }
    }

    // Fetch tiers for this org
    setApplyOpen(true)
    setTiersLoading(true)
    try {
      const data: any = await api.get(`/api/public/org/${encodeURIComponent(org.id)}/tiers`)
      const tierList = data?.data ?? []
      setTiers(tierList)
      if (tierList.length === 1) setSelectedTierId(tierList[0].id)
    } catch {
      // Silently handle — user can still see the form without tiers
    } finally {
      setTiersLoading(false)
    }
  }

  async function handleSubmitApplication(_data: ApplyFormData) {
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
      setSelectedTierId('')
      applyReset()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          window.location.href = `/auth/sign-in?redirect=/join/${encodeURIComponent(slug)}`
          return
        }
        if (err.status === 409) {
          toast.error('You already have a pending application for this organization.')
          setApplyOpen(false)
          return
        }
        toast.error((err.body as unknown as ApiErrorBody)?.error ?? 'Failed to submit application. Please try again.')
      } else {
        toast.error('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full border rounded-lg p-8 bg-card text-center space-y-4">
          <h1 className="text-h3">Organization Not Found</h1>
          <p className="text-[var(--color-muted)]">The organization you're looking for doesn't exist or is no longer active.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <PageContainer width="narrow" className="space-y-6 mt-8">
        <div className="border rounded-lg bg-card overflow-hidden">
          <div className="bg-primary p-8 text-primary-foreground">
            <h1 className="text-h2">{org.name}</h1>
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
          <Button onClick={handleApplyClick} size="lg">
            Apply to Join
          </Button>
        </div>

        <div className="text-center text-xs text-[var(--color-muted)]">
          Powered by Memberry
        </div>
      </PageContainer>

      {/* Apply to Join dialog */}
      <Dialog open={applyOpen} onOpenChange={(open) => { if (!open && !submitting) setApplyOpen(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply to Join {org.name}</DialogTitle>
            <DialogDescription>
              Your application will be reviewed by the organization's officers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={applyHandleSubmit(handleSubmitApplication)} className="space-y-4">
              {tiersLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--color-muted)] py-2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  Loading membership tiers…
                </div>
              ) : tiers.length > 1 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="tier-select">
                    Membership Tier <span className="text-[var(--color-error)]">*</span>
                  </Label>
                  <Select value={selectedTierId} onValueChange={setSelectedTierId}>
                    <SelectTrigger id="tier-select" className="w-full">
                      <SelectValue placeholder="Select a tier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tiers.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{t.annualFee != null ? ` — ₱${Number(t.annualFee)}/yr` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : tiers.length === 1 ? (
                <div className="text-sm text-muted-foreground">
                  Tier: <span className="font-medium text-foreground">{tiers[0].name}</span>
                  {tiers[0].annualFee != null && (
                    <span className="ml-1">— ₱{Number(tiers[0].annualFee)}/yr</span>
                  )}
                </div>
              ) : (
                <div className="text-sm text-[var(--color-warning)] bg-[var(--color-warning-bg)] rounded-md px-3 py-2">
                  No membership tiers are available at this time. Please contact the organization directly.
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="apply-message">
                  Message <span className="text-[var(--color-muted)] font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="apply-message"
                  placeholder="Introduce yourself or share why you'd like to join..."
                  rows={3}
                  maxLength={500}
                  className="resize-none"
                  aria-describedby={applyErrors.message ? 'apply-message-error' : undefined}
                  {...applyRegister('message')}
                />
                {applyErrors.message && (
                  <p id="apply-message-error" role="alert" className="text-xs text-[var(--color-error)]">
                    {applyErrors.message.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setApplyOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || tiersLoading || (tiers.length > 0 && !selectedTierId)}
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </Button>
              </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
