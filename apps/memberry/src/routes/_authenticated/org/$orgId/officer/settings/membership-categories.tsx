import { createFileRoute } from '@tanstack/react-router'
import { CategoryEditor } from '@/features/membership/components/category-editor'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/settings/membership-categories')({
  component: CategoriesPage,
})

function CategoriesPage() {
  const { orgId } = Route.useParams()
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Membership Categories</h1>
      <CategoryEditor orgId={orgId} />
    </div>
  )
}
