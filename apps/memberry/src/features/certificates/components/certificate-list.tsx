import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@monobase/ui'
import { listMyCertificatesOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function CertificateList() {
  const { data, isLoading } = useQuery(listMyCertificatesOptions())

  const certificates = (data?.data ?? []) as any[]

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    )
  }

  if (certificates.length === 0) {
    return (
      <div className="border rounded-xl p-12 text-center text-muted-foreground">
        No certificates issued yet. Complete a training to earn your first certificate.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {certificates.map((cert: any) => (
        <a
          key={cert.id}
          href={`/my/certificates/${cert.id}`}
          className="block border rounded-xl p-5 hover:shadow-md transition-shadow bg-card space-y-3"
        >
          {/* Header accent */}
          <div className="h-1.5 w-16 rounded-full bg-primary" />

          <div className="space-y-1">
            <p className="font-semibold text-sm line-clamp-2">Training Certificate</p>
            <p className="text-xs text-muted-foreground">Training ID: {cert.trainingId.slice(0, 8)}…</p>
          </div>

          <div className="flex items-center justify-between">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {cert.certificateNumber}
            </span>
          </div>

          <div className="pt-1 border-t text-xs text-muted-foreground">
            Issued {formatDate(cert.issuedAt)}
          </div>
        </a>
      ))}
    </div>
  )
}
