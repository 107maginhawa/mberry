import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PageShell } from '@/components/patterns/page-shell'
import { TemplateList } from '@/features/communications/components/template-list'
import { Button } from '@monobase/ui'
import { Plus } from 'lucide-react'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute(
  '/_authenticated/org/$orgSlug/officer/communications/templates/',
)({
  component: TemplateListPage,
})

function TemplateListPage() {
  const { orgId, orgSlug } = useOrg()
  const navigate = useNavigate()

  return (
    <PageShell
      title="Message Templates"
      subtitle="Create and manage reusable message templates"
      breadcrumbs={[
        { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
        { label: 'Communications', href: `/org/${orgSlug}/officer/communications` },
        { label: 'Templates' },
      ]}
      actions={
        <Button onClick={() => navigate({ to: `/org/${orgSlug}/officer/communications/templates/new` })}>
          <Plus size={16} className="mr-1.5" />
          New Template
        </Button>
      }
    >
      <TemplateList
        orgId={orgId}
        onEdit={(id) =>
          navigate({
            to: `/org/${orgSlug}/officer/communications/templates/new`,
            search: { edit: id },
          })
        }
        onNew={() => navigate({ to: `/org/${orgSlug}/officer/communications/templates/new` })}
      />
    </PageShell>
  )
}
