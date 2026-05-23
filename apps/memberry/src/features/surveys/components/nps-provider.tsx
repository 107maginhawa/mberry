import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePendingNps } from '../hooks/use-pending-nps'
import { NpsModal } from './nps-modal'

/**
 * NPS Provider — mount inside the authenticated layout.
 * Renders a Formbricks-style slide-in NPS modal when a pending
 * NPS survey is detected for the current user.
 */
export function NpsProvider() {
  const { pendingNps } = usePendingNps()
  const queryClient = useQueryClient()
  const [dismissed, setDismissed] = useState(false)

  const handleDismiss = useCallback(() => {
    setDismissed(true)
  }, [])

  const handleComplete = useCallback(() => {
    setDismissed(true)
    // Invalidate so hook picks up the next survey (if any)
    queryClient.invalidateQueries({ queryKey: ['surveys', 'pending-nps'] })
  }, [queryClient])

  if (!pendingNps || dismissed) return null

  return (
    <NpsModal
      survey={pendingNps}
      onDismiss={handleDismiss}
      onComplete={handleComplete}
    />
  )
}
