/**
 * Directory profile visibility utilities.
 */

export type Visibility = 'public' | 'memberOnly' | 'hidden';

const LABELS: Record<Visibility, string> = {
  public: 'Public',
  memberOnly: 'Members Only',
  hidden: 'Hidden',
};

const ICONS: Record<Visibility, string> = {
  public: 'globe',
  memberOnly: 'users',
  hidden: 'eye-off',
};

export function getVisibilityLabel(visibility: Visibility): string {
  return LABELS[visibility] ?? visibility;
}

export function isSearchable(visibility: Visibility): boolean {
  return visibility !== 'hidden';
}

export function getVisibilityIcon(visibility: Visibility): string {
  return ICONS[visibility] ?? 'help-circle';
}
