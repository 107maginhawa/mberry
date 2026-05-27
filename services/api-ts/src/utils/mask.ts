/**
 * Mask an email address for safe logging.
 * "john.doe@example.com" → "j***@example.com"
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email || typeof email !== 'string') return '[no-email]';
  const atIndex = email.indexOf('@');
  if (atIndex < 1) return '***';
  return `${email[0]}***@${email.slice(atIndex + 1)}`;
}
