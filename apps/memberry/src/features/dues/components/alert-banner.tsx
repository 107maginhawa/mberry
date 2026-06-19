import { useState } from 'react'
import { X, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@monobase/ui'

interface AlertBannerProps {
  variant?: 'warning' | 'info'
  message: string
  dismissKey?: string
  action?: {
    label: string
    onClick: () => void
  }
  dismissible?: boolean
}

export function AlertBanner({ variant = 'warning', message, dismissKey, action, dismissible = true }: AlertBannerProps) {
  const storageKey = dismissKey ? `alert-dismissed-${dismissKey}` : null
  const [dismissed, setDismissed] = useState(() => {
    if (storageKey) {
      try { return localStorage.getItem(storageKey) === 'true' } catch (_) { return false }
    }
    return false
  })

  function handleDismiss() {
    setDismissed(true)
    if (storageKey) {
      try { localStorage.setItem(storageKey, 'true') } catch (_) { /* ignore storage errors */ }
    }
  }

  if (dismissed) return null

  const isWarning = variant === 'warning'
  const bgColor = isWarning ? 'bg-[var(--color-warning-bg)] border-[var(--color-warning)]' : 'bg-[var(--color-info-bg)] border-[var(--color-info)]'
  const textColor = isWarning ? 'text-[var(--color-warning)]' : 'text-[var(--color-info)]'
  const Icon = isWarning ? AlertTriangle : Info
  const iconColor = isWarning ? 'text-[var(--color-warning)]' : 'text-[var(--color-info)]'

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColor}`} role="alert">
      <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} />
      <p className={`flex-1 text-sm ${textColor}`}>{message}</p>
      {action && (
        <Button
          variant="ghost"
          size="sm"
          onClick={action.onClick}
          className={`text-sm font-medium underline-offset-2 hover:underline ${textColor}`}
        >
          {action.label}
        </Button>
      )}
      {dismissible && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className={`p-1 rounded hover:bg-black/5 ${textColor}`}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
