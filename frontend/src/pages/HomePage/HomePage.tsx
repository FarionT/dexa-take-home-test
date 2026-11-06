import { Link, useLocation } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { Alert, Brand, Button } from '../../components'
import type { Role } from '../../types/auth'
import { cx } from '../../utils/cx'
import { flashMessage } from '../../utils/location-state'

interface Feature {
  title: string
  description: string
  roles: Role[]
}

// Placeholders for the next features, so each role sees what's coming.
const FEATURES: Feature[] = [
  { title: 'WFH attendance', description: 'Check in and check out with a photo as proof.', roles: ['EMPLOYEE', 'ADMIN'] },
  { title: 'My attendance', description: 'Your check-in and check-out history.', roles: ['EMPLOYEE', 'ADMIN'] },
  { title: 'Employees', description: 'Add employees and update their data.', roles: ['ADMIN'] },
  { title: 'Attendance monitoring', description: "View every employee's attendance.", roles: ['ADMIN'] },
]

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'HR admin', EMPLOYEE: 'Employee' }

const ROLE_BADGE_CLASSES: Record<Role, string> = {
  ADMIN: 'bg-primary-soft text-primary-strong',
  EMPLOYEE: 'bg-surface-muted text-ink-muted',
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

export function HomePage() {
  const { state, logout } = useAuth()
  const location = useLocation()
  if (state.status !== 'authenticated') return null // RequireAuth renders this page only when logged in

  const { user } = state
  const flash = flashMessage(location.state)
  const features = FEATURES.filter((feature) => feature.roles.includes(user.role))

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <Brand />
        <nav className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-sm" aria-label="Account">
          <span className="break-all text-ink-muted">{user.email}</span>
          <span className={cx('rounded-full px-2 py-0.5 text-xs font-bold', ROLE_BADGE_CLASSES[user.role])}>
            {ROLE_LABEL[user.role]}
          </span>
          <Link className="font-semibold" to="/change-password">
            Change password
          </Link>
          <Button variant="secondary" onClick={() => logout()}>
            Log out
          </Button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-12">
        {flash && <Alert tone="success">{flash}</Alert>}

        <section>
          <h1 className="text-3xl">Welcome</h1>
          <p className="mt-2 text-ink-muted">
            You're logged in as <strong className="text-ink">{ROLE_LABEL[user.role]}</strong>.
            {user.last_login_at && <> Last login: {dateTimeFormat.format(new Date(user.last_login_at))}.</>}
          </p>
        </section>

        <section aria-labelledby="features-title">
          <h2 id="features-title" className="mb-4 text-lg">
            Your tools
          </h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
            {features.map((feature) => (
              <li key={feature.title} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base">{feature.title}</h3>
                  <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[0.6875rem] font-bold tracking-wide text-ink-muted uppercase">
                    Coming soon
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-muted">{feature.description}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
