import { useCallback } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@monobase/ui';

interface ChoiceQuestionProps {
  options: string[]
  value: string | string[] | null
  onChange: (value: string | string[]) => void
  multiSelect?: boolean
}

export function ChoiceQuestion({
  options,
  value,
  onChange,
  multiSelect = false,
}: ChoiceQuestionProps) {
  const selectedSet = new Set(
    Array.isArray(value) ? value : value ? [value] : [],
  )

  const handleSelect = useCallback(
    (option: string) => {
      if (multiSelect) {
        const next = new Set(selectedSet)
        if (next.has(option)) {
          next.delete(option)
        } else {
          next.add(option)
        }
        onChange(Array.from(next))
      } else {
        onChange(option)
      }
    },
    [multiSelect, onChange, selectedSet],
  )

  return (
    <div className="grid gap-3 max-w-lg mx-auto">
      {options.map((option) => {
        const selected = selectedSet.has(option)
        return (
          <Button
            key={option}
            type="button"
            onClick={() => handleSelect(option)}
            className={`relative flex items-center gap-3 px-5 py-4 rounded-[var(--radius-md)] text-left text-base font-medium transition-all
              ${
                selected
                  ? 'bg-[var(--color-primary-bg)] border-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'bg-[var(--color-surface-elevated)] border-2 border-[var(--color-surface-border-glass)] text-[var(--color-text)] hover:border-[var(--color-primary-lighter)]'
              }`}
          >
            <span className="flex-1">{option}</span>
            {selected && (
              <Check size={20} className="text-[var(--color-primary)] shrink-0" />
            )}
          </Button>
        )
      })}
    </div>
  )
}
