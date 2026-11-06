const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

/** "2026-11-10" → "10 Nov 2026". A date-only value is read as a calendar day, not a UTC instant. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  return dateFormat.format(new Date(year, month - 1, day))
}

/** "2026-11-06T07:40:10.000Z" → "6 Nov 2026, 14:40" in the user's time zone. */
export function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  return Number.isNaN(date.getTime()) ? isoDateTime : dateTimeFormat.format(date)
}

/** Today as YYYY-MM-DD in the user's time zone (default for date inputs). */
export function todayIsoDate(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Attendance days and times follow the office time zone (WIB), like the backend. */
export const ATTENDANCE_TIME_ZONE = 'Asia/Jakarta'
const wibTimeFormat = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: ATTENDANCE_TIME_ZONE })

/** "2026-11-06T01:05:00.000Z" → "08:05" (WIB). */
export function formatTimeWib(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  return Number.isNaN(date.getTime()) ? isoDateTime : wibTimeFormat.format(date)
}

/** 545 → "9h 05m". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${rest}m`
}

/** 183245 → "179 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const wibDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ATTENDANCE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

/** Today's working day as YYYY-MM-DD in WIB, the same day the backend counts in. */
export function todayWib(): string {
  return wibDateFormat.format(new Date())
}

/** The date range a list shows: "6 Nov 2026", "1 Nov 2026 – 6 Nov 2026", "From 1 Nov 2026", … */
export function formatDateRange(from: string | null, to: string | null): string {
  if (from && to) return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`
  if (from) return `From ${formatDate(from)}`
  if (to) return `Until ${formatDate(to)}`
  return 'All dates'
}
