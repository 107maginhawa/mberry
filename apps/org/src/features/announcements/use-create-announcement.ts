import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { createAnnouncement, type Announcement } from '@monobase/sdk-ts/generated'

function serverError(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error) {
    const e = (error as { error?: unknown }).error
    if (typeof e === 'string') return e
  }
  return undefined
}

export function useCreateAnnouncement(orgId: string | null): UseMutationResult<Announcement, Error, { title: string; content: string }> {
  return useMutation<Announcement, Error, { title: string; content: string }>({
    mutationFn: async ({ title, content }) => {
      if (!orgId) throw new Error('No organization selected.')
      const { data, error } = await createAnnouncement({ path: { organizationId: orgId }, body: { title, content } })
      if (!data) throw new Error(serverError(error) ?? 'Could not post the announcement.')
      return data as Announcement
    },
  })
}
