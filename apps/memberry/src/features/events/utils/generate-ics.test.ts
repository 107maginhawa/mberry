import { describe, test, expect } from 'vitest'
import { generateIcsFile } from './generate-ics'

describe('generateIcsFile', () => {
  test('generates valid VCALENDAR with required fields', () => {
    const ics = generateIcsFile({
      title: 'CPD Seminar 2026',
      startDate: '2026-06-15T09:00:00Z',
      endDate: '2026-06-15T17:00:00Z',
    })

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('SUMMARY:CPD Seminar 2026')
    expect(ics).toContain('DTSTART:20260615T090000Z')
    expect(ics).toContain('DTEND:20260615T170000Z')
    expect(ics).toContain('PRODID:-//Memberry//Events//EN')
  })

  test('includes optional description and location', () => {
    const ics = generateIcsFile({
      title: 'Test Event',
      description: 'A dental workshop',
      location: 'Manila Hotel Ballroom',
      startDate: '2026-07-01T08:00:00Z',
      endDate: '2026-07-01T12:00:00Z',
    })

    expect(ics).toContain('DESCRIPTION:A dental workshop')
    expect(ics).toContain('LOCATION:Manila Hotel Ballroom')
  })

  test('escapes special characters', () => {
    const ics = generateIcsFile({
      title: 'Event; with, special\\chars',
      startDate: '2026-07-01T08:00:00Z',
      endDate: '2026-07-01T12:00:00Z',
    })

    expect(ics).toContain('SUMMARY:Event\\; with\\, special\\\\chars')
  })

  test('omits description/location when not provided', () => {
    const ics = generateIcsFile({
      title: 'Simple Event',
      startDate: '2026-07-01T08:00:00Z',
      endDate: '2026-07-01T12:00:00Z',
    })

    expect(ics).not.toContain('DESCRIPTION:')
    expect(ics).not.toContain('LOCATION:')
  })
})
