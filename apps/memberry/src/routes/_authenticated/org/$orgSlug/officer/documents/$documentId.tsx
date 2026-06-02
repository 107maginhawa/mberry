import { useState, useCallback, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { TableSkeleton } from '@/components/patterns/skeleton-loader'
import { useOrg } from '@/hooks/useOrg'
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import {
  FileText,
  Globe,
  Users,
  Shield,
  Lock,
  Calendar,
  Upload,
  History,
  Eye,
  Tag,
  Plus,
  HardDrive,
} from 'lucide-react'
import {
  getDocumentOptions,
  getDocumentQueryKey,
  updateDocumentMutation,
  listDocumentVersionsOptions,
  listDocumentVersionsQueryKey,
  uploadNewDocumentVersionMutation,
  getDocumentAccessLogOptions,
  listDocumentTagsOptions,
  createDocumentTagMutation,
  listDocumentTagsQueryKey,
} from '@monobase/sdk-ts/generated/react-query'
import type {
  AssociationCoreDocumentsDocumentAccessLevel,
  AssociationCoreDocumentsDocumentAccessLogEntry,
  AssociationCoreDocumentsDocumentVersion,
  AssociationCoreDocumentsDocumentTag,
} from '@monobase/sdk-ts/generated/types.gen'

export const Route = createFileRoute('/_authenticated/org/$orgSlug/officer/documents/$documentId')({
  component: DocumentDetail,
})

type Tab = 'details' | 'versions' | 'access_log'

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: 'details', label: 'Details', icon: FileText },
  { key: 'versions', label: 'Versions', icon: History },
  { key: 'access_log', label: 'Access Log', icon: Eye },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]',
  published: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  archived: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
}

const ACCESS_LEVELS: { value: AssociationCoreDocumentsDocumentAccessLevel; label: string; icon: typeof Globe }[] = [
  { value: 'public', label: 'Public', icon: Globe },
  { value: 'tenantOnly', label: 'Members Only', icon: Users },
  { value: 'unitOnly', label: 'Unit Only', icon: Users },
  { value: 'restricted', label: 'Officers Only', icon: Shield },
  { value: 'privileged', label: 'Privileged', icon: Lock },
]

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatShortDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: number | bigint): string {
  const b = Number(bytes)
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

/** Runtime document shape — SDK uses Date objects, runtime returns strings */
interface RuntimeDocument {
  id: string
  title: string
  fileName: string
  mimeType: string
  size: number | bigint
  storageKey: string
  ownerId: string
  ownerType: string
  accessLevel: AssociationCoreDocumentsDocumentAccessLevel
  category?: string | null
  tags?: string[]
  currentVersionId?: string | null
  status?: string
  organizationId: string
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
}

// --- Version History Tab ---

function VersionsTab({ documentId, orgId }: { documentId: string; orgId: string }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [changeNotes, setChangeNotes] = useState('')
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)

  const { data, isLoading } = useQuery(
    listDocumentVersionsOptions({ path: { documentId }, headers: { 'x-org-id': orgId } }),
  )

  const doUpload = useMutation({
    ...uploadNewDocumentVersionMutation(),
    onSuccess: () => {
      toast.success('New version uploaded')
      queryClient.invalidateQueries({ queryKey: listDocumentVersionsQueryKey({ path: { documentId } }) })
      queryClient.invalidateQueries({ queryKey: getDocumentQueryKey({ path: { documentId } }) })
      setUploadingFile(null)
      setChangeNotes('')
    },
    onError: (err) => toast.error(err.message || 'Failed to upload version'),
  })

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setUploadingFile(file)
  }, [])

  const handleUploadSubmit = useCallback(() => {
    if (!uploadingFile) return
    doUpload.mutate({
      path: { documentId },
      headers: { 'x-org-id': orgId },
      body: {
        fileName: uploadingFile.name,
        storageKey: `documents/${orgId}/${documentId}/${Date.now()}-${uploadingFile.name}`,
        size: BigInt(uploadingFile.size),
        changeNotes: changeNotes.trim() || undefined,
      },
    })
  }, [uploadingFile, changeNotes, documentId, orgId, doUpload])

  const versions: AssociationCoreDocumentsDocumentVersion[] = (data as any)?.data ?? []

  return (
    <div className="space-y-4">
      {/* Upload new version */}
      <GlassCard className="p-4 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Upload New Version
        </h4>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="file"
              ref={fileRef}
              onChange={handleFileSelect}
              className="h-9"
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder="Change notes (optional)"
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              className="h-9"
            />
          </div>
          <Button
            onClick={handleUploadSubmit}
            disabled={!uploadingFile || doUpload.isPending}
            size="sm"
          >
            {doUpload.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
      </GlassCard>

      {/* Version list */}
      {isLoading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : versions.length === 0 ? (
        <EmptyState
          icon={<History className="w-8 h-8" />}
          headline="No versions recorded"
          description="Version history will appear here as new versions are uploaded."
        />
      ) : (
        <GlassCard className="overflow-hidden">
          <Table className="text-sm">
            <TableHeader className="bg-[var(--color-surface-warm)]/50">
              <TableRow>
                <TableHead className="p-3">Version</TableHead>
                <TableHead className="p-3">File</TableHead>
                <TableHead className="p-3">Size</TableHead>
                <TableHead className="p-3">Uploaded</TableHead>
                <TableHead className="p-3">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id} className="border-t border-[var(--color-border-light)] hover:bg-[var(--color-surface-warm)]/30">
                  <TableCell className="p-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary-bg)] text-[var(--color-primary)]">
                      v{v.versionNumber}
                    </span>
                  </TableCell>
                  <TableCell className="p-3 font-mono text-xs truncate max-w-[200px]">{v.fileName}</TableCell>
                  <TableCell className="p-3 text-[var(--color-muted)]">{formatFileSize(v.size)}</TableCell>
                  <TableCell className="p-3 text-[var(--color-muted)]">{formatShortDate(v.uploadedAt)}</TableCell>
                  <TableCell className="p-3 text-[var(--color-muted)] max-w-[200px] truncate">{v.changeNotes ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}
    </div>
  )
}

// --- Access Log Tab ---

function AccessLogTab({ documentId, orgId }: { documentId: string; orgId: string }) {
  const { data, isLoading } = useQuery(
    getDocumentAccessLogOptions({ path: { documentId }, headers: { 'x-org-id': orgId } }),
  )

  const entries: AssociationCoreDocumentsDocumentAccessLogEntry[] = (data as any)?.data ?? []

  if (isLoading) return <TableSkeleton rows={6} cols={4} />

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Eye className="w-8 h-8" />}
        headline="No access recorded"
        description="Access events will appear here when members view or download this document."
      />
    )
  }

  return (
    <GlassCard className="overflow-hidden">
      <Table className="text-sm">
        <TableHeader className="bg-[var(--color-surface-warm)]/50">
          <TableRow>
            <TableHead className="p-3">User</TableHead>
            <TableHead className="p-3">Action</TableHead>
            <TableHead className="p-3">Date</TableHead>
            <TableHead className="p-3">IP Address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, i) => (
            <TableRow key={i} className="border-t border-[var(--color-border-light)] hover:bg-[var(--color-surface-warm)]/30">
              <TableCell className="p-3">
                <span
                  className="font-mono text-xs text-[var(--color-muted)] cursor-default"
                  title={entry.accessedBy}
                >
                  {entry.accessedBy ? `${entry.accessedBy.slice(0, 8)}...` : '—'}
                </span>
              </TableCell>
              <TableCell className="p-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  entry.action === 'download' ? 'bg-[var(--color-primary-bg)] text-[var(--color-primary)]' :
                  entry.action === 'view' ? 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]' :
                  'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                }`}>
                  {entry.action}
                </span>
              </TableCell>
              <TableCell className="p-3 text-[var(--color-muted)]">{formatShortDate(entry.accessedAt)}</TableCell>
              <TableCell className="p-3 text-[var(--color-muted)] font-mono text-xs">{entry.ipAddress ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </GlassCard>
  )
}

// --- Tag Manager ---

function TagManager({ document: doc, orgId }: { document: RuntimeDocument; orgId: string }) {
  const queryClient = useQueryClient()
  const [newTag, setNewTag] = useState('')

  const { data: tagsData } = useQuery(
    listDocumentTagsOptions({ headers: { 'x-org-id': orgId } }),
  )

  const doCreateTag = useMutation({
    ...createDocumentTagMutation(),
    onSuccess: () => {
      toast.success('Tag added')
      queryClient.invalidateQueries({ queryKey: getDocumentQueryKey({ path: { documentId: doc.id } }) })
      queryClient.invalidateQueries({ queryKey: listDocumentTagsQueryKey() })
      setNewTag('')
    },
    onError: (err) => toast.error(err.message || 'Failed to add tag'),
  })

  const allTags: AssociationCoreDocumentsDocumentTag[] = (tagsData as any)?.data ?? []
  const docTags = doc.tags ?? []
  const suggestedTags = allTags
    .map((t) => t.name)
    .filter((name) => !docTags.includes(name))
    .slice(0, 5)

  const handleAddTag = useCallback(() => {
    const tag = newTag.trim()
    if (!tag) return
    doCreateTag.mutate({
      headers: { 'x-org-id': orgId },
      body: {
        name: tag,
        documentId: doc.id,
      } as any,
    })
  }, [newTag, orgId, doc.id, doCreateTag])

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Tag className="w-4 h-4" />
        Tags
      </h4>
      <div className="flex flex-wrap gap-2">
        {docTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-primary-bg)] text-[var(--color-primary)]"
          >
            {tag}
          </span>
        ))}
        {docTags.length === 0 && (
          <span className="text-xs text-[var(--color-muted)]">No tags assigned</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Add tag..."
          className="h-8 text-sm w-48"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag() }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddTag}
          disabled={!newTag.trim() || doCreateTag.isPending}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add
        </Button>
      </div>
      {suggestedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-[var(--color-muted)]">Suggestions:</span>
          {/* eslint-disable no-restricted-syntax -- tag suggestion chips need custom styling */}
          {suggestedTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setNewTag(tag)}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-dashed border-[var(--color-border-light)] text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
            >
              {tag}
            </button>
          ))}
          {/* eslint-enable no-restricted-syntax */}
        </div>
      )}
    </div>
  )
}

// --- Main Component ---

function DocumentDetail() {
  const { orgId, orgSlug } = useOrg()
  const { documentId } = Route.useParams()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('details')
  const [editingAccess, setEditingAccess] = useState(false)
  const [newAccessLevel, setNewAccessLevel] = useState<string>('')

  const { data, isLoading, isError, error } = useQuery(
    getDocumentOptions({ path: { documentId }, headers: { 'x-org-id': orgId } }),
  )

  const doUpdate = useMutation({
    ...updateDocumentMutation(),
    onSuccess: () => {
      toast.success('Document updated')
      queryClient.invalidateQueries({ queryKey: getDocumentQueryKey({ path: { documentId } }) })
      setEditingAccess(false)
    },
    onError: (err) => toast.error(err.message || 'Failed to update document'),
  })

  const doc = data as unknown as RuntimeDocument | undefined

  const handleAccessLevelSave = useCallback(() => {
    if (!newAccessLevel || !doc) return
    doUpdate.mutate({
      path: { documentId },
      headers: { 'x-org-id': orgId },
      body: {
        accessLevel: newAccessLevel as AssociationCoreDocumentsDocumentAccessLevel,
      },
    })
  }, [newAccessLevel, doc, documentId, orgId, doUpdate])

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="space-y-3">
          <TableSkeleton rows={3} cols={1} />
        </div>
      ) : isError ? (
        <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
          Unable to load document. Please try refreshing the page.
        </div>
      ) : error || !doc ? (
        <div className="p-6 text-center text-[var(--color-error)]">Failed to load document</div>
      ) : (
        <>
          {/* Header */}
          <PageHeader
            title={doc.title}
            breadcrumbs={[
              { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
              { label: 'Documents', href: `/org/${orgSlug}/officer/documents` },
              { label: doc.title },
            ]}
            actions={
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[doc.status ?? 'draft'] ?? ''}`}>
                  {doc.status ?? 'draft'}
                </span>
              </div>
            }
          />

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[var(--color-border-light)]">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <Button
                  key={t.key}
                  variant="ghost"
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px rounded-none ${
                    tab === t.key
                      ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-1.5" />
                  {t.label}
                </Button>
              )
            })}
          </div>

          {/* Details Tab */}
          {tab === 'details' && (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main metadata */}
              <GlassCard className="p-6 lg:col-span-2">
                <div className="space-y-6 max-w-2xl">
                  <dl className="space-y-4">
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                      <div>
                        <dt className="text-xs text-[var(--color-muted)] mb-0.5">File Name</dt>
                        <dd className="text-sm font-mono">{doc.fileName}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <HardDrive className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                      <div>
                        <dt className="text-xs text-[var(--color-muted)] mb-0.5">Size / Type</dt>
                        <dd className="text-sm">{formatFileSize(doc.size)} &middot; {doc.mimeType}</dd>
                      </div>
                    </div>
                    {doc.category && (
                      <div className="flex items-start gap-3">
                        <Tag className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                        <div>
                          <dt className="text-xs text-[var(--color-muted)] mb-0.5">Category</dt>
                          <dd className="text-sm capitalize">{doc.category.replace(/_/g, ' ')}</dd>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                      <div>
                        <dt className="text-xs text-[var(--color-muted)] mb-0.5">Created</dt>
                        <dd className="text-sm">{formatDate(doc.createdAt)}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 mt-0.5 text-[var(--color-muted)] shrink-0" />
                      <div>
                        <dt className="text-xs text-[var(--color-muted)] mb-0.5">Last Updated</dt>
                        <dd className="text-sm">{formatDate(doc.updatedAt)}</dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </GlassCard>

              {/* Sidebar — access level + tags */}
              <div className="space-y-4">
                {/* Access level */}
                <GlassCard className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Access Level
                    </h4>
                    {!editingAccess && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setNewAccessLevel(doc.accessLevel)
                          setEditingAccess(true)
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                  {editingAccess ? (
                    <div className="space-y-3">
                      <Select value={newAccessLevel} onValueChange={setNewAccessLevel}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCESS_LEVELS.map((level) => {
                            const Icon = level.icon
                            return (
                              <SelectItem key={level.value} value={level.value}>
                                <span className="flex items-center gap-2">
                                  <Icon className="w-3.5 h-3.5" />
                                  {level.label}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAccessLevelSave}
                          disabled={doUpdate.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingAccess(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {(() => {
                        const config = ACCESS_LEVELS.find((l) => l.value === doc.accessLevel) ?? ACCESS_LEVELS[0]!
                        const Icon = config.icon
                        return (
                          <>
                            <Icon className="w-4 h-4 text-[var(--color-muted)]" />
                            <span className="text-sm">{config.label}</span>
                          </>
                        )
                      })()}
                    </div>
                  )}
                </GlassCard>

                {/* Tags */}
                <GlassCard className="p-4">
                  <TagManager document={doc} orgId={orgId} />
                </GlassCard>
              </div>
            </div>
          )}

          {/* Versions Tab */}
          {tab === 'versions' && (
            <VersionsTab documentId={documentId} orgId={orgId} />
          )}

          {/* Access Log Tab */}
          {tab === 'access_log' && (
            <AccessLogTab documentId={documentId} orgId={orgId} />
          )}
        </>
      )}
    </div>
  )
}
