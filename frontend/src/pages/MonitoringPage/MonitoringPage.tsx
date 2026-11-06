import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  Alert,
  AppLayout,
  AttendancePhotosDialog,
  Badge,
  Button,
  DayStatusBadge,
  Pagination,
  SelectField,
  Spinner,
  TextField,
} from '../../components'
import { useRequest } from '../../hooks/useRequest'
import { listAttendance } from '../../services/attendance.service'
import { listDepartments } from '../../services/employee.service'
import type { MonitoringDay } from '../../types/attendance'
import { readIsoDate } from '../../utils/attendance'
import { cx } from '../../utils/cx'
import { formatDate, formatDateRange, formatDuration, formatTimeWib, todayWib } from '../../utils/format'

const PAGE_SIZE = 20
const SEARCH_DELAY_MS = 300

function readPage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function EmployeeCell({ day }: { day: MonitoringDay }) {
  const employee = day.employee
  if (!employee) return <span className="text-ink-muted">Unknown employee</span>
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {employee.is_deleted ? (
          <span className="font-semibold">{employee.full_name}</span>
        ) : (
          <Link to={`/employees/${employee.id}`} className="font-semibold">
            {employee.full_name}
          </Link>
        )}
        {employee.is_deleted && <Badge tone="danger">Deleted</Badge>}
        {!employee.is_deleted && employee.status === 'INACTIVE' && <Badge>Inactive</Badge>}
      </div>
      <span className="font-mono text-xs text-ink-muted">{employee.employee_code}</span>
    </div>
  )
}

/**
 * HR: everyone's attendance, read only. Today by default; filters live in the
 * URL. Only employees who checked in are listed (no "absent" rows).
 */
export function MonitoringPage() {
  const [params, setParams] = useSearchParams()
  const page = readPage(params.get('page'))
  const dateFrom = readIsoDate(params.get('date_from'))
  const dateTo = readIsoDate(params.get('date_to'))
  const departmentId = params.get('department_id') ?? ''
  const search = params.get('search') ?? ''
  const hasEmployeeFilters = Boolean(departmentId || search)
  const hasDates = Boolean(dateFrom || dateTo)
  const today = todayWib()

  const [searchInput, setSearchInput] = useState(search)
  const searchTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(searchTimer.current), [])
  const [openDay, setOpenDay] = useState<MonitoringDay | null>(null)

  const departments = useRequest('departments', listDepartments)
  const query = { page, limit: PAGE_SIZE, date_from: dateFrom, date_to: dateTo, department_id: departmentId, search }
  const attendance = useRequest(`attendance:${JSON.stringify(query)}`, () => listAttendance(query))

  /** Changes filters in the URL. Any filter change goes back to page 1. */
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

  function onSearchInput(value: string) {
    setSearchInput(value)
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => setFilters({ search: value.trim() }), SEARCH_DELAY_MS)
  }

  function clearFilters() {
    window.clearTimeout(searchTimer.current)
    setSearchInput('')
    setParams({}, { replace: true })
  }

  const list = attendance.data
  // The range the backend used (today when no date was sent).
  const shownRange = list ? formatDateRange(list.meta.date_from, list.meta.date_to) : null
  const showsToday = list?.meta.date_from === today && list.meta.date_to === today

  return (
    <AppLayout
      title="Attendance monitoring"
      description="Everyone's check-ins and check-outs with their photos. Read only; times are in WIB (Jakarta)."
    >
      <div className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1fr_1fr] lg:items-end">
        <TextField
          label="Search"
          type="search"
          placeholder="Name, employee code or email"
          value={searchInput}
          onChange={(event) => onSearchInput(event.target.value)}
        />
        <SelectField
          label="Department"
          placeholder="All departments"
          options={(departments.data ?? []).map((department) => ({ value: department.id, label: department.name }))}
          value={departmentId}
          onChange={(event) => setFilters({ department_id: event.target.value })}
        />
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
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {shownRange && (
            <>
              Showing <strong className="text-ink">{showsToday ? `today, ${shownRange}` : shownRange}</strong>
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {hasDates && (
            <Button variant="secondary" onClick={() => setFilters({ date_from: '', date_to: '' })}>
              Back to today
            </Button>
          )}
          {(hasDates || hasEmployeeFilters) && (
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {attendance.error && (
        <Alert tone="error" title="Couldn't load attendance">
          <p>{attendance.error.message}</p>
          <Button variant="secondary" className="mt-3" onClick={attendance.reload}>
            Try again
          </Button>
        </Alert>
      )}

      {!list && attendance.loading && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading attendance" />
        </div>
      )}

      {list && list.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="font-semibold">
            {hasEmployeeFilters ? 'No attendance matches these filters' : showsToday ? 'Nobody has checked in yet today' : 'No attendance in these dates'}
          </p>
          <p className="text-sm text-ink-muted">Only employees who checked in are listed.</p>
          {hasEmployeeFilters && (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}

      {list && list.items.length > 0 && (
        <>
          <div
            className={cx('overflow-x-auto rounded-xl border border-line bg-surface transition-opacity', attendance.loading && 'opacity-60')}
            aria-busy={attendance.loading}
          >
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-xs tracking-wide text-ink-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Employee</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Department</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Check-in</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Check-out</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Work time</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Photos</span></th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((day) => (
                  <tr key={`${day.employee_id}:${day.attendance_date}`} className="border-b border-line last:border-b-0 hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <EmployeeCell day={day} />
                    </td>
                    <td className="px-4 py-3">{day.employee?.department.name ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(day.attendance_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{day.check_in ? formatTimeWib(day.check_in.recorded_at) : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{day.check_out ? formatTimeWib(day.check_out.recorded_at) : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{day.work_minutes !== null ? formatDuration(day.work_minutes) : '—'}</td>
                    <td className="px-4 py-3">
                      <DayStatusBadge day={day} today={today} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" onClick={() => setOpenDay(day)}>
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
            disabled={attendance.loading}
            onPageChange={(next) => setFilters({ page: String(next) })}
          />
        </>
      )}

      <AttendancePhotosDialog
        day={openDay}
        who={openDay?.employee ? `${openDay.employee.full_name} (${openDay.employee.employee_code})` : undefined}
        onClose={() => setOpenDay(null)}
      />
    </AppLayout>
  )
}
