import * as React from 'react'
import { Label } from '@monobase/ui'
import { cn } from '@/lib/utils'
import type { FieldError } from 'react-hook-form'

interface FormFieldProps {
  /** Field name — used to generate stable IDs for aria attributes */
  name: string
  /** Label text */
  label: string
  /** Whether the field is required (shows asterisk) */
  required?: boolean
  /** Helper text shown below the input */
  description?: string
  /** Error object from react-hook-form formState.errors */
  error?: FieldError
  /** Additional className for the wrapper div */
  className?: string
  /** The input element(s) */
  children: React.ReactNode
}

/**
 * Standardized form field wrapper: Label + Input + Error + Helper text.
 *
 * Works with both `register()` and `Controller` patterns — just pass
 * the input as children. Handles aria-describedby, error display,
 * required indicator, and helper text.
 *
 * @example
 * ```tsx
 * <FormField name="email" label="Email" required error={errors.email}>
 *   <Input {...register('email')} />
 * </FormField>
 * ```
 */
export function FormField({
  name,
  label,
  required,
  description,
  error,
  className,
  children,
}: FormFieldProps) {
  const inputId = `field-${name}`
  const errorId = `${inputId}-error`
  const descId = `${inputId}-desc`

  // Clone children to inject id and aria attributes
  const enhancedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child
    const ariaDescParts: string[] = []
    if (description) ariaDescParts.push(descId)
    if (error) ariaDescParts.push(errorId)

    return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
      id: (child.props as Record<string, unknown>).id ?? inputId,
      'aria-describedby': ariaDescParts.length > 0 ? ariaDescParts.join(' ') : undefined,
      'aria-invalid': error ? true : undefined,
    })
  })

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={inputId}>
        {label}
        {required && <span className="text-[var(--color-error)] ml-0.5">*</span>}
      </Label>
      {enhancedChildren}
      {description && !error && (
        <p id={descId} className="text-xs text-[var(--color-muted)]">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-[var(--color-error)]">
          {error.message}
        </p>
      )}
    </div>
  )
}
