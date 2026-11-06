import type { AttendanceDay } from '../../types/attendance'
import { DAY_STATUS_LABEL, dayStatus } from '../../utils/attendance'
import type { DayStatus } from '../../utils/attendance'
import { Badge } from '../Badge'
import type { BadgeTone } from '../Badge'

const TONE: Record<DayStatus, BadgeTone> = { complete: 'success', working: 'primary', 'no-check-out': 'warning' }

/** Complete / Working (today, not checked out yet) / No check-out (an earlier day). */
export function DayStatusBadge({ day, today }: { day: AttendanceDay; today: string }) {
  const status = dayStatus(day, today)
  return <Badge tone={TONE[status]}>{DAY_STATUS_LABEL[status]}</Badge>
}
