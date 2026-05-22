import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Button,
  Calendar,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@monobase/ui'
import type { DateRange } from 'react-day-picker'

// --- DatePicker (single date) ---

interface DatePickerProps {
  value: Date | undefined
  onValueChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onValueChange,
  placeholder = 'Pick a date',
  disabled = false,
  className,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'PPP') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onValueChange}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

// --- DateTimePicker (date + time) ---

interface DateTimePickerProps {
  value: string | undefined
  onValueChange: (iso: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DateTimePicker({
  value,
  onValueChange,
  placeholder = 'Pick date and time',
  disabled = false,
  className,
}: DateTimePickerProps) {
  const dateValue = value ? new Date(value) : undefined
  const timeValue = dateValue
    ? `${String(dateValue.getHours()).padStart(2, '0')}:${String(dateValue.getMinutes()).padStart(2, '0')}`
    : ''

  function handleDateSelect(date: Date | undefined) {
    if (!date) return
    const hours = dateValue?.getHours() ?? 0
    const minutes = dateValue?.getMinutes() ?? 0
    date.setHours(hours, minutes, 0, 0)
    onValueChange(date.toISOString())
  }

  function handleTimeChange(time: string) {
    const parts = time.split(':').map(Number)
    const date = dateValue ? new Date(dateValue) : new Date()
    date.setHours(parts[0] ?? 0, parts[1] ?? 0, 0, 0)
    onValueChange(date.toISOString())
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateValue ? `${format(dateValue, 'PPP')} at ${timeValue}` : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleDateSelect}
          autoFocus
        />
        <div className="border-t px-3 py-2">
          <Input
            type="time"
            value={timeValue}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="w-auto"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

// --- DateRangePicker ---

interface DateRangePickerProps {
  value: DateRange | undefined
  onValueChange: (range: DateRange | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DateRangePicker({
  value,
  onValueChange,
  placeholder = 'Pick a date range',
  disabled = false,
  className,
}: DateRangePickerProps) {
  const label = value?.from
    ? value.to
      ? `${format(value.from, 'LLL dd, y')} – ${format(value.to, 'LLL dd, y')}`
      : format(value.from, 'LLL dd, y')
    : placeholder

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value?.from && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onValueChange}
          numberOfMonths={2}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
