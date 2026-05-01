/**
 * Membership status display logic.
 *
 * Maps backend enum values to human-readable labels, colors,
 * and business rule checks (renewable, reinstatable).
 */

export type MembershipStatus =
  | 'pendingPayment'
  | 'active'
  | 'gracePeriod'
  | 'lapsed'
  | 'expired'
  | 'suspended'
  | 'terminated';

const STATUS_LABELS: Record<MembershipStatus, string> = {
  pendingPayment: 'Pending Payment',
  active: 'Active',
  gracePeriod: 'Grace Period',
  lapsed: 'Lapsed',
  expired: 'Expired',
  suspended: 'Suspended',
  terminated: 'Terminated',
};

const STATUS_COLORS: Record<MembershipStatus, string> = {
  pendingPayment: 'blue',
  active: 'green',
  gracePeriod: 'yellow',
  lapsed: 'orange',
  expired: 'orange',
  suspended: 'red',
  terminated: 'red',
};

const RENEWABLE_STATUSES: MembershipStatus[] = ['active', 'gracePeriod', 'lapsed'];
const REINSTATABLE_STATUSES: MembershipStatus[] = ['terminated', 'suspended'];

export function getStatusLabel(status: MembershipStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function getStatusColor(status: MembershipStatus): string {
  return STATUS_COLORS[status] ?? 'gray';
}

export function isRenewable(status: MembershipStatus): boolean {
  return RENEWABLE_STATUSES.includes(status);
}

export function isReinstatable(status: MembershipStatus): boolean {
  return REINSTATABLE_STATUSES.includes(status);
}

export function formatMemberNumber(memberNumber: string | null | undefined): string {
  if (!memberNumber) return '—';
  return `MEM-${memberNumber}`;
}
