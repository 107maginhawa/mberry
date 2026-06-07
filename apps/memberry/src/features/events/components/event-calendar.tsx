import { useState, useMemo } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@monobase/ui'
import { cn } from '@/lib/utils'

interface CalendarEvent {
  id: string
  title: string
  status: string
  startDate: string | Date
  endDate: string | Date
  eventType?: string | null
}

interface EventCalendarProps {
  events: CalendarEvent[]
  linkBase?: string
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  general_assembly: 'bg-blue-500',
  induction_ceremony: 'bg-purple-500',
  fellowship: 'bg-emerald-500',
  medical_mission: 'bg-rose-500',
  board_meeting: 'bg-amber-500',
  committee_meeting: 'bg-orange-500',
  fundraiser: 'bg-teal-500',
  other: 'bg-gray-500',
}

const STATUS_TO_OPACITY: Record<string, string> = {
  draft: 'opacity-50',
  cancelled: 'opacity-30 line-through',
  published: '',
  completed: '',
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

function isToday(date: Date) {
  return isSameDay(date, new Date())
}

export function EventCalendar({ events, linkBase }: EventCalendarProps) {
  const { orgSlug } = useParams({ strict: false }) as { orgSlug: string }
  const base = linkBase ?? `/org/${orgSlug}/officer/events`
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfWeek = getFirstDayOfWeek(year, month)

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const d = new Date(event.startDate)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate().toString()
        const arr = map.get(key) ?? []
        arr.push(event)
        map.set(key, arr)
      }
    }
    return map
  }, [events, year, month])

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return []
    return events.filter(e => isSameDay(new Date(e.startDate), selectedDay))
  }, [events, selectedDay])

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDay(null)
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDay(null)
  }

  function goToday() {
    setCurrentDate(new Date())
    setSelectedDay(new Date())
  }

  const monthLabel = currentDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

  // Build calendar grid cells
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-h4 min-w-[180px] text-center">{monthLabel}</h3>
          <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Next month">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={goToday}>
          Today
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-[var(--color-muted)] py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px bg-[var(--color-border)] rounded-lg overflow-hidden border border-[var(--color-border)]">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="bg-[var(--color-surface)] min-h-[80px] lg:min-h-[100px]" />
          }

          const cellDate = new Date(year, month, day)
          const dayEvents = eventsByDay.get(day.toString()) ?? []
          const isSelected = selectedDay ? isSameDay(cellDate, selectedDay) : false
          const todayCell = isToday(cellDate)

          return (
            <Button
              key={day}
              variant="ghost"
              onClick={() => setSelectedDay(cellDate)}
              className={cn(
                // Strip Button's center-aligned pill defaults — calendar cells
                // are top-left-aligned multi-line tiles with a custom min-height.
                'h-auto min-h-[80px] lg:min-h-[100px] w-full p-1.5 rounded-none gap-0',
                'flex flex-col items-start justify-start whitespace-normal text-left',
                'bg-[var(--color-surface)] hover:bg-[var(--color-surface-warm)]',
                isSelected && 'ring-2 ring-inset ring-[var(--color-primary)]',
              )}
            >
              <span className={cn(
                'inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full',
                todayCell && 'bg-[var(--color-primary)] text-white',
              )}>
                {day}
              </span>
              <div className="mt-1 space-y-0.5 w-full">
                {dayEvents.slice(0, 3).map(ev => (
                  <div
                    key={ev.id}
                    className={cn(
                      'text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white',
                      EVENT_TYPE_COLORS[ev.eventType ?? 'other'] ?? EVENT_TYPE_COLORS.other,
                      STATUS_TO_OPACITY[ev.status] ?? '',
                    )}
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-[var(--color-muted)] px-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </Button>
          )
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium">
            {selectedDay.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h4>
          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No events on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedDayEvents.map(ev => {
                const start = new Date(ev.startDate)
                const time = start.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
                return (
                  <Link
                    key={ev.id}
                    to={`${base}/${ev.id}` as any}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-[var(--color-surface-warm)] transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${EVENT_TYPE_COLORS[ev.eventType ?? 'other'] ?? EVENT_TYPE_COLORS.other}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{ev.title}</div>
                      <div className="text-xs text-[var(--color-muted)]">{time} · {ev.status}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
