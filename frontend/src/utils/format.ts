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
