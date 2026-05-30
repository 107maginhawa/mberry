import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { GraduationCap, Search } from 'lucide-react'
import { useState } from 'react'
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
import { RequireRole } from '@/lib/role-gate'
import { ErrorState } from '@/components/skeletons'
import { searchCoursesOptions } from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

export const Route = createFileRoute('/training/')({
  component: () => (
    <RequireRole allowed={['super', 'support', 'analyst']}>
      <TrainingPage />
    </RequireRole>
  ),
})

interface CourseItem {
  id: string
  title: string
  organizationId?: string
  organizationName?: string
  status?: string
  enrollmentCount?: number
  completionCount?: number
  credits?: number
  startDate?: string
  endDate?: string
  provider?: string
}

const PAGE_SIZE = 25

function TrainingPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const { data, isLoading, isError, refetch } = useQuery(
    searchCoursesOptions({
      query: {
        ...(search.length >= 2 ? { q: search } : {}),
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      },
    })
  )

  if (isError) {
    return (
      <div className="p-8 max-w-2xl">
        <ErrorState message="Could not load training" onRetry={() => refetch()} />
      </div>
    )
  }

  const courses = (data?.data ?? []) as unknown as CourseItem[]
  const hasMore = courses.length === PAGE_SIZE

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <GraduationCap className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-h1 text-foreground">Training &amp; Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-org training and course overview
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Summary */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground mb-4">
          {courses.length === 0
            ? 'No courses'
            : `Showing ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + courses.length} courses`}
        </p>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="p-4 text-sm">Course</TableHead>
              <TableHead className="p-4 text-sm">Organization</TableHead>
              <TableHead className="p-4 text-sm">Provider</TableHead>
              <TableHead className="p-4 text-sm">Status</TableHead>
              <TableHead className="p-4 text-sm text-right">Enrolled</TableHead>
              <TableHead className="p-4 text-sm text-right">Credits</TableHead>
              <TableHead className="p-4 text-sm">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="p-8 text-center text-muted-foreground animate-pulse">
                  Loading courses...
                </TableCell>
              </TableRow>
            ) : courses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                  <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No courses found{search ? ` matching "${search}"` : ''}</p>
                  {search && <p className="text-xs mt-1">Try a different search term</p>}
                </TableCell>
              </TableRow>
            ) : (
              courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="p-4 text-sm font-medium">{course.title}</TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">
                    {course.organizationName ?? '--'}
                  </TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">
                    {course.provider ?? '--'}
                  </TableCell>
                  <TableCell className="p-4 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        course.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : course.status === 'completed'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {course.status ?? 'unknown'}
                    </span>
                  </TableCell>
                  <TableCell className="p-4 text-sm text-right">
                    {course.enrollmentCount ?? 0}
                  </TableCell>
                  <TableCell className="p-4 text-sm text-right">
                    {course.credits ?? '--'}
                  </TableCell>
                  <TableCell className="p-4 text-sm text-muted-foreground">
                    {course.startDate
                      ? new Date(course.startDate).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '--'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ← Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  )
}
