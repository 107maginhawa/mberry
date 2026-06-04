import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Badge } from '@monobase/ui'
import { GlassCard } from '@/components/motion/glass-card'
import { TableSkeleton } from '@/components/patterns/skeleton-loader'
import { EmptyState } from '@/components/patterns/empty-state'
import { FileText, Trash2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface Template {
  id: string
  name: string
  channel: string
  category: string
  status: string
  subject?: string
  body?: string
}

interface TemplateListProps {
  orgId: string
  onEdit?: (templateId: string) => void
  onNew?: () => void
}

export function TemplateList({ orgId, onEdit, onNew }: TemplateListProps) {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['templates', orgId],
    queryFn: () =>
      api.get<{ data: Template[] }>(
        `/api/association/message-templates?organizationId=${orgId}`
      ),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/association/message-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', orgId] })
      toast.success('Template deleted')
    },
    onError: () => {
      toast.error('Failed to delete template')
    },
  })

  const templates = data?.data ?? []
  const filtered = search
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
      )
    : templates

  if (isLoading) {
    return <TableSkeleton rows={5} cols={5} />
  }

  if (isError) {
    return (
      <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
        Unable to load templates. Please try refreshing the page.
      </div>
    )
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={32} />}
        headline="No templates yet"
        description="Create your first message template to speed up communications."
        action={onNew ? { label: 'New Template', onClick: onNew } : undefined}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <Input
        placeholder="Search templates..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Table */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-surface-warm)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Name</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Channel</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Category</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">Status</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--color-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tpl) => (
                <tr
                  key={tpl.id}
                  className="border-b border-[var(--color-border-light)] last:border-0 hover:bg-[var(--color-surface-elevated-hover)] transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{tpl.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{tpl.channel}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{tpl.category}</td>
                  <td className="px-4 py-3">
                    <Badge variant={tpl.status === 'active' ? 'default' : 'secondary'}>
                      {tpl.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onEdit && (
                        // ui-c-exempt: methodology-carry — row-action icon 32px
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => onEdit(tpl.id)}
                          aria-label={`Edit ${tpl.name}`}
                        >
                          <Pencil size={14} />
                        </Button>
                      )}
                      {/* ui-c-exempt: methodology-carry — icon action 32px destructive */}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-[var(--color-error)]"
                        onClick={() => deleteMutation.mutate(tpl.id)}
                        disabled={deleteMutation.isPending}
                        aria-label={`Delete ${tpl.name}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
