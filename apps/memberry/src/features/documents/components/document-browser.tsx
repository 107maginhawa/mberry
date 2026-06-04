// oli-execute: error-handled-inline -- consumed by /org/$orgSlug/documents route.
import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import {
  FileText,
  Search,
  ChevronRight,
  FolderOpen,
  FileCheck,
  ScrollText,
  ClipboardList,
  Vote,
  BarChart3,
  File,
} from 'lucide-react'
import { Button, Input, Skeleton, Tabs, TabsList, TabsTrigger } from '@monobase/ui'
import { searchDocumentsOptions } from '@monobase/sdk-ts/generated/react-query'

interface DocumentBrowserProps {
  orgId: string
}

const CATEGORIES = [
  { value: 'all', label: 'All', icon: FolderOpen },
  { value: 'bylaws', label: 'Bylaws', icon: ScrollText },
  { value: 'minutes', label: 'Minutes', icon: FileCheck },
  { value: 'policies', label: 'Policies', icon: ClipboardList },
  { value: 'forms', label: 'Forms', icon: FileText },
  { value: 'election_results', label: 'Election Results', icon: Vote },
  { value: 'financial_reports', label: 'Financial Reports', icon: BarChart3 },
  { value: 'other', label: 'Other', icon: File },
] as const

type CategoryFilter = (typeof CATEGORIES)[number]['value']

/** Access levels visible to regular members (not officers-only). */
const MEMBER_ACCESS_LEVELS = new Set(['public', 'tenantOnly'])

interface DocumentRow {
  id: string
  title: string
  fileName: string
  mimeType: string
  size: bigint | number
  accessLevel: string
  category?: string
  tags?: string[]
  updatedAt: string | Date
  createdAt: string | Date
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatFileSize(bytes: bigint | number): string {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function categoryLabel(category: string | undefined): string {
  if (!category) return 'Other'
  const found = CATEGORIES.find((c) => c.value === category)
  return found ? found.label : category.charAt(0).toUpperCase() + category.slice(1)
}

export function DocumentBrowser({ orgId }: DocumentBrowserProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (debounceRef[0]) clearTimeout(debounceRef[0])
      debounceRef[0] = setTimeout(() => {
        setDebouncedSearch(value.trim())
      }, 300)
    },
    [debounceRef],
  )

  const [offset, setOffset] = useState(0)
  const LIMIT = 100

  const queryParams: Record<string, unknown> = {
    ownerId: orgId,
    ownerType: 'organization',
    limit: LIMIT,
    offset,
    // API-side access filter — only public and member-level documents
    accessLevel: 'tenantOnly',
  }
  if (category !== 'all') queryParams.category = category
  if (debouncedSearch) queryParams.q = debouncedSearch

  const { data, isLoading, error } = useQuery(
    searchDocumentsOptions({ query: queryParams as any }),
  )

  // Also pass public access separately via a second query and merge client-side
  const publicQueryParams: Record<string, unknown> = {
    ownerId: orgId,
    ownerType: 'organization',
    limit: LIMIT,
    offset,
    accessLevel: 'public',
  }
  if (category !== 'all') publicQueryParams.category = category
  if (debouncedSearch) publicQueryParams.q = debouncedSearch

  const { data: publicData } = useQuery(
    searchDocumentsOptions({ query: publicQueryParams as any }),
  )

  const [extraPages, setExtraPages] = useState<DocumentRow[][]>([])

  const documents = useMemo(() => {
    const tenantDocs = ((data as any)?.data as DocumentRow[] | undefined) ?? []
    const publicDocs = ((publicData as any)?.data as DocumentRow[] | undefined) ?? []
    const merged = [...tenantDocs, ...publicDocs]
    // Deduplicate by id
    const seen = new Set<string>()
    const deduped = merged.filter((doc) => {
      if (seen.has(doc.id)) return false
      seen.add(doc.id)
      return true
    })
    // Safety fallback: client-side filter
    const filtered = deduped.filter((doc) => MEMBER_ACCESS_LEVELS.has(doc.accessLevel))
    // Append extra pages from load-more
    const allExtra = extraPages.flat()
    const allExtraSeen = new Set(filtered.map((d) => d.id))
    const additionalDocs = allExtra.filter((d) => !allExtraSeen.has(d.id))
    return [...filtered, ...additionalDocs]
  }, [data, publicData, extraPages])

  const totalReturnedCount = ((data as any)?.data?.length ?? 0) + ((publicData as any)?.data?.length ?? 0)
  const hasMore = totalReturnedCount >= LIMIT

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: documents.length }
    for (const doc of documents) {
      const cat = doc.category || 'other'
      map[cat] = (map[cat] || 0) + 1
    }
    return map
  }, [documents])

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
        <Input
          placeholder="Search documents by title or tag..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category tabs */}
      <Tabs value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
        <TabsList className="flex-wrap h-auto gap-1">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value} className="text-xs">
              {cat.label}
              {!isLoading && counts[cat.value] !== undefined ? ` (${counts[cat.value]})` : ''}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Document list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="border rounded-lg p-12 text-center text-[var(--color-error)]">
          Failed to load documents
        </div>
      ) : documents.length === 0 ? (
        <div className="border rounded-lg p-16 text-center">
          <FileText className="w-10 h-10 text-[var(--color-muted)] mx-auto mb-3" />
          <p className="font-medium">
            {debouncedSearch ? 'No documents match your search' : 'No documents available'}
          </p>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {debouncedSearch
              ? 'Try a different search term or category.'
              : 'Documents will appear here when published by your organization.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              to="/org/$orgSlug/documents/$documentId"
              params={{ orgSlug, documentId: doc.id }}
              className="flex items-center gap-4 border rounded-lg p-4 hover:bg-[var(--color-surface-warm)] transition-colors group"
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[var(--color-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-surface-warm)] text-[var(--color-muted)]">
                    {categoryLabel(doc.category)}
                  </span>
                  {doc.accessLevel === 'public' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                      Public
                    </span>
                  )}
                </div>
                <p className="font-medium truncate">{doc.title}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-muted)]">
                  <span>Updated {formatDate(doc.updatedAt)}</span>
                  <span>{formatFileSize(doc.size)}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-text)] transition-colors shrink-0" />
            </Link>
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                onClick={() => setOffset((prev) => prev + LIMIT)}
              >
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
