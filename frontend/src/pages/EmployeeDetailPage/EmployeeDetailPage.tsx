import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import {
  Alert,
  AppLayout,
  Badge,
  Button,
  Dialog,
  Spinner,
  TemporaryPasswordNotice,
  TextField,
  buttonClasses,
} from '../../components'
import type { ButtonVariant } from '../../components'
import { useRequest } from '../../hooks/useRequest'
import { deleteEmployee, getEmployee, resetEmployeePassword, updateEmployee } from '../../services/employee.service'
import { ApiError } from '../../services/http'
import type { Employee } from '../../types/employee'
import { formatDate, formatDateTime, todayWib } from '../../utils/format'
import { ROLE_LABEL, STATUS_LABEL } from '../../utils/labels'
import { flashMessage } from '../../utils/location-state'

type AccountAction = 'reset' | 'promote' | 'demote' | 'deactivate' | 'reactivate' | 'delete'

interface ActionCopy {
  title: string
  body: ReactNode
  confirm: string
  variant: ButtonVariant
}

function actionCopy(action: AccountAction, name: string): ActionCopy {
  switch (action) {
    case 'reset':
      return {
        title: `Reset ${name}'s password?`,
        body: "Their current password stops working. You'll get a new temporary password to give them.",
        confirm: 'Reset password',
        variant: 'primary',
      }
    case 'promote':
      return {
        title: `Make ${name} an HR admin?`,
        body: "They'll be able to manage employees and see everyone's attendance, from their next login.",
        confirm: 'Make HR admin',
        variant: 'primary',
      }
    case 'demote':
      return {
        title: `Remove ${name}'s HR admin role?`,
        body: 'They lose access to the HR features at their next login. The last active HR admin cannot be removed.',
        confirm: 'Remove HR admin',
        variant: 'primary',
      }
    case 'deactivate':
      return {
        title: `Deactivate ${name}?`,
        body: "Use this when someone leaves. They can't log in anymore, but stay in the list with their history, and you can reactivate them later.",
        confirm: 'Deactivate',
        variant: 'danger',
      }
    case 'reactivate':
      return {
        title: `Reactivate ${name}?`,
        body: 'For a rehire: same employee code and history. They get a new temporary password; their old password no longer works.',
        confirm: 'Reactivate',
        variant: 'primary',
      }
    case 'delete':
      return {
        title: `Delete ${name}?`,
        body: (
          <>
            Only for records created <strong className="text-ink">by mistake</strong>. If {name} left the company, use{' '}
            <strong className="text-ink">Deactivate</strong> instead. Their record and login disappear from the app;
            attendance history is kept.
          </>
        ),
        confirm: 'Delete employee',
        variant: 'danger',
      }
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  )
}

/** HR: one employee's profile and login account, with the account actions. */
export function EmployeeDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { state } = useAuth()
  const employee = useRequest(`employee:${id}`, () => getEmployee(id))

  const [action, setAction] = useState<AccountAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rehireDate, setRehireDate] = useState(todayWib)
  const [notice, setNotice] = useState<string | null>(() => flashMessage(location.state) ?? null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  function openAction(next: AccountAction) {
    setActionError(null)
    setRehireDate(todayWib())
    setAction(next)
  }

  async function runAction(person: Employee) {
    if (!action) return
    setBusy(true)
    setActionError(null)
    const name = person.full_name
    try {
      let message: string
      let password: string | null = null
      switch (action) {
        case 'reset':
          password = (await resetEmployeePassword(person.id)).temporary_password
          message = `${name}'s password was reset.`
          break
        case 'promote':
          await updateEmployee(person.id, { role: 'ADMIN' })
          message = `${name} is now an HR admin (from their next login).`
          break
        case 'demote':
          await updateEmployee(person.id, { role: 'EMPLOYEE' })
          message = `${name} is no longer an HR admin (from their next login).`
          break
        case 'deactivate':
          await updateEmployee(person.id, { status: 'INACTIVE' })
          message = `${name} was deactivated and can no longer log in.`
          break
        case 'reactivate':
          password = (await updateEmployee(person.id, { status: 'ACTIVE', hire_date: rehireDate })).temporary_password
          message = `${name} was reactivated.`
          break
        case 'delete':
          await deleteEmployee(person.id)
          navigate('/employees', { replace: true, state: { flash: `${name} was deleted.` } })
          return
      }
      setAction(null)
      setNotice(message)
      setTemporaryPassword(password)
      employee.reload()
    } catch (error: unknown) {
      // Shown inside the dialog, e.g. "This is the last active HR admin…".
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const person = employee.data
  const isSelf = state.status === 'authenticated' && person !== undefined && state.user.employee_id === person.id

  if (!person) {
    return (
      <AppLayout title="Employee" back={{ to: '/employees', label: 'Employees' }}>
        {employee.error ? (
          <Alert tone="error" title={employee.error.status === 404 ? 'Employee not found' : "Couldn't load the employee"}>
            <p>{employee.error.status === 404 ? 'It may have been deleted.' : employee.error.message}</p>
            {employee.error.status !== 404 && (
              <Button variant="secondary" className="mt-3" onClick={employee.reload}>
                Try again
              </Button>
            )}
          </Alert>
        ) : (
          <div className="flex justify-center py-16">
            <Spinner label="Loading employee" />
          </div>
        )}
      </AppLayout>
    )
  }

  const account = person.account
  const copy = action ? actionCopy(action, person.full_name) : null

  return (
    <AppLayout
      title={person.full_name}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm">{person.employee_code}</span>·<span>{person.position}</span>
          <Badge tone={person.status === 'ACTIVE' ? 'success' : 'neutral'}>{STATUS_LABEL[person.status]}</Badge>
        </span>
      }
      back={{ to: '/employees', label: 'Employees' }}
      actions={
        <Link to={`/employees/${person.id}/edit`} className={buttonClasses({ variant: 'secondary' })}>
          Edit profile
        </Link>
      }
    >
      {notice && <Alert tone="success">{notice}</Alert>}
      {employee.error && <Alert tone="error">Couldn't refresh: {employee.error.message}</Alert>}

      <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="profile-title">
          <h2 id="profile-title" className="mb-4 text-lg">
            Profile
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">{person.email}</Field>
            <Field label="Phone">{person.phone ?? <span className="text-ink-subtle">Not set</span>}</Field>
            <Field label="Department">{person.department.name}</Field>
            <Field label="Position">{person.position}</Field>
            <Field label="Hire date">{formatDate(person.hire_date)}</Field>
            <Field label="Status">{STATUS_LABEL[person.status]}</Field>
            <Field label="Added">{formatDateTime(person.created_at)}</Field>
            <Field label="Last updated">{formatDateTime(person.updated_at)}</Field>
          </dl>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="account-title">
          <h2 id="account-title" className="mb-4 text-lg">
            Login account
          </h2>
          {!account ? (
            <Alert tone="error">This employee has no login account, so they can't log in.</Alert>
          ) : (
            <>
              <dl className="grid gap-4">
                <Field label="Role">
                  <Badge tone={account.role === 'ADMIN' ? 'primary' : 'neutral'}>{ROLE_LABEL[account.role]}</Badge>
                </Field>
                <Field label="Can log in">
                  {account.is_active ? 'Yes' : <span className="text-danger">No, deactivated</span>}
                </Field>
                <Field label="Password">
                  {account.must_change_password ? 'Temporary (must be changed at next login)' : 'Set by the employee'}
                </Field>
                <Field label="Last login">{account.last_login_at ? formatDateTime(account.last_login_at) : 'Never'}</Field>
              </dl>

              <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
                {isSelf ? (
                  <Alert tone="info">
                    This is your own account. You can't change your own role or status, or delete it.{' '}
                    <Link to="/change-password">Change your password</Link> instead of resetting it.
                  </Alert>
                ) : (
                  <>
                    {account.is_active && (
                      <Button variant="secondary" fullWidth onClick={() => openAction('reset')}>
                        Reset password
                      </Button>
                    )}
                    <Button variant="secondary" fullWidth onClick={() => openAction(account.role === 'ADMIN' ? 'demote' : 'promote')}>
                      {account.role === 'ADMIN' ? 'Remove HR admin role' : 'Make HR admin'}
                    </Button>
                    {person.status === 'ACTIVE' ? (
                      <Button variant="secondary" fullWidth onClick={() => openAction('deactivate')}>
                        Deactivate (left the company)
                      </Button>
                    ) : (
                      <Button variant="secondary" fullWidth onClick={() => openAction('reactivate')}>
                        Reactivate (rehire)
                      </Button>
                    )}
                    <Button variant="danger" fullWidth onClick={() => openAction('delete')}>
                      Delete (created by mistake)
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog
        open={copy !== null}
        title={copy?.title ?? ''}
        onClose={() => !busy && setAction(null)}
        footer={
          copy && (
            <>
              <Button variant="ghost" onClick={() => setAction(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant={copy.variant} loading={busy} onClick={() => runAction(person)}>
                {copy.confirm}
              </Button>
            </>
          )
        }
      >
        {copy && (
          <div className="flex flex-col gap-4">
            <p>{copy.body}</p>
            {action === 'reactivate' && (
              <TextField
                label="New hire date"
                type="date"
                value={rehireDate}
                onChange={(event) => setRehireDate(event.target.value)}
              />
            )}
            {actionError && <Alert tone="error">{actionError}</Alert>}
          </div>
        )}
      </Dialog>

      <Dialog
        open={temporaryPassword !== null}
        title="New temporary password"
        onClose={() => setTemporaryPassword(null)}
        footer={<Button onClick={() => setTemporaryPassword(null)}>Done</Button>}
      >
        {temporaryPassword && <TemporaryPasswordNotice password={temporaryPassword} recipient={person.full_name} />}
      </Dialog>
    </AppLayout>
  )
}
