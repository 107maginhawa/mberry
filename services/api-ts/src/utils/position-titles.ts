/**
 * Canonical position title constants for position-based RBAC (D-08/D-09).
 *
 * Use these constants when calling requirePosition() to avoid typos and
 * ensure case-insensitive matching against the DB-sourced positionTitle field.
 */

export const POSITION_TITLES = {
  PRESIDENT: 'President',
  TREASURER: 'Treasurer',
  SECRETARY: 'Secretary',
  SOCIETY_OFFICER: 'Society Officer',
  BOARD_MEMBER: 'Board Member',
} as const;

export type PositionTitle = typeof POSITION_TITLES[keyof typeof POSITION_TITLES];
