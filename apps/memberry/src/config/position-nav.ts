/**
 * Position-to-nav-section mapping per D-01/D-07.
 * Keys are lowercase position titles. Values are arrays of section labels
 * that position can see. Dashboard (unlabeled) and SETTINGS are always visible
 * to all officers (shared read access per D-01).
 *
 * NOTE: This is UX convenience only. Backend requirePosition() is the real security guard.
 */
export const POSITION_NAV_CONFIG: Record<string, string[]> = {
  'president': ['MEMBERS', 'FINANCES', 'ACTIVITIES', 'COMMUNICATIONS', 'GOVERNANCE', 'FEEDBACK', 'DOCUMENTS', 'SETTINGS'],
  'treasurer': ['FINANCES', 'DOCUMENTS', 'SETTINGS'],
  'secretary': ['MEMBERS', 'COMMUNICATIONS', 'FEEDBACK', 'SETTINGS'],
  'society officer': ['ACTIVITIES', 'FEEDBACK', 'DOCUMENTS', 'SETTINGS'],
}
