import { useState } from 'react'
import { X, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@monobase/ui'

interface AlertBannerProps {
  variant?: 'warning' | 'info'
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  dismissible?: boolean
}

export function AlertBanner({ variant = 'warning', message, action, dismissible = true }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const isWarning = variant === 'warning'
  const bgColor = isWarning ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
  const textColor = isWarning ? 'text-amber-800' : 'text-blue-800'
  const Icon = isWarning ? AlertTriangle : Info
  const iconColor = isWarning ? 'text-amber-500' : 'text-blue-500'

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
          onClick={() => setDismissed(true)}
          className={`p-1 rounded hover:bg-black/5 ${textColor}`}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
