import { useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import {
  Alert,
  AppLayout,
  AttendancePhotosDialog,
  Badge,
  Button,
  CameraCapture,
  DayStatusBadge,
  Pagination,
  Spinner,
  TextField,
} from '../../components'
import type { CapturedPhoto } from '../../components'
import { useRequest } from '../../hooks/useRequest'
import { getTodayAttendance, listMyAttendance, recordAttendance } from '../../services/attendance.service'
import type { AttendanceDay } from '../../types/attendance'
import { ACTION_LABEL, NOTES_MAX_LENGTH, TYPE_LABEL, nextAction, readIsoDate } from '../../utils/attendance'
import { cx } from '../../utils/cx'
import { toFormErrors } from '../../utils/form-errors'
import type { FormErrors } from '../../utils/form-errors'
import { formatDate, formatDateRange, formatDuration, formatTimeWib, todayWib } from '../../utils/format'

const PAGE_SIZE = 10
const FIELDS = ['notes'] as const
type Field = (typeof FIELDS)[number]

function readPage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

/** One line of today's summary: "Check-in · 08:05 WIB". */
function TimeLine({ label, iso }: { label: string; iso: string | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold">{iso ? `${formatTimeWib(iso)} WIB` : '—'}</dd>
    </div>
  )
}

interface CheckFormProps {
  day: AttendanceDay
  /** Called after a successful check-in / check-out with a message to show. */
  onRecorded: (message: string) => void
  /** Called when the server refused, so "today" is reloaded (it may have changed in another tab). */
  onRefused: () => void
}

/** Camera + notes + submit, for whichever action comes next today. */
function CheckForm({ day, onRecorded, onRefused }: CheckFormProps) {
  const action = nextAction(day)
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors<Field>>({ fields: {}, form: null })

  if (!action) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
        <p className="font-semibold">You're done for today</p>
        <p className="text-sm text-ink-muted">See you tomorrow. Your photos are in the history below.</p>
      </div>
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!photo || !action) return
    setSubmitting(true)
    setErrors({ fields: {}, form: null })
    try {
      const record = await recordAttendance(action, { photo: photo.blob, fileName: photo.fileName, notes })
      onRecorded(`${TYPE_LABEL[record.type]} recorded at ${formatTimeWib(record.recorded_at)} WIB.`)
    } catch (error: unknown) {
      setErrors(toFormErrors(error, FIELDS))
      setSubmitting(false)
      onRefused()
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)} noValidate>
      <h3 className="text-base">{action === 'CHECK_IN' ? 'Start your day' : 'Finish your day'}</h3>
      {errors.form && (
        <Alert tone="error" title={`Couldn't ${ACTION_LABEL[action].toLowerCase()}`}>
          {errors.form}
        </Alert>
      )}
      <CameraCapture onChange={setPhoto} disabled={submitting} />
      <TextField
        label="Notes (optional)"
        placeholder={action === 'CHECK_IN' ? 'e.g. Working on the sprint tasks' : 'e.g. Finished the report'}
        value={notes}
        maxLength={NOTES_MAX_LENGTH}
        onChange={(event) => setNotes(event.target.value)}
        error={errors.fields.notes}
        disabled={submitting}
        hint={`${notes.length}/${NOTES_MAX_LENGTH}`}
      />
      <Button type="submit" loading={submitting} disabled={!photo} fullWidth>
        {ACTION_LABEL[action]}
      </Button>
      {!photo && <p className="-mt-2 text-center text-[0.8125rem] text-ink-muted">Take a photo first.</p>}
    </form>
  )
}

/** Every logged-in user: check in / check out with a photo, then the own history. */
export function AttendancePage() {
  const [params, setParams] = useSearchParams()
  const page = readPage(params.get('page'))
  const dateFrom = readIsoDate(params.get('date_from'))
  const dateTo = readIsoDate(params.get('date_to'))
  const hasFilters = Boolean(dateFrom || dateTo)
  const today = todayWib()

  const [notice, setNotice] = useState<string | null>(null)
  // A new key remounts the form: camera off, photo and notes cleared.
  const [formKey, setFormKey] = useState(0)
  const [openDay, setOpenDay] = useState<AttendanceDay | null>(null)

  const todayDay = useRequest('attendance-today', getTodayAttendance)
  const query = { page, limit: PAGE_SIZE, date_from: dateFrom, date_to: dateTo }
  const history = useRequest(`my-attendance:${JSON.stringify(query)}`, () => listMyAttendance(query))

  function setFilters(changes: Record<string, string>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [name, value] of Object.entries(changes)) {
          if (value) next.set(name, value)
          else next.delete(name)
        }
        if (!('page' in changes)) next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  function onRecorded(message: string) {
    setNotice(message)
    setFormKey((key) => key + 1)
    todayDay.reload()
    history.reload()
  }

  const day = todayDay.data
  const list = history.data

  return (
    <AppLayout
      title="Attendance"
      description="Check in when you start working from home and check out when you finish. Times are in WIB (Jakarta)."
    >
      {notice && <Alert tone="success">{notice}</Alert>}

      <section aria-labelledby="today-title" className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="today-title" className="text-lg">
            Today{day && <span className="font-normal text-ink-muted"> · {formatDate(day.attendance_date)}</span>}
          </h2>
          {day?.check_in && <DayStatusBadge day={day} today={day.attendance_date} />}
          {day && !day.check_in && <Badge>Not checked in</Badge>}
        </div>

        {todayDay.error && (
          <Alert tone="error" title="Couldn't load today's attendance">
            <p>{todayDay.error.message}</p>
            <Button variant="secondary" className="mt-3" onClick={todayDay.reload}>
              Try again
            </Button>
          </Alert>
        )}
        {!day && todayDay.loading && (
          <div className="flex justify-center py-12">
            <Spinner label="Loading today's attendance" />
          </div>
        )}
        {day && (
          <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
            <div className="flex flex-col gap-4">
              <dl className="text-sm">
                <TimeLine label={TYPE_LABEL.CHECK_IN} iso={day.check_in?.recorded_at} />
                <TimeLine label={TYPE_LABEL.CHECK_OUT} iso={day.check_out?.recorded_at} />
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-ink-muted">Work time</dt>
                  <dd className="font-semibold">{day.work_minutes !== null ? formatDuration(day.work_minutes) : '—'}</dd>
                </div>
              </dl>
              {day.check_in && (
                <Button variant="secondary" onClick={() => setOpenDay(day)}>
                  View today's photos
                </Button>
              )}
            </div>
            <CheckForm key={formKey} day={day} onRecorded={onRecorded} onRefused={todayDay.reload} />
          </div>
        )}
      </section>

      <section aria-labelledby="history-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="history-title" className="text-lg">
              My attendance
            </h2>
            <p className="text-sm text-ink-muted">{formatDateRange(dateFrom || null, dateTo || null)}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              label="From"
              type="date"
              value={dateFrom}
              max={dateTo || today}
              onChange={(event) => setFilters({ date_from: event.target.value })}
            />
            <TextField
              label="To"
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              max={today}
              onChange={(event) => setFilters({ date_to: event.target.value })}
            />
            {hasFilters && (
              <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>
                All dates
              </Button>
            )}
          </div>
        </div>

        {history.error && (
          <Alert tone="error" title="Couldn't load your attendance">
            <p>{history.error.message}</p>
            <Button variant="secondary" className="mt-3" onClick={history.reload}>
              Try again
            </Button>
          </Alert>
        )}
        {!list && history.loading && (
          <div className="flex justify-center py-12">
            <Spinner label="Loading your attendance" />
          </div>
        )}
        {list && list.items.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-12 text-center">
            <p className="font-semibold">{hasFilters ? 'No attendance in these dates' : 'No attendance yet'}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {hasFilters ? 'Try other dates.' : 'Your check-ins will show up here.'}
            </p>
          </div>
        )}
        {list && list.items.length > 0 && (
          <>
            <div
              className={cx('overflow-x-auto rounded-xl border border-line bg-surface transition-opacity', history.loading && 'opacity-60')}
              aria-busy={history.loading}
            >
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead className="border-b border-line bg-surface-muted text-xs tracking-wide text-ink-muted uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Check-in</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Check-out</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Work time</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Photos</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((item) => (
                    <tr key={item.attendance_date} className="border-b border-line last:border-b-0 hover:bg-surface-muted">
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatDate(item.attendance_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{item.check_in ? formatTimeWib(item.check_in.recorded_at) : '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{item.check_out ? formatTimeWib(item.check_out.recorded_at) : '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{item.work_minutes !== null ? formatDuration(item.work_minutes) : '—'}</td>
                      <td className="px-4 py-3">
                        <DayStatusBadge day={item} today={today} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" onClick={() => setOpenDay(item)}>
                          View photos
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={list.meta.page}
              totalPages={list.meta.total_pages}
              total={list.meta.total}
              disabled={history.loading}
              onPageChange={(next) => setFilters({ page: String(next) })}
            />
          </>
        )}
      </section>

      <AttendancePhotosDialog day={openDay} onClose={() => setOpenDay(null)} />
    </AppLayout>
  )
}
