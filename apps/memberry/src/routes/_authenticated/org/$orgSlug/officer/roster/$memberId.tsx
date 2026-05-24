import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MemberDetail } from '@/features/membership/components/member-detail'
import { useOrg } from '@/hooks/useOrg'
import { useSession } from '@monobase/sdk-ts/react/hooks/use-auth'
import { api } from '@/lib/api'
import { GlassCard } from '@/components/motion/glass-card'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@monobase/ui'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/roster/$memberId')({
  component: MemberDetailPage,
})

interface License {
  id: string
  licenseType: string
  licenseNumber: string
  issuingAuthority?: string
  jurisdiction?: string
  status: string
  issuedDate?: string
  expirationDate?: string
  verifiedAt?: string | null
  verifiedBy?: string | null
}

function MemberDetailPage() {
  const { orgId } = useOrg()
  const { memberId } = Route.useParams()

  return (
    <>
      <MemberDetail orgId={orgId} memberId={memberId} />
      <div className="max-w-3xl mt-6">
        <ProfessionalLicenses memberId={memberId} />
      </div>
    </>
  )
}

function ProfessionalLicenses({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const currentUserId = session?.user?.id

  const licensesQueryKey = ['member-licenses', memberId]

  const { data: licenses, isLoading } = useQuery<License[]>({
    queryKey: licensesQueryKey,
    queryFn: () =>
      api.get<License[]>(`/api/association/member/licenses?personId=${memberId}`),
  })

  const verifyMutation = useMutation({
    mutationFn: (licenseId: string) =>
      api.patch(`/api/association/member/licenses/${licenseId}`, {
        verifiedAt: new Date().toISOString(),
        verifiedBy: currentUserId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: licensesQueryKey })
      toast.success('License verified')
    },
    onError: () => {
      toast.error('Verification failed', { description: 'Please try again.' })
    },
  })

  if (isLoading) {
    return (
      <GlassCard className="p-5 space-y-3">
        <h2 className="text-section-label text-[var(--color-muted)]">Professional Licenses</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-[var(--color-surface-warm)] rounded-lg" />
          ))}
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-5 space-y-4">
      <h2 className="text-section-label text-[var(--color-muted)]">Professional Licenses</h2>

      {!licenses?.length ? (
        <p className="text-sm text-[var(--color-muted)]">No licenses on file.</p>
      ) : (
        <div className="space-y-3">
          {licenses.map((license) => (
            <div
              key={license.id}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-warm)]/50 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{license.licenseType}</span>
                    <span className="font-mono text-xs text-[var(--color-muted)] border rounded px-1.5 py-0.5">
                      {license.licenseNumber}
                    </span>
                    <LicenseStatusBadge status={license.status} />
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                    {license.issuingAuthority && (
                      <div>
                        <dt className="inline">Authority: </dt>
                        <dd className="inline font-medium text-[var(--color-foreground)]">{license.issuingAuthority}</dd>
                      </div>
                    )}
                    {license.jurisdiction && (
                      <div>
                        <dt className="inline">Jurisdiction: </dt>
                        <dd className="inline font-medium text-[var(--color-foreground)]">{license.jurisdiction}</dd>
                      </div>
                    )}
                    {license.issuedDate && (
                      <div>
                        <dt className="inline">Issued: </dt>
                        <dd className="inline font-medium text-[var(--color-foreground)]">
                          {new Date(license.issuedDate).toLocaleDateString()}
                        </dd>
                      </div>
                    )}
                    {license.expirationDate && (
                      <div>
                        <dt className="inline">Expires: </dt>
                        <dd className="inline font-medium text-[var(--color-foreground)]">
                          {new Date(license.expirationDate).toLocaleDateString()}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Verification action or status */}
                <div className="shrink-0">
                  {license.verifiedAt ? (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-success)]">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Verified on {new Date(license.verifiedAt).toLocaleDateString()}</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => verifyMutation.mutate(license.id)}
                      disabled={verifyMutation.isPending}
                      className="text-xs"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                      {verifyMutation.isPending ? 'Verifying...' : 'Verify'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}

function LicenseStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    expired: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    suspended: 'bg-gray-100 text-gray-800',
    revoked: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    pending: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
