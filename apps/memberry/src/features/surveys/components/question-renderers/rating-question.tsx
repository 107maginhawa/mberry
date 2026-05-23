import { useState, useCallback } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@monobase/ui';

interface RatingQuestionProps {
  value: number | null
  onChange: (value: number) => void
  maxStars?: number
}

export function RatingQuestion({ value, onChange, maxStars = 5 }: RatingQuestionProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const handleSelect = useCallback(
    (n: number) => onChange(n),
    [onChange],
  )

  const displayValue = hovered ?? value ?? 0

  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: maxStars }, (_, i) => {
        const starValue = i + 1
        const filled = starValue <= displayValue

        return (
          <Button
            key={starValue}
            type="button"
            onClick={() => handleSelect(starValue)}
            onMouseEnter={() => setHovered(starValue)}
            onMouseLeave={() => setHovered(null)}
            className="p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
          >
            <Star
              size={36}
              className={`transition-colors ${
                filled
                  ? 'fill-[var(--color-warning)] text-[var(--color-warning)]'
                  : 'fill-transparent text-[var(--color-muted)]'
              }`}
            />
          </Button>
        )
      })}
    </div>
  )
}
