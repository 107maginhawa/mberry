// apps/org/src/features/roster-import/csv.test.ts
import { describe, it, expect } from 'vitest'
import { parseCsv, mapRows, summarizeRows } from './csv'

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('name,note\n"Dela Cruz, Jr.","said ""hi"""')).toEqual([
      ['name', 'note'],
      ['Dela Cruz, Jr.', 'said "hi"'],
    ])
  })
  it('handles newlines inside quotes and CRLF line endings', () => {
    expect(parseCsv('a,b\r\n"line1\nline2",x')).toEqual([['a', 'b'], ['line1\nline2', 'x']])
  })
  it('keeps a trailing field with no terminating newline', () => {
    expect(parseCsv('a,b')).toEqual([['a', 'b']])
  })
  it('ignores a trailing newline', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']])
  })
  it('strips a leading UTF-8 BOM', () => {
    expect(parseCsv('﻿email\na@x.ph')).toEqual([['email'], ['a@x.ph']])
  })
})

describe('mapRows', () => {
  it('auto-maps known headers (case/space-insensitive) and trims cells', () => {
    const grid = [
      ['First Name', 'Last Name', 'Email', 'PRC Number', 'Member No'],
      [' Olive ', 'Reyes', 'olive@x.ph', 'PRC-1', 'M-1'],
    ]
    expect(mapRows(grid)).toEqual({
      rows: [{ firstName: 'Olive', lastName: 'Reyes', email: 'olive@x.ph', licenseNumber: 'PRC-1', memberNumber: 'M-1' }],
    })
  })
  it('errors when neither email nor licenseNumber column is present', () => {
    expect(mapRows([['first name', 'last name'], ['A', 'B']]).headerError).toMatch(/email or licenseNumber/i)
  })
  it('accepts a licenseNumber-only header set', () => {
    expect(mapRows([['license'], ['PRC-9']])).toEqual({ rows: [{ licenseNumber: 'PRC-9' }] })
  })
  it('drops fully-empty rows and omits empty optional fields', () => {
    expect(mapRows([['email'], ['a@x.ph'], ['']])).toEqual({ rows: [{ email: 'a@x.ph' }] })
  })
  it('returns empty rows for a header-only file', () => {
    expect(mapRows([['email']])).toEqual({ rows: [] })
  })
})

describe('summarizeRows', () => {
  it('counts rows missing an identifier and missing a name', () => {
    expect(
      summarizeRows([
        { email: 'a@x.ph', firstName: 'A' }, // ok
        { firstName: 'NoId' },               // has name, no email/license → missingIdentifier
        { email: 'c@x.ph' },                 // has id, no firstName → missingName
      ]),
    ).toEqual({ total: 3, missingIdentifier: 1, missingName: 1 })
  })
})
