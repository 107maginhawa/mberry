/**
 * Dues reminder schedule calculation.
 * Default schedule per M6-R5: 60/30/7 days before expiry, day-of, 7/30 days after.
 */

export interface ReminderScheduleEntry {
  /** Days relative to expiry. Negative = before, 0 = day-of, positive = after */
  daysFromExpiry: number;
  /** Label for the reminder type */
  label: string;
  /** Channel: in-app is always on; email/push are opt-in */
  channels: ('in-app' | 'email' | 'push')[];
}

export const DEFAULT_REMINDER_SCHEDULE: ReminderScheduleEntry[] = [
  { daysFromExpiry: -60, label: 'Pre-60 day reminder', channels: ['in-app', 'email'] },
  { daysFromExpiry: -30, label: 'Pre-30 day reminder', channels: ['in-app', 'email'] },
  { daysFromExpiry: -7, label: 'Pre-7 day reminder', channels: ['in-app', 'email', 'push'] },
  { daysFromExpiry: 0, label: 'Expiry day reminder', channels: ['in-app', 'email', 'push'] },
  { daysFromExpiry: 7, label: 'Post-7 day reminder', channels: ['in-app', 'email', 'push'] },
  { daysFromExpiry: 30, label: 'Post-30 day reminder', channels: ['in-app', 'email'] },
];

/**
 * Calculate the actual dates for reminders based on a dues expiry date.
 */
export function calculateReminderDates(
  expiryDate: Date,
  schedule: ReminderScheduleEntry[] = DEFAULT_REMINDER_SCHEDULE,
): Array<ReminderScheduleEntry & { sendAt: Date }> {
  return schedule.map(entry => {
    const sendAt = new Date(expiryDate);
    sendAt.setDate(sendAt.getDate() + entry.daysFromExpiry);
    return { ...entry, sendAt };
  });
}

/**
 * Get reminders that should be sent today (or are overdue).
 */
export function getDueReminders(
  expiryDate: Date,
  alreadySentDays: number[] = [],
  schedule: ReminderScheduleEntry[] = DEFAULT_REMINDER_SCHEDULE,
): Array<ReminderScheduleEntry & { sendAt: Date }> {
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today

  return calculateReminderDates(expiryDate, schedule).filter(
    entry => entry.sendAt <= now && !alreadySentDays.includes(entry.daysFromExpiry),
  );
}
