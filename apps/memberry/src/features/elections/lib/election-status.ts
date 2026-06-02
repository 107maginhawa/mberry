import type { ElectionStatus } from '@monobase/sdk-ts/generated/types.gen'
import { Clock, FileText, Users, Vote, CheckCircle2, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type { ElectionStatus }

export const ELECTION_STATUS_COLORS: Record<ElectionStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  nominationsOpen: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  votingOpen: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  awaitingConfirmation: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  published: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
}

export const ELECTION_STATUS_LABELS: Record<ElectionStatus, string> = {
  draft: 'Draft',
  nominationsOpen: 'Nominations Open',
  votingOpen: 'Voting Open',
  awaitingConfirmation: 'Awaiting Confirmation',
  published: 'Published',
  cancelled: 'Cancelled',
}

export const ELECTION_STATUS_ICONS: Record<ElectionStatus, LucideIcon> = {
  draft: FileText,
  nominationsOpen: Users,
  votingOpen: Vote,
  awaitingConfirmation: Clock,
  published: CheckCircle2,
  cancelled: XCircle,
}

export const ACTIVE_ELECTION_STATUSES: ElectionStatus[] = ['nominationsOpen', 'votingOpen', 'awaitingConfirmation']
export const MEMBER_VISIBLE_STATUSES: ElectionStatus[] = ['nominationsOpen', 'votingOpen', 'awaitingConfirmation', 'published']

export const STATUS_TRANSITIONS: Partial<Record<ElectionStatus, { label: string; nextStatus: ElectionStatus }>> = {
  draft: { label: 'Open Nominations', nextStatus: 'nominationsOpen' },
  nominationsOpen: { label: 'Open Voting', nextStatus: 'votingOpen' },
  votingOpen: { label: 'Close Voting', nextStatus: 'awaitingConfirmation' },
  awaitingConfirmation: { label: 'Publish Results', nextStatus: 'published' },
}

export function isActiveStatus(status: string | undefined): boolean {
  return !!status && ACTIVE_ELECTION_STATUSES.includes(status as ElectionStatus)
}

export function isMemberVisibleStatus(status: string | undefined): boolean {
  return !!status && MEMBER_VISIBLE_STATUSES.includes(status as ElectionStatus)
}
