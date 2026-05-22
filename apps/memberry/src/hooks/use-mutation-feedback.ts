import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'

interface MutationFeedbackOptions<TData, TError, TVariables, TContext>
  extends UseMutationOptions<TData, TError, TVariables, TContext> {
  /** Toast message on success (string or function receiving data) */
  successMessage?: string | ((data: TData) => string)
  /** Toast message on error — defaults to error.message or generic fallback */
  errorMessage?: string | ((error: TError) => string)
}

/**
 * Wraps useMutation with standardized sonner toast feedback.
 *
 * - Success: shows success toast with provided message
 * - Error: shows error toast with message
 * - Returns standard mutation result (isPending, mutate, etc.)
 *
 * @example
 * ```tsx
 * const save = useMutationFeedback({
 *   ...updatePersonMutation(),
 *   successMessage: 'Profile updated',
 *   errorMessage: 'Failed to save profile',
 *   onSuccess: () => queryClient.invalidateQueries({ queryKey: ['person'] }),
 * })
 *
 * <Button disabled={save.isPending}>
 *   {save.isPending ? 'Saving...' : 'Save'}
 * </Button>
 * ```
 */
export function useMutationFeedback<
  TData = unknown,
  TError extends Error = Error,
  TVariables = void,
  TContext = unknown,
>({
  successMessage,
  errorMessage,
  onSuccess,
  onError,
  ...options
}: MutationFeedbackOptions<TData, TError, TVariables, TContext>) {
  return useMutation<TData, TError, TVariables, TContext>({
    ...options,
    onSuccess: (data, variables, context) => {
      if (successMessage) {
        const msg = typeof successMessage === 'function' ? successMessage(data) : successMessage
        toast.success(msg)
      }
      onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      const msg = errorMessage
        ? typeof errorMessage === 'function' ? errorMessage(error) : errorMessage
        : error.message || 'Something went wrong'
      toast.error(msg)
      onError?.(error, variables, context)
    },
  })
}
