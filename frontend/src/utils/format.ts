/**
 * Every date and time in the app is shown in the office time zone (WIB, Jakarta),
 * the same zone the backend counts working days in, and labelled so it can't be
 * mistaken for the viewer's local time.
 */
export const APP_TIME_ZONE = 'Asia/Jakarta'
export const APP_TIME_ZONE_LABEL = 'WIB'

const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: APP_TIME_ZONE })
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: APP_TIME_ZONE })
// en-CA formats dates as YYYY-MM-DD.
const isoDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

/** "2026-11-10" → "10 Nov 2026". A date-only value is a calendar day, not a moment, so it has no time zone. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  return dateFormat.format(new Date(year, month - 1, day))
}

/** "2026-11-06T07:40:10.000Z" → "6 Nov 2026, 14:40 WIB". */
export function formatDateTime(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  return Number.isNaN(date.getTime()) ? isoDateTime : `${dateTimeFormat.format(date)} ${APP_TIME_ZONE_LABEL}`
}

/** "2026-11-06T01:05:00.000Z" → "08:05 WIB". */
export function formatTimeWib(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  return Number.isNaN(date.getTime()) ? isoDateTime : `${timeFormat.format(date)} ${APP_TIME_ZONE_LABEL}`
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

/** Today as YYYY-MM-DD in WIB: the working day the backend counts in, and the default for date inputs. */
export function todayWib(): string {
  return isoDateFormat.format(new Date())
}

/** The date range a list shows: "6 Nov 2026", "1 Nov 2026 – 6 Nov 2026", "From 1 Nov 2026", … */
export function formatDateRange(from: string | null, to: string | null): string {
  if (from && to) return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`
  if (from) return `From ${formatDate(from)}`
  if (to) return `Until ${formatDate(to)}`
  return 'All dates'
}
