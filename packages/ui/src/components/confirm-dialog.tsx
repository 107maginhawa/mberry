import { useState } from "react"
import type { ReactNode } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "./alert-dialog"
import { Input } from "./input"
import { Label } from "./label"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string | ReactNode
  confirmLabel: string
  onConfirm: () => void
  variant?: "destructive" | "high-consequence" | "irreversible"
  confirmText?: string
  children?: ReactNode
}

// Confirmation for consequential one-click mutations (DESIGN.md). For the
// `irreversible` variant the user must type `confirmText` to enable confirm.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "destructive",
  confirmText,
  children,
}: ConfirmDialogProps) {
  const [typedText, setTypedText] = useState("")
  const canConfirm = variant === "irreversible" ? typedText === confirmText : true

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md border-[var(--color-border)] bg-[var(--color-surface)]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-section">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-body text-[var(--color-text-secondary)]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {children}

        {variant === "irreversible" && confirmText && (
          <div className="my-2">
            <Label className="text-body font-medium text-[var(--color-muted)] block mb-1.5">
              Type <span className="font-mono font-semibold">{confirmText}</span> to confirm
            </Label>
            <Input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setTypedText("")}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/90"
            onClick={() => {
              onConfirm()
              setTypedText("")
            }}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
