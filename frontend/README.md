# Dexa Attendance – Frontend

React 19 + Vite + TypeScript, axios for HTTP, Tailwind CSS v4 for styling. Talks only to the backend gateway (`VITE_API_BASE_URL`).

## Setup

Requires Node.js 22.18+ and the backend running (see [`backend/README.md`](../backend/README.md)).

```bash
cp .env.example .env    # VITE_API_BASE_URL=http://localhost:3000 (the gateway)
npm install
npm run dev             # http://localhost:5173
```

Changes to `.env` need a dev-server restart. The backend's `CORS_ORIGIN` must match the frontend's URL (default `http://localhost:5173`).

Log in with the seeded HR admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `backend/.env`).

## Pages

| Path | Who | Purpose |
|------|-----|---------|
| `/login` | logged out | Log in. Logged-in users are sent on |
| `/change-password` | logged in | Change password. **Forced** while `must_change_password` is true (temporary password from HR): every other page redirects here |
| `/` | logged in | Home: account, role, and the tools for that role (attendance, employees, monitoring: coming next) |
| `*` | anyone | Not found |

## Structure

```
src/
├── main.tsx              BrowserRouter + AuthProvider
├── App.tsx               routes
├── config.ts             VITE_API_BASE_URL (fails fast if missing)
├── types/                API types (snake_case, mirroring backend/docs/api/*.md) + runtime type guards
├── services/
│   ├── http.ts           axios instance (base URL, timeout, token + 401 interceptors) and request():
│   │                     unwraps { status, message, data }, checks it, throws ApiError
│   ├── auth.service.ts   login, fetchCurrentUser, changePassword
│   └── token-storage.ts  token in localStorage (+ in-memory copy), expiry from the token
├── auth/
│   ├── AuthProvider.tsx  session state: restore on load, login, logout, change password, auto-logout
│   ├── useAuth.ts        hook to read it
│   └── RouteGuards.tsx   RequireAuth / GuestOnly (which page to show)
├── components/
│   ├── index.ts          re-exports every component: import { Button, Alert } from '../../components'
│   └── <Name>/           one folder per component: <Name>.tsx, index.ts (+ <Name>.scss only if needed)
│                         (Alert, AuthLayout, Brand, Button, FullPageMessage, Spinner, TextField)
├── pages/
│   ├── index.ts          re-exports every page (used by App.tsx)
│   └── <Name>Page/       one folder per page: <Name>Page.tsx, index.ts (+ .scss only if needed)
├── utils/                cx() class joiner, form error mapping, password rules, router state readers
└── index.css             Tailwind entry + design tokens (the only .css file)
```

## How auth works

- **Login** stores the access token and the user. Every API call sends `Authorization: Bearer <token>`.
- **Page reload**: the stored token is checked with `GET /auth/me`. If the server is unreachable, the app shows "Can't reach the server" with a retry button and keeps the token, so a backend outage doesn't log anyone out.
- **Logout** happens on: the Log out button, any `401` on a request that carried the token (session revoked, user deactivated, token invalid), or the token's expiry time (a timer).
- **Temporary passwords**: after login with `must_change_password: true`, every page redirects to `/change-password`. Changing it returns a new token without the flag.
- **The backend is the real lock.** Route guards only decide what to show; the backend checks the token and role on every request.

## Conventions

- **API calls only in `services/`**, never in components or pages. Services use `request()` from `services/http.ts` (the shared axios instance `api`), never `axios` directly, and pass a type guard (`parseWith(isLoginResult, …)`) so the response shape is checked at runtime instead of trusted with a cast. The token is added by the axios request interceptor; a `401` on a request that carried a token logs the user out (response interceptor).
- **Errors**: services throw `ApiError` (`status`, `message`, `errors[]`), never raw axios errors. `status` is `0` when the server can't be reached or times out (15 s). Forms use `toFormErrors()` to show validation messages under the right field.
- **Folders**: a new component goes in `components/<Name>/` with `<Name>.tsx`, `index.ts` and, only if Tailwind can't do it, `<Name>.scss`, (`export { Name } from './Name'`), and is added to `components/index.ts`. Same for pages in `pages/`. Pages import components from the root (`'../../components'`); components import each other by folder (`'../Spinner'`) to avoid circular imports.
- **Data fields stay snake_case** as in the API (`user.must_change_password`); variables and functions are camelCase.
- **Styling: Tailwind CSS v4** (`@tailwindcss/vite`). Style with utility classes in `className`; combine conditional classes with `cx()` (`src/utils/cx.ts`).
  - Colors come from the **design tokens** in `src/index.css`, exposed as Tailwind colors that switch with light/dark mode automatically: `bg-page`, `bg-surface`, `bg-surface-muted`, `border-line`, `border-line-strong`, `text-ink`, `text-ink-muted`, `text-ink-subtle`, `bg-primary`, `text-on-primary`, `bg-primary-soft`, `text-primary-strong`, `outline-focus`, `ring-focus-ring`, and `{danger,info,success,warning}-{bg,line,ink}`. Use these, not Tailwind's raw palette (`bg-blue-500`) or hex values, so dark mode keeps working. Also `shadow-card` and `font-sans`.
  - **Two classes for the same property** (e.g. `border-transparent` and `border-line-strong`) are resolved by Tailwind's CSS order, **not** by their order in `className`. Give each variant its own value instead of overriding a base class (see `Button`).
  - **`src/index.css` is the only `.css` file**: Tailwind v4 must be loaded from plain CSS (as `.scss` its directives are silently not processed). It holds `@import 'tailwindcss'`, the tokens and base styles.
  - **If something can't be done with utilities**, write it in **SCSS** (`sass` is installed): `<Name>.scss` next to the component, imported from it. Never add other `.css` files. Use the tokens there as `var(--color-…)`.
- **Accessibility**: labels on every field, errors linked with `aria-describedby`, `role="alert"` for errors, visible focus outlines, keyboard-usable password reveal.

## Commands

| Action | Command |
|--------|---------|
| Dev server | `npm run dev` |
| Type check | `npx tsc -b` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Preview the build | `npm run preview` |

No frontend test runner is set up yet; the flows were checked in a browser against the real backend.

## Notes

- **Token in `localStorage`**: survives reloads, but any script injected into the page (XSS) could read it. React escapes rendered text, which limits that risk. The stronger option is an `HttpOnly` cookie set by the backend, a production upgrade.
