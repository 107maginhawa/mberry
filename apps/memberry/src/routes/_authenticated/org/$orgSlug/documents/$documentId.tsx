// oli-execute: error-handled-inline
// `error` renders explicit "Failed to load document" branch at ~L106. Gate
// heuristic misses the destructured rename.
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  Download,
  ArrowLeft,
  Clock,
  Shield,
  Tag,
  File,
  ShieldAlert,
} from 'lucide-react'
import { Button, Skeleton } from '@monobase/ui'
import {
  getDocumentOptions,
  listDocumentVersionsOptions,
} from '@monobase/sdk-ts/generated/react-query'
import { PageShell } from '@/components/patterns/page-shell'
import { GlassCard } from '@/components/motion/glass-card'
import { useOrg } from '@/hooks/use-org'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/documents/$documentId')({
  component: MemberDocumentDetailPage,
})

/** Access levels visible to regular members. */
const MEMBER_ACCESS_LEVELS = new Set(['public', 'tenantOnly'])

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: bigint | number): string {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function accessLevelLabel(level: string): string {
  switch (level) {
    case 'public':
      return 'Public'
    case 'tenantOnly':
      return 'Members Only'
    case 'unitOnly':
      return 'Officers Only'
    case 'restricted':
      return 'Restricted'
    case 'privileged':
      return 'Privileged'
    default:
      return level
  }
}

function MemberDocumentDetailPage() {
  const { orgId, orgSlug } = useOrg()
  const { documentId } = Route.useParams()

  const {
    data: document,
    isLoading,
    error,
  } = useQuery(getDocumentOptions({ path: { documentId } }))

  const { data: versionsData, isLoading: versionsLoading } = useQuery({
    ...listDocumentVersionsOptions({ path: { documentId } }),
    enabled: !!document && MEMBER_ACCESS_LEVELS.has((document as any)?.accessLevel ?? ''),
  })

  const doc = document as any
  const isAccessible = doc && MEMBER_ACCESS_LEVELS.has(doc.accessLevel)
  const isPdf = doc?.mimeType === 'application/pdf'
  const versions = ((versionsData as any)?.data as any[]) ?? []

  if (isLoading) {
    return (
      <PageShell
        title="Document"
        breadcrumbs={[
          { label: 'Organization' },
          { label: 'Documents', href: `/org/${orgSlug}/documents` },
          { label: 'Loading...' },
        ]}
      >
        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          </GlassCard>
        </div>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell
        title="Document"
        breadcrumbs={[
          { label: 'Organization' },
          { label: 'Documents', href: `/org/${orgSlug}/documents` },
          { label: 'Error' },
        ]}
      >
        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-[var(--color-error)] mx-auto mb-3" />
              <p className="font-medium text-[var(--color-error)]">Failed to load document</p>
              <Link
                to="/org/$orgSlug/documents"
                params={{ orgSlug }}
                className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] mt-4 hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Documents
              </Link>
            </div>
          </GlassCard>
        </div>
      </PageShell>
    )
  }

  // Access denied for officers-only / restricted documents
  if (!isAccessible) {
    return (
      <PageShell
        title="Document"
        breadcrumbs={[
          { label: 'Organization' },
          { label: 'Documents', href: `/org/${orgSlug}/documents` },
          { label: 'Access Denied' },
        ]}
      >
        <div className="space-y-6">
          <GlassCard className="p-6">
            <div className="text-center py-16">
              <ShieldAlert className="w-12 h-12 text-[var(--color-warning)] mx-auto mb-4" />
              <p className="text-lg font-semibold">You don't have access to this document</p>
              <p className="text-sm text-[var(--color-muted)] mt-2">
                This document is restricted to authorized personnel only.
              </p>
              <Link
                to="/org/$orgSlug/documents"
                params={{ orgSlug }}
                className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] mt-6 hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Documents
              </Link>
            </div>
          </GlassCard>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={doc.title}
      breadcrumbs={[
        { label: 'Organization' },
        { label: 'Documents', href: `/org/${orgSlug}/documents` },
        { label: doc.title },
      ]}
    >
      <div className="space-y-6">
      {/* Document metadata + download */}
      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="shrink-0 w-14 h-14 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
            <FileText className="w-7 h-7 text-[var(--color-primary)]" />
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <h2 className="text-xl font-semibold">{doc.title}</h2>
              <p className="text-sm text-[var(--color-muted)] mt-1">{doc.fileName}</p>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-1.5 text-[var(--color-muted)]">
                <File className="w-4 h-4" />
                <span>{formatFileSize(doc.size)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[var(--color-muted)]">
                <Clock className="w-4 h-4" />
                <span>Updated {formatDate(doc.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[var(--color-muted)]">
                <Shield className="w-4 h-4" />
                <span>{accessLevelLabel(doc.accessLevel)}</span>
              </div>
            </div>

            {doc.category && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-warm)] text-[var(--color-muted)]">
                  {doc.category.charAt(0).toUpperCase() + doc.category.slice(1)}
                </span>
              </div>
            )}

            {doc.tags && doc.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-4 h-4 text-[var(--color-muted)]" />
                {doc.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

          </div>

          <div className="shrink-0">
            <a
              href={`/api/documents/${documentId}/download`}
              download={doc.fileName}
            >
              <Button>
                <Download className="w-4 h-4" />
                Download
              </Button>
            </a>
          </div>
        </div>
      </GlassCard>

      {/* Inline PDF preview */}
      {isPdf && (
        <GlassCard className="p-0 overflow-hidden">
          <iframe
            src={`/api/documents/${documentId}/download`}
            className="w-full h-[600px] border-0"
            title={`Preview of ${doc.title}`}
          />
        </GlassCard>
      )}

      {/* Version history */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-semibold mb-4">Version History</h3>

        {versionsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No version history available.</p>
        ) : (
          <div className="space-y-2">
            {versions.map((v: any) => (
              <div
                key={v.id}
                className="flex items-center gap-4 border rounded-lg p-3"
              >
                <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--color-surface-warm)] flex items-center justify-center text-xs font-semibold text-[var(--color-muted)]">
                  v{v.versionNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{v.fileName}</p>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
                    <span>{formatDate(v.uploadedAt ?? v.createdAt)}</span>
                    <span>{formatFileSize(v.size)}</span>
                  </div>
                  {v.changeNotes && (
                    <p className="text-xs text-[var(--color-muted)] mt-1 italic">
                      {v.changeNotes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
      </div>
    </PageShell>
  )
}
