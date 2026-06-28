import { createFileRoute } from '@tanstack/react-router'
import { SignInForm } from '@/features/auth/SignInForm'

export const Route = createFileRoute('/sign-in')({ component: SignInForm })
