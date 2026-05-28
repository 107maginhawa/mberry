/**
 * Input sanitization utilities for security-sensitive operations.
 *
 * EF-M10-005: SQL wildcard escaping
 * EF-M14-004: CSV formula injection prevention
 * EF-M11-004: SVG upload blocking
 */

/**
 * Escape SQL LIKE/ILIKE wildcard characters (%, _, \) in user input
 * to prevent wildcard injection attacks.
 *
 * A search for "%" without escaping would match every row.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

/**
 * Escape a value for CSV output to prevent formula injection (CSV injection / DDE).
 *
 * Values starting with =, +, -, @, \t, or \r are treated as formulas by
 * Excel and Google Sheets. We prefix with a single-quote that Excel strips
 * on display but neutralizes formula interpretation.
 */
export function escapeCsvValue(val: unknown): string {
  const str = String(val ?? '');
  // Escape formula injection characters
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  // Standard CSV quoting for commas, quotes, newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** MIME types that are blocked from document uploads (XSS vectors). */
const BLOCKED_DOCUMENT_MIME_TYPES = new Set([
  'image/svg+xml',
]);

/** File extensions blocked from document uploads. */
const BLOCKED_DOCUMENT_EXTENSIONS = new Set([
  '.svg',
  '.svgz',
]);

/**
 * Check whether a file should be blocked from document upload.
 * SVG files can contain <script>, event handlers, and other XSS vectors
 * and must not be uploaded without content sanitization (which requires
 * reading the file body — not available in metadata-only upload flows).
 */
export function isBlockedDocumentFile(fileName: string, mimeType?: string): boolean {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (BLOCKED_DOCUMENT_EXTENSIONS.has(ext)) return true;
  if (mimeType && BLOCKED_DOCUMENT_MIME_TYPES.has(mimeType)) return true;
  return false;
}
