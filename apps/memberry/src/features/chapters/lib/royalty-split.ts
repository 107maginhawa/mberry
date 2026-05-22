/**
 * Royalty split validation and display utilities.
 * National + chapter percentages must equal 100%.
 */

export function validateSplit(national: number, chapter: number): { valid: boolean; sum: number } {
  if (national < 0 || chapter < 0) return { valid: false, sum: national + chapter };
  const sum = national + chapter;
  return { valid: sum === 100, sum };
}

export function formatSplitDisplay(national: number, chapter: number): string {
  const fmtNat = Number.isInteger(national) ? national.toString() : national.toString();
  const fmtCh = Number.isInteger(chapter) ? chapter.toString() : chapter.toString();
  return `National ${fmtNat}% / Chapter ${fmtCh}%`;
}
