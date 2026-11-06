import type { Attendance, AttendanceDay } from '../../types/attendance'
import { TYPE_LABEL } from '../../utils/attendance'
import { formatDate, formatDuration, formatTimeWib } from '../../utils/format'
import { AttendancePhoto } from '../AttendancePhoto'
import { Button } from '../Button'
import { Dialog } from '../Dialog'

interface AttendancePhotosDialogProps {
  /** The day to show; null closes the dialog. */
  day: AttendanceDay | null
  /** Whose day it is, e.g. "Budi Santoso (EMP-0002)". Left out on the employee's own page. */
  who?: string
  onClose: () => void
}

function EventPhoto({ event, label }: { event: Attendance | null; label: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-ink">{label}</span>
        <span>{event ? `${formatTimeWib(event.recorded_at)} WIB` : 'Not yet'}</span>
      </figcaption>
      {event ? (
        <AttendancePhoto url={event.photo.url} alt={`${label} photo, ${formatTimeWib(event.recorded_at)} WIB`} />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed border-line-strong">
          No {label.toLowerCase()} yet
        </div>
      )}
      {event?.notes && <p className="break-words">“{event.notes}”</p>}
    </figure>
  )
}

/** The check-in and check-out photos of one day, side by side. Photos load only when opened. */
export function AttendancePhotosDialog({ day, who, onClose }: AttendancePhotosDialogProps) {
  const title = day ? [who, formatDate(day.attendance_date)].filter(Boolean).join(' · ') : ''
  return (
    <Dialog
      open={day !== null}
      title={title}
      onClose={onClose}
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {day && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <EventPhoto event={day.check_in} label={TYPE_LABEL.CHECK_IN} />
            <EventPhoto event={day.check_out} label={TYPE_LABEL.CHECK_OUT} />
          </div>
          {day.work_minutes !== null && (
            <p>
              Worked <strong className="text-ink">{formatDuration(day.work_minutes)}</strong>
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}
