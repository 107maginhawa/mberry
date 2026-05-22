/**
 * Profile display formatting utilities.
 */

export function formatPersonName(
  firstName: string,
  lastName?: string | null,
  middleName?: string | null,
): string {
  const parts = [firstName];
  if (middleName) parts.push(middleName);
  if (lastName) parts.push(lastName);
  return parts.join(' ');
}

export function formatLicenseDisplay(
  licenseNumber?: string | null,
  prcId?: string | null,
): string {
  if (prcId && licenseNumber) return `${prcId} (License: ${licenseNumber})`;
  if (licenseNumber) return `License: ${licenseNumber}`;
  if (prcId) return `PRC: ${prcId}`;
  return '';
}

export function getInitials(firstName: string, lastName?: string | null): string {
  const first = firstName[0]?.toUpperCase() || '';
  const last = lastName?.[0]?.toUpperCase() || '';
  return last ? `${first}${last}` : first;
}
