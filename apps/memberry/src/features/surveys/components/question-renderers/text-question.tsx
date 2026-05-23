import { useCallback } from 'react'
import { Textarea } from '@monobase/ui'

interface TextQuestionProps {
  value: string | null
  onChange: (value: string) => void
  maxLength?: number
  placeholder?: string
}

export function TextQuestion({
  value,
  onChange,
  maxLength = 1000,
  placeholder = 'Type your answer here...',
}: TextQuestionProps) {
  const current = value ?? ''

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value
      if (text.length <= maxLength) {
        onChange(text)
      }
    },
    [onChange, maxLength],
  )

  return (
    <div className="max-w-lg mx-auto space-y-2">
      <Textarea
        value={current}
        onChange={handleChange}
        placeholder={placeholder}
        rows={5}
        maxLength={maxLength}
        className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-[var(--color-surface-border-glass)] bg-[var(--color-surface-elevated)] text-[var(--color-text)] text-base placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none transition-colors"
      />
      <p className="text-right text-xs text-[var(--color-muted)]">
        {current.length} / {maxLength}
      </p>
    </div>
  )
}
