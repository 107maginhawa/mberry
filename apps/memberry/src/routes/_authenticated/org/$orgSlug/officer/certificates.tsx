import { createFileRoute } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { FileText, Send } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/useOrg'
import { api } from '@/lib/api'
import { Textarea } from '@monobase/ui'
import { useState } from 'react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/certificates')({
  component: OfficerCertificates,
})

function OfficerCertificates() {
  const { orgId } = useOrg()
  const [trainingTitle, setTrainingTitle] = useState('')
  const [orgCode, setOrgCode] = useState('')
  const [personIdsText, setPersonIdsText] = useState('')
  const [certNumber, setCertNumber] = useState('')
  const [verifyResult, setVerifyResult] = useState<any>(null)

  const bulkMutation = useMutation({
    mutationFn: (body: any) => api.post('/api/certificates/bulk-issue', body),
    onSuccess: (data: any) => {
      const result = data?.data
      if (result?.status === 'queued') {
        toast.success(`${result.message}`)
      } else {
        toast.success(`Issued ${Array.isArray(result) ? result.length : 0} certificates`)
      }
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to issue certificates'),
  })

  const verifyMutation = useMutation({
    mutationFn: (num: string) => api.get(`/certificates/verify/${encodeURIComponent(num)}`),
    onSuccess: (data: any) => setVerifyResult(data?.data),
    onError: () => { setVerifyResult(null); toast.error('Certificate not found') },
  })

  const handleBulkIssue = () => {
    const personIds = personIdsText.split('\n').map(s => s.trim()).filter(Boolean)
    if (!personIds.length || !trainingTitle || !orgCode) {
      toast.error('Fill in all required fields')
      return
    }
    bulkMutation.mutate({
      organizationId: orgId,
      personIds,
      trainingTitle,
      certificateType: 'attendance',
      orgCode,
      signingOfficerId: orgId,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Certificate Management" subtitle="Issue and verify certificates" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Send className="w-4 h-4" /> Bulk Issue Certificates
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-[var(--color-muted)]">Training Title *</label>
              <input
                type="text"
                value={trainingTitle}
                onChange={e => setTrainingTitle(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-sm"
                placeholder="Annual Dental Conference 2026"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--color-muted)]">Org Code *</label>
              <input
                type="text"
                value={orgCode}
                onChange={e => setOrgCode(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-sm"
                placeholder="PDA"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--color-muted)]">Person IDs (one per line) *</label>
              <Textarea
                value={personIdsText}
                onChange={e => setPersonIdsText(e.target.value)}
                className="w-full mt-1"
                rows={5}
                placeholder="person-uuid-1&#10;person-uuid-2&#10;person-uuid-3"
              />
            </div>
            <button
              onClick={handleBulkIssue}
              disabled={bulkMutation.isPending}
              className="w-full px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm hover:opacity-90 disabled:opacity-50"
            >
              {bulkMutation.isPending ? 'Issuing...' : 'Issue Certificates'}
            </button>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Verify Certificate
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-[var(--color-muted)]">Certificate Number</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={certNumber}
                  onChange={e => setCertNumber(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-transparent text-sm"
                  placeholder="PDA-2026-0001"
                />
                <button
                  onClick={() => verifyMutation.mutate(certNumber)}
                  disabled={!certNumber || verifyMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm hover:opacity-90 disabled:opacity-50"
                >
                  Verify
                </button>
              </div>
            </div>
            {verifyResult && (
              <div className="mt-4 p-4 rounded-lg bg-[var(--color-surface-elevated)] space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Certificate</span>
                  <span className="font-mono">{verifyResult.certificateNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Holder</span>
                  <span>{verifyResult.holderName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Issued</span>
                  <span>{verifyResult.issuedAt ? new Date(verifyResult.issuedAt).toLocaleDateString() : '--'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">Status</span>
                  <span className={`font-medium ${verifyResult.isValid ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                    {verifyResult.isValid ? 'Valid' : 'Revoked'}
                  </span>
                </div>
                {verifyResult.creditHours && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Credits</span>
                    <span>{verifyResult.creditHours} CPE</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
