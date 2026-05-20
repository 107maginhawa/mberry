import { useState } from "react"
import type { ReactNode } from "react"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string | ReactNode
  confirmLabel: string
  onConfirm: () => void
  variant?: "destructive" | "high-consequence" | "irreversible"
  confirmText?: string
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "destructive",
  confirmText,
}: ConfirmDialogProps) {
  const [typedText, setTypedText] = useState("")
  const canConfirm = variant === "irreversible" ? typedText === confirmText : true

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative bg-[var(--color-surface)] rounded-[12px] border border-[var(--color-border)] p-6 max-w-md w-full mx-4 shadow-deep">
        <h3 className="text-h3 mb-2">{title}</h3>
        <div className="text-[14px] text-[var(--color-text-secondary)] mb-4">{description}</div>

        {variant === "irreversible" && confirmText && (
          <div className="mb-4">
            <label className="text-[13px] font-medium text-[var(--color-muted)] block mb-1.5">
              Type <span className="font-mono font-semibold">{confirmText}</span> to confirm
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              className="w-full px-4 py-[11px] border border-[var(--color-border)] rounded-[8px] text-[14px] focus:border-[var(--color-primary)] focus:ring-[4px] focus:ring-[var(--color-primary-subtle)] outline-none"
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => { setTypedText(""); onOpenChange(false) }}
            className="px-[22px] py-[10px] rounded-[8px] border-[1.5px] border-[var(--color-border)] text-[14px] font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); setTypedText(""); onOpenChange(false) }}
            disabled={!canConfirm}
            className="px-[22px] py-[10px] rounded-[8px] bg-[var(--color-error)] text-white text-[14px] font-semibold hover:opacity-90 disabled:opacity-50 transition-colors duration-150"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
