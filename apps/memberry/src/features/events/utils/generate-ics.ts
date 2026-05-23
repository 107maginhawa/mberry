/**
 * Generate an .ics calendar file and trigger download.
 * Client-side only — no server dependency.
 */

interface IcsEventParams {
  title: string
  description?: string
  location?: string
  startDate: string | Date
  endDate: string | Date
  url?: string
}

function formatIcsDate(date: string | Date): string {
  const d = new Date(date)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function generateIcsFile(event: IcsEventParams): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Memberry//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${formatIcsDate(event.startDate)}`,
    `DTEND:${formatIcsDate(event.endDate)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcs(event.description)}`)
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcs(event.location)}`)
  }
  if (event.url) {
    lines.push(`URL:${event.url}`)
  }

  lines.push(
    `UID:${crypto.randomUUID()}@memberry.app`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    'END:VEVENT',
    'END:VCALENDAR',
  )

  return lines.join('\r\n')
}

export function downloadIcsFile(event: IcsEventParams) {
  const ics = generateIcsFile(event)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
