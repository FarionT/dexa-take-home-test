import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Alert, AppLayout, Badge, Button, Pagination, SelectField, Spinner, TextField, buttonClasses } from '../../components'
import { useRequest } from '../../hooks/useRequest'
import { listDepartments, listEmployees } from '../../services/employee.service'
import type { Employee, EmployeeStatus } from '../../types/employee'
import { cx } from '../../utils/cx'
import { formatDateTime } from '../../utils/format'
import { ROLE_LABEL, STATUS_LABEL } from '../../utils/labels'
import { flashMessage } from '../../utils/location-state'

const PAGE_SIZE = 10
const SEARCH_DELAY_MS = 300

function readPage(value: string | null): number {
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function readStatus(value: string | null): EmployeeStatus | '' {
  return value === 'ACTIVE' || value === 'INACTIVE' ? value : ''
}

/** The login column: what HR most likely needs to know about the account. */
function LoginState({ employee }: { employee: Employee }) {
  const account = employee.account
  if (!account) return <Badge tone="danger">No login</Badge>
  if (!account.is_active) return <Badge tone="danger">Blocked</Badge>
  if (account.must_change_password) return <Badge tone="warning">Temporary password</Badge>
  return <span className="text-ink-muted">{account.last_login_at ? formatDateTime(account.last_login_at) : 'Never'}</span>
}

/** HR: all employees, with search, filters and pages. Filters live in the URL (shareable, back button works). */
export function EmployeesPage() {
  const location = useLocation()
  const flash = flashMessage(location.state)
  const [params, setParams] = useSearchParams()
  const page = readPage(params.get('page'))
  const search = params.get('search') ?? ''
  const departmentId = params.get('department_id') ?? ''
  const status = readStatus(params.get('status'))
  const hasFilters = Boolean(search || departmentId || status)

  const [searchInput, setSearchInput] = useState(search)
  const searchTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(searchTimer.current), [])

  const departments = useRequest('departments', listDepartments)
  const query = { page, limit: PAGE_SIZE, search, department_id: departmentId, status: status || undefined }
  const employees = useRequest(`employees:${JSON.stringify(query)}`, () => listEmployees(query))

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
    // Search once typing pauses, not on every key.
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => setFilters({ search: value.trim() }), SEARCH_DELAY_MS)
  }

  function clearFilters() {
    window.clearTimeout(searchTimer.current)
    setSearchInput('')
    setParams({}, { replace: true })
  }

  const list = employees.data

  return (
    <AppLayout
      title="Employees"
      description="Everyone's HR data and login, in one place."
      actions={
        <Link to="/employees/new" className={buttonClasses({ variant: 'primary' })}>
          Add employee
        </Link>
      }
    >
      {flash && <Alert tone="success">{flash}</Alert>}

      <div className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[2fr_1fr_1fr] sm:items-end">
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
        <SelectField
          label="Status"
          placeholder="All statuses"
          options={[
            { value: 'ACTIVE', label: STATUS_LABEL.ACTIVE },
            { value: 'INACTIVE', label: STATUS_LABEL.INACTIVE },
          ]}
          value={status}
          onChange={(event) => setFilters({ status: event.target.value })}
        />
      </div>

      {employees.error && (
        <Alert tone="error" title="Couldn't load employees">
          <p>{employees.error.message}</p>
          <Button variant="secondary" className="mt-3" onClick={employees.reload}>
            Try again
          </Button>
        </Alert>
      )}

      {!list && employees.loading && (
        <div className="flex justify-center py-16">
          <Spinner label="Loading employees" />
        </div>
      )}

      {list && list.items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="font-semibold text-ink">{hasFilters ? 'No employees match these filters' : 'No employees yet'}</p>
          {hasFilters ? (
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : (
            <Link to="/employees/new" className={buttonClasses({ variant: 'secondary' })}>
              Add the first employee
            </Link>
          )}
        </div>
      )}

      {list && list.items.length > 0 && (
        <>
          <div
            className={cx('overflow-x-auto rounded-xl border border-line bg-surface transition-opacity', employees.loading && 'opacity-60')}
            aria-busy={employees.loading}
          >
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-xs tracking-wide text-ink-muted uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Code</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Department</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Position</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Role</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Last login</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((employee) => (
                  <tr key={employee.id} className="border-b border-line last:border-b-0 hover:bg-surface-muted">
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-ink-muted">{employee.employee_code}</td>
                    <td className="px-4 py-3">
                      <Link to={`/employees/${employee.id}`} className="font-semibold">
                        {employee.full_name}
                      </Link>
                      <div className="text-xs text-ink-muted">{employee.email}</div>
                    </td>
                    <td className="px-4 py-3">{employee.department.name}</td>
                    <td className="px-4 py-3">{employee.position}</td>
                    <td className="px-4 py-3">
                      <Badge tone={employee.status === 'ACTIVE' ? 'success' : 'neutral'}>{STATUS_LABEL[employee.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {employee.account && (
                        <Badge tone={employee.account.role === 'ADMIN' ? 'primary' : 'neutral'}>
                          {ROLE_LABEL[employee.account.role]}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <LoginState employee={employee} />
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
            disabled={employees.loading}
            onPageChange={(next) => setFilters({ page: String(next) })}
          />
        </>
      )}
    </AppLayout>
  )
}
