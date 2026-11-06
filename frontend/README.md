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
| `/` | logged in | Home: greeting by name, role, and the tools for that role |
| `/attendance` | logged in (HR too) | WFH attendance: today's check-in / check-out with a **camera photo** and optional notes, then your own history (one row per day, date filter, photos) |
| `/monitoring` | HR | Everyone's attendance, **read only**: today by default, date range, department and search filters, each person's check-in / check-out photos. Only employees who checked in are listed |
| `/employees` | HR (ADMIN) | Employee list: search (name, code, email), department and status filters, pages. Filters live in the URL |
| `/employees/new` | HR | Add an employee (their login is created too). The temporary password is shown **once** in a dialog |
| `/employees/:id` | HR | Profile and login account, with actions: reset password, make/remove HR admin, deactivate (left), reactivate (rehire, new temporary password), delete (mistakes only). Hidden on your own record |
| `/employees/:id/edit` | HR | Edit the profile (only changed fields are sent) |
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
│   │                     unwraps { status, message, data }, checks it, throws ApiError;
│   │                     requestBlob() for file downloads (attendance photos)
│   ├── auth.service.ts   login, fetchCurrentUser, changePassword
│   ├── employee.service.ts  departments, employees CRUD, reset password, my profile
│   ├── attendance.service.ts  check-in / check-out (multipart), today, my history, HR list, photo download
│   └── token-storage.ts  token in localStorage (+ in-memory copy), expiry from the token
├── auth/
│   ├── AuthProvider.tsx  session state: restore on load, login, logout, change password, auto-logout
│   ├── useAuth.ts        hook to read it
│   └── RouteGuards.tsx   RequireAuth / GuestOnly / RequireRole (which page to show)
├── hooks/
│   └── useRequest.ts     load data: { data, error, loading, reload } (see Conventions)
├── components/
│   ├── index.ts          re-exports every component: import { Button, Alert } from '../../components'
│   └── <Name>/           one folder per component: <Name>.tsx, index.ts (+ <Name>.scss only if needed)
│                         Alert, AppLayout (header + nav for logged-in pages), AttendancePhoto (loads a photo
│                         with the token), AttendancePhotosDialog, AuthLayout, Badge, Brand, Button
│                         (+ buttonClasses for links), CameraCapture (browser camera + upload fallback),
│                         DayStatusBadge, Dialog (native <dialog>), EmployeeForm, FullPageMessage, Pagination,
│                         SelectField, Spinner, TemporaryPasswordNotice, TextField
├── pages/
│   ├── index.ts          re-exports every page (used by App.tsx)
│   └── <Name>Page/       one folder per page: <Name>Page.tsx, index.ts (+ .scss only if needed)
├── utils/                cx(), attendance (photo limits, next action, day status), form errors, employee
│                         form rules, date/time formatting (always WIB), labels, password rules, router state readers
└── index.css             Tailwind entry + design tokens (the only .css file)
```

## How auth works

- **Login** stores the access token and the user. Every API call sends `Authorization: Bearer <token>`.
- **Page reload**: the stored token is checked with `GET /auth/me`. If the server is unreachable, the app shows "Can't reach the server" with a retry button and keeps the token, so a backend outage doesn't log anyone out.
- **Logout** happens on: the Log out button, any `401` on a request that carried the token (session revoked, user deactivated, token invalid), or the token's expiry time (a timer).
- **Temporary passwords**: after login with `must_change_password: true`, every page redirects to `/change-password`. Changing it returns a new token without the flag.
- **Account changes apply at once**: the backend checks the login on every request, so if HR deletes or deactivates a logged-in user, their next request gets `401` and they are logged out. A demoted HR admin gets `403` on HR pages right away (the menu updates on the next page load).
- **The backend is the real lock.** Route guards only decide what to show; the backend checks the token and role on every request.

## Attendance and photos

- **Camera first**: `CameraCapture` uses the browser camera (`navigator.mediaDevices.getUserMedia`). The user clicks *Turn on camera*, sees a mirrored live preview, and *Take photo* saves the current frame as a JPEG (not mirrored). *Retake* starts the camera again.
- **Upload only as a fallback**: *Upload a photo* appears only when the camera can't be used, each case with its own message: no camera found, access blocked (with *Try the camera again*), camera busy in another app, or no camera API. The file must be JPEG, PNG or WebP and at most 5 MB (checked here to fail fast; the backend checks the real file bytes again).
- **HTTPS or localhost is required for the camera**: browsers hide the camera API on plain `http://` (except `localhost`), so a deployment without HTTPS would only offer the upload.
- **Photos are loaded with the token**: the photo endpoint needs `Authorization`, which an `<img src>` can't send. `AttendancePhoto` downloads it with `requestBlob()` and shows it from an object URL, loaded only when the photos dialog opens.
- **Times are in WIB**: the working day and every time on screen follow Asia/Jakarta (the same day the backend counts in), always labelled `WIB`, whatever the viewer's own time zone. See `utils/format.ts`.
- **The next action comes from the server**: `GET /attendance/me/today` decides whether the page shows *Check in*, *Check out* or "You're done for today", so the page is right even after a check-in in another tab.

## Conventions

- **API calls only in `services/`**, never in components or pages. Services use `request()` from `services/http.ts` (the shared axios instance `api`), never `axios` directly, and pass a type guard (`parseWith(isLoginResult, …)`) so the response shape is checked at runtime instead of trusted with a cast. The token is added by the axios request interceptor; a `401` on a request that carried a token logs the user out (response interceptor).
- **Loading data**: use `useRequest(key, load)` from `src/hooks/useRequest.ts`. `key` identifies the request (include every input, e.g. the query); when it changes the data reloads, and `reload()` runs it again. It returns `{ data, error, loading, reload }`, keeps the previous `data` while the next key loads (no flicker when paging), and ignores outdated responses. Don't call `setState` at the start of a `useEffect` to mark loading: the React lint rules (`react-hooks/set-state-in-effect`) reject it.
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
