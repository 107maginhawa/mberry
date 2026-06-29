import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { createAnnouncement, publishAnnouncement, type Announcement } from '@monobase/sdk-ts/generated'

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

export function useCreateAnnouncement(orgId: string | null): UseMutationResult<Announcement, Error, { title: string; content: string }> {
  const queryClient = useQueryClient()
  return useMutation<Announcement, Error, { title: string; content: string }>({
    mutationFn: async ({ title, content }) => {
      if (!orgId) throw new Error('No organization selected.')
      const { data, error } = await createAnnouncement({ path: { organizationId: orgId }, body: { title, content } })
      if (!data) throw new Error(serverError(error) ?? 'Could not post the announcement.')
      const { data: published, error: pubError } = await publishAnnouncement({ path: { id: data.id } })
      if (!published) throw new Error(serverError(pubError) ?? 'Could not publish the announcement.')
      return published
    },
    // Refetch the list so a freshly posted announcement appears without a manual
    // refresh. Key must match useListAnnouncements' ['announcements', orgId].
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['announcements', orgId] }) },
  })
}
