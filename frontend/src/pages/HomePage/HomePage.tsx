import { Link, useLocation } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { Alert, AppLayout, Badge } from '../../components'
import { useRequest } from '../../hooks/useRequest'
import { getMyProfile } from '../../services/employee.service'
import type { Role } from '../../types/auth'
import { formatDateTime } from '../../utils/format'
import { ROLE_LABEL } from '../../utils/labels'
import { flashMessage } from '../../utils/location-state'

interface Feature {
  title: string
  description: string
  roles: Role[]
  /** Set once the feature exists. */
  to?: string
}

const FEATURES: Feature[] = [
  {
    title: 'WFH attendance',
    description: 'Check in and check out with a photo, and see your history.',
    roles: ['EMPLOYEE', 'ADMIN'],
    to: '/attendance',
  },
  { title: 'Employees', description: 'Add employees and update their data.', roles: ['ADMIN'], to: '/employees' },
  { title: 'Attendance monitoring', description: "View every employee's attendance.", roles: ['ADMIN'], to: '/monitoring' },
]

export function HomePage() {
  const { state } = useAuth()
  const location = useLocation()
  // The name lives in the employee service; the greeting falls back to "Welcome" until it loads.
  const profile = useRequest('my-profile', getMyProfile)
  if (state.status !== 'authenticated') return null // RequireAuth renders this page only when logged in

  const { user } = state
  const flash = flashMessage(location.state)
  const features = FEATURES.filter((feature) => feature.roles.includes(user.role))
  const firstName = profile.data?.full_name.split(' ')[0]

  return (
    <AppLayout
      title={firstName ? `Welcome, ${firstName}` : 'Welcome'}
      description={
        <>
          You're logged in as <strong className="text-ink">{ROLE_LABEL[user.role]}</strong>
          {profile.data && (
            <>
              {' '}
              · {profile.data.employee_code} · {profile.data.position}, {profile.data.department.name}
            </>
          )}
          .{user.last_login_at && <> Last login: {formatDateTime(user.last_login_at)}.</>}
        </>
      }
    >
      {flash && <Alert tone="success">{flash}</Alert>}

      <section aria-labelledby="features-title">
        <h2 id="features-title" className="mb-4 text-lg">
          Your tools
        </h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
          {features.map((feature) => {
            const content = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base">{feature.title}</h3>
                  {!feature.to && <Badge>Coming soon</Badge>}
                </div>
                <p className="mt-2 text-sm text-ink-muted">{feature.description}</p>
              </>
            )
            return (
              <li key={feature.title}>
                {feature.to ? (
                  <Link
                    to={feature.to}
                    className="block h-full rounded-xl border border-line bg-surface p-5 text-ink no-underline transition-colors hover:border-primary"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="h-full rounded-xl border border-line bg-surface p-5">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </AppLayout>
  )
}
