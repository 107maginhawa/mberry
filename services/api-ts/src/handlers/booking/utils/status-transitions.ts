/**
 * Valid state transitions for booking status.
 *
 * Booking statuses: pending | confirmed | rejected | cancelled |
 *                   completed | no_show_client | no_show_host
 */

export const BOOKING_VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['cancelled', 'completed', 'no_show_client', 'no_show_host'],
  rejected: [],        // terminal
  cancelled: [],       // terminal
  completed: [],       // terminal
  no_show_client: [],  // terminal
  no_show_host: [],    // terminal
};

export function isValidBookingTransition(from: string, to: string): boolean {
  return BOOKING_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Returns a human-readable error message for an invalid booking transition.
 */
export function bookingTransitionError(from: string, to: string): string {
  const allowed = BOOKING_VALID_TRANSITIONS[from];
  if (allowed === undefined) {
    return `Unknown booking status '${from}'`;
  }
  const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)';
  return `Cannot transition booking from '${from}' to '${to}'. Allowed: ${allowedStr}`;
}
