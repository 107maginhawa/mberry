import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Link, useParams } from '@tanstack/react-router'
import { Button, Input, Skeleton } from '@monobase/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@monobase/ui'
import { GlassCard } from '@/components/motion/glass-card'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import {
  FileText,
  Globe,
  Users,
  Shield,
  Lock,
  Search,
  Upload,
  MoreHorizontal,
  Calendar,
  Eye,
} from 'lucide-react'
import {
  searchDocumentsOptions,
  searchDocumentsQueryKey,
  createDocumentMutation,
  archiveDocumentMutation,
  deleteDocumentMutation,
  updateDocumentMutation,
} from '@monobase/sdk-ts/generated/react-query'
import type {
  AssociationCoreDocumentsDocument,
  AssociationCoreDocumentsDocumentAccessLevel,
} from '@monobase/sdk-ts/generated/types.gen'

interface DocumentLibraryProps {
  orgId: string
}

type CategoryTab = 'all' | 'bylaws' | 'minutes' | 'policies' | 'forms' | 'election_results' | 'financial_reports' | 'other'

const CATEGORY_TABS: { key: CategoryTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'bylaws', label: 'Bylaws' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'policies', label: 'Policies' },
  { key: 'forms', label: 'Forms' },
  { key: 'election_results', label: 'Election Results' },
  { key: 'financial_reports', label: 'Financial Reports' },
  { key: 'other', label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[var(--color-surface-warm)] text-[var(--color-muted)]',
  published: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  archived: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
}

const ACCESS_LEVEL_ICONS: Record<string, { icon: typeof Globe; label: string }> = {
  public: { icon: Globe, label: 'Public' },
  tenantOnly: { icon: Users, label: 'Members Only' },
  unitOnly: { icon: Users, label: 'Unit Only' },
  restricted: { icon: Shield, label: 'Officers Only' },
  privileged: { icon: Lock, label: 'Privileged' },
}

function formatFileSize(bytes: number | bigint): string {
  const b = Number(bytes)
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function AccessLevelIcon({ level }: { level: string }) {
  const config = ACCESS_LEVEL_ICONS[level] ?? ACCESS_LEVEL_ICONS.public!
  const IconComponent = config!.icon
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)]" title={config!.label}>
      <IconComponent className="w-3.5 h-3.5" />
      {config!.label}
    </span>
  )
}

interface DocumentCardProps {
  document: AssociationCoreDocumentsDocument
  orgId: string
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
  onPublish?: (id: string) => void
}

function DocumentCard({ document: doc, orgId, onArchive, onDelete, onPublish }: DocumentCardProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <GlassCard className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[(doc as any).status ?? 'draft'] ?? STATUS_COLORS.draft}`}>
            {(doc as any).status ?? 'draft'}
          </span>
          {doc.category && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-warm)] text-[var(--color-foreground)]">
              {doc.category.replace('_', ' ')}
            </span>
          )}
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Actions"
          >
            <MoreHorizontal className="w-4 h-4 text-[var(--color-muted)]" />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-10 w-36 border border-[var(--color-surface-border-glass)] rounded-sm bg-[var(--color-surface-elevated)] backdrop-blur-[var(--surface-blur)] shadow-[var(--shadow-soft)] text-body-sm">
              <Link
                to={`/org/${orgSlug}/officer/documents/${doc.id}` as any}
                className="block px-3 py-2 hover:bg-[var(--color-surface-elevated-hover)] rounded-t-[8px]"
                onClick={() => setMenuOpen(false)}
              >
                View Details
              </Link>
              {/* eslint-disable no-restricted-syntax -- dropdown menu items use custom styling */}
              {onPublish && (doc as any).status === 'draft' && (
                <button
                  onClick={() => { onPublish(doc.id); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--color-surface-elevated-hover)] text-[var(--color-success)]"
                >
                  Publish
                </button>
              )}
              {onArchive && (doc as any).status !== 'archived' && (
                <button
                  onClick={() => { onArchive(doc.id); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--color-surface-elevated-hover)] text-[var(--color-error)]"
                >
                  Archive
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => { onDelete(doc.id); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--color-surface-elevated-hover)] rounded-b-[8px] text-[var(--color-error)]"
                >
                  Delete
                </button>
              )}
              {/* eslint-enable no-restricted-syntax */}
            </div>
          )}
        </div>
      </div>

      <Link to={`/org/${orgSlug}/officer/documents/${doc.id}` as any} className="block">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[var(--color-surface-warm)] shrink-0">
            <FileText className="w-5 h-5 text-[var(--color-primary)]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-h4 leading-snug hover:text-[var(--color-primary)] transition-colors line-clamp-2">
              {doc.title}
            </h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5 truncate">{doc.fileName}</p>
          </div>
        </div>
      </Link>

      <div className="space-y-1.5 text-body-sm text-[var(--color-muted)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{formatDate(doc.updatedAt)}</span>
          </div>
          <span className="text-xs">{formatFileSize(doc.size)}</span>
        </div>
        <div className="flex items-center justify-between">
          <AccessLevelIcon level={doc.accessLevel} />
          {doc.tags && doc.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap justify-end">
              {doc.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-primary-bg)] text-[var(--color-primary)]"
                >
                  {tag}
                </span>
              ))}
              {doc.tags.length > 3 && (
                <span className="text-[10px] text-[var(--color-muted)]">+{doc.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

export function DocumentLibrary({ orgId }: DocumentLibraryProps) {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<CategoryTab>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [archiveId, setArchiveId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [publishId, setPublishId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState<string>('other')
  const [uploadAccessLevel, setUploadAccessLevel] = useState<string>('tenantOnly')
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const queryParams = {
    organizationId: orgId,
    category: category !== 'all' ? category : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    q: search || undefined,
    limit: LIMIT,
    offset,
  }

  const { data, isLoading, error } = useQuery(
    searchDocumentsOptions({
      query: queryParams as any,
      headers: { 'x-org-id': orgId },
    }),
  )

  const doArchive = useMutation({
    ...archiveDocumentMutation(),
    onSuccess: () => {
      toast.success('Document archived')
      queryClient.invalidateQueries({ queryKey: searchDocumentsQueryKey({ query: { organizationId: orgId } as any }) })
    },
    onError: (err) => toast.error(err.message || 'Failed to archive document'),
  })

  const doDelete = useMutation({
    ...deleteDocumentMutation(),
    onSuccess: () => {
      toast.success('Document deleted')
      queryClient.invalidateQueries({ queryKey: searchDocumentsQueryKey({ query: { organizationId: orgId } as any }) })
    },
    onError: (err) => toast.error((err as unknown as Error).message || 'Failed to delete document'),
  })

  const doPublish = useMutation({
    ...updateDocumentMutation(),
    onSuccess: () => {
      toast.success('Document published')
      setPublishId(null)
      queryClient.invalidateQueries({ queryKey: searchDocumentsQueryKey({ query: { organizationId: orgId } as any }) })
    },
    onError: (err) => toast.error((err as unknown as Error).message || 'Failed to publish document'),
  })

  const doCreate = useMutation({
    ...createDocumentMutation(),
    onSuccess: () => {
      toast.success('Document created')
      queryClient.invalidateQueries({ queryKey: searchDocumentsQueryKey({ query: { organizationId: orgId } as any }) })
      resetUploadForm()
    },
    onError: (err) => toast.error(err.message || 'Failed to create document'),
  })

  const resetUploadForm = useCallback(() => {
    setShowUploadForm(false)
    setUploadFile(null)
    setUploadTitle('')
    setUploadCategory('other')
    setUploadAccessLevel('tenantOnly')
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      setUploadFile(file)
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
      setShowUploadForm(true)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
      setShowUploadForm(true)
    }
  }, [])

  const handleUploadSubmit = useCallback(() => {
    if (!uploadFile || !uploadTitle.trim()) return
    doCreate.mutate({
      headers: { 'x-org-id': orgId },
      body: {
        title: uploadTitle.trim(),
        fileName: uploadFile.name,
        mimeType: uploadFile.type || 'application/octet-stream',
        size: BigInt(uploadFile.size),
        storageKey: `documents/${orgId}/${Date.now()}-${uploadFile.name}`,
        ownerId: orgId,
        ownerType: 'organization',
        accessLevel: uploadAccessLevel as AssociationCoreDocumentsDocumentAccessLevel,
        category: uploadCategory,
      },
    })
  }, [uploadFile, uploadTitle, uploadCategory, uploadAccessLevel, orgId, doCreate])

  const documents = (data as any)?.data ?? []
  const total = documents.length

  if (error) {
    return (
      <div role="alert" aria-live="polite" className="text-sm text-[var(--color-error)] p-4 rounded-xl border border-destructive/20">
        Failed to load documents.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-[var(--color-surface)]">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1">
            <FileText className="w-4 h-4" />
            <p className="text-sm">Total</p>
          </div>
          <p className="text-[26px] font-bold font-display">{total}</p>
        </div>
        <div className="p-4 rounded-lg border bg-[var(--color-surface)]">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1">
            <Eye className="w-4 h-4" />
            <p className="text-sm">Published</p>
          </div>
          <p className="text-[26px] font-bold font-display">
            {documents.filter((d: any) => d.status === 'published').length}
          </p>
        </div>
        <div className="p-4 rounded-lg border bg-[var(--color-surface)] col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1">
            <Search className="w-4 h-4" />
            <p className="text-sm">Showing</p>
          </div>
          <p className="text-[26px] font-bold font-display">{total}</p>
        </div>
      </div>

      {/* Upload drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-bg)]'
            : 'border-[var(--color-border-light)] hover:border-[var(--color-primary)]'
        }`}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--color-muted)]" />
        {/* eslint-disable no-restricted-syntax -- file input + form labels need native elements */}
        <p className="text-sm text-[var(--color-muted)] mb-2">
          Drag and drop a file here, or{' '}
          <label className="text-[var(--color-primary)] cursor-pointer hover:underline">
            browse
            <input type="file" className="hidden" onChange={handleFileSelect} />
          </label>
        </p>
        <p className="text-xs text-[var(--color-muted)]">PDF, DOC, DOCX, XLS, XLSX, PNG, JPG up to 25MB</p>
      </div>

      {/* Upload form */}
      {showUploadForm && uploadFile && (
        <GlassCard className="p-6 space-y-4">
          <h3 className="text-h4">Upload Document</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-muted)]">Title</label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Document title"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-muted)]">File</label>
              <p className="text-sm text-[var(--color-foreground)] truncate py-2">
                {uploadFile.name} ({formatFileSize(uploadFile.size)})
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-muted)]">Category</label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_TABS.filter((c) => c.key !== 'all').map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-muted)]">Access Level</label>
              <Select value={uploadAccessLevel} onValueChange={setUploadAccessLevel}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Access Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="tenantOnly">Members Only</SelectItem>
                  <SelectItem value="unitOnly">Unit Only</SelectItem>
                  <SelectItem value="restricted">Officers Only</SelectItem>
                  <SelectItem value="privileged">Privileged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={resetUploadForm}>Cancel</Button>
            <Button
              onClick={handleUploadSubmit}
              disabled={!uploadTitle.trim() || doCreate.isPending}
            >
              {doCreate.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </GlassCard>
      )}
      {/* eslint-enable no-restricted-syntax */}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 border rounded-md p-1 overflow-x-auto">
          {CATEGORY_TABS.map((t) => (
            <Button
              key={t.key}
              variant={category === t.key ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCategory(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-56 h-9"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="border rounded-lg p-12 text-center text-[var(--color-muted)]">
          {search || category !== 'all' || statusFilter !== 'all'
            ? 'No documents match your filters.'
            : 'No documents yet. Upload your first document above.'}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc: AssociationCoreDocumentsDocument) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                orgId={orgId}
                onArchive={(id) => setArchiveId(id)}
                onDelete={(id) => setDeleteId(id)}
                onPublish={(id) => setPublishId(id)}
              />
            ))}
          </div>
          {documents.length >= LIMIT && (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                onClick={() => setOffset((prev) => prev + LIMIT)}
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={publishId !== null}
        onOpenChange={(open) => { if (!open) setPublishId(null) }}
        title="Publish Document"
        description="This will make the document visible to members. Are you sure?"
        confirmLabel="Publish"
        onConfirm={() => {
          if (publishId) doPublish.mutate({ path: { documentId: publishId }, body: { status: 'published' } as any, headers: { 'x-org-id': orgId } })
          setPublishId(null)
        }}
      />

      <ConfirmDialog
        open={archiveId !== null}
        onOpenChange={(open) => { if (!open) setArchiveId(null) }}
        title="Archive Document"
        description="Are you sure you want to archive this document? It will no longer appear in the active library."
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={() => {
          if (archiveId) doArchive.mutate({ path: { documentId: archiveId }, headers: { 'x-org-id': orgId } })
          setArchiveId(null)
        }}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null) }}
        title="Delete Document"
        description="This will permanently delete the document. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteId) doDelete.mutate({ path: { documentId: deleteId }, headers: { 'x-org-id': orgId } })
          setDeleteId(null)
        }}
      />
    </div>
  )
}
