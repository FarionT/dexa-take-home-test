# CLAUDE.md

> **READ THIS FILE FIRST.** Before running, checking, reviewing, editing, or debugging any code in this project, read this entire file. Do not skip. Do not run any command until done.

## 1. Mandatory Order of Work

1. Read this file fully.
2. Find which folder the task touches: `backend/`, `frontend/`, or both (see section 3).
3. Read that folder's README, `package.json`, and `tsconfig.json` first. Check the `scripts` section for real commands.
4. Look at that folder's `src/` structure before touching anything.
5. Understand the task. Ask if unclear.
6. Only then run, check, or change code.

## 2. Workspace Overview

This workspace (`dexa-test`) has **two folders**. Each has its own `src/`, its own `package.json`, its own dependencies, and its own commands. Both use **TypeScript**.

| Folder | Role | Stack |
|--------|------|-------|
| `backend/` | Backend API and business logic | NestJS + TypeScript (Node.js) |
| `frontend/` | User-facing web app | React.js + Vite + TypeScript |

- **Language:** TypeScript. Write new code in `.ts` / `.tsx`. Do not add plain `.js` / `.jsx` files.
- **Package manager:** npm by default. If `yarn.lock` or `pnpm-lock.yaml` exists in a folder, use that one instead.
- **Entry points:**
  - Backend: Nest **monorepo**, four apps, each with its own `main.ts`: `backend/apps/gateway/src/main.ts` (HTTP, root module `gateway.module.ts`) and `backend/apps/{auth,employee,attendance}/src/main.ts` (TCP microservices). Compiled output goes to `backend/dist/apps/<app>/`.
  - Frontend: `frontend/index.html` loads `frontend/src/main.tsx`. Root component is `frontend/src/App.tsx`.
- **Config files to read before changing build or types:**
  - Backend: `tsconfig.json`, `apps/<app>/tsconfig.app.json`, `nest-cli.json`
  - Frontend: `vite.config.ts`, `tsconfig.json`, and `tsconfig.app.json` / `tsconfig.node.json` if present
- **Git:** check whether `.git` is at the workspace root or inside each folder. Do not assume. Ask if unclear.

## 3. Structure

```
dexa-test/
├── CLAUDE.md                 # this file
├── backend/
│   ├── apps/
│   │   ├── gateway/          # HTTP entry point (:3000), TCP clients to services
│   │   │   ├── src/          # main.ts, gateway.module.ts (global pipe/filter/guards)
│   │   │   │   ├── auth/     # /auth endpoints, DTOs, guards/, auth.decorators.ts
│   │   │   │   ├── employees/  # /employees + /departments: DTOs, orchestration with undo steps
│   │   │   │   ├── attendance/ # /attendance: check-in/out upload, photo/ (signature check, disk storage)
│   │   │   │   ├── clients/  # TCP clients + rpc.ts (sendToService)
│   │   │   │   ├── common/   # http-exception.filter.ts (snake_case error JSON)
│   │   │   │   └── health/   # public /health
│   │   │   └── test/         # e2e tests (gateway.e2e-spec.ts)
│   │   ├── auth/             # TCP microservice (:3001), DB dexa_auth
│   │   │   ├── src/          # login/ (login, me, change password; signs JWTs), users/ (accounts + guardrails), passwords/, tokens/
│   │   │   ├── migrations/   # sequelize-cli TS migrations for dexa_auth
│   │   │   └── seeders/      # HR admin login seed
│   │   ├── employee/         # TCP microservice (:3002), DB dexa_employee
│   │   │   ├── src/          # departments/, employees/ (models, CRUD service, employee-code.service.ts)
│   │   │   ├── migrations/
│   │   │   └── seeders/      # departments + HR employee seed
│   │   └── attendance/       # TCP microservice (:3003), DB dexa_attendance
│   │       ├── src/          # attendances/ (model, check-in/out day rules, day list)
│   │       └── migrations/
│   ├── libs/shared/src/      # `@app/shared`: service addresses, message patterns, domain enums, DB options, types
│   ├── scripts/run-all.ts    # starts all four apps (npm run start:dev / start:prod)
│   ├── sequelize.config.ts   # sequelize-cli config: one "env" per service DB (auth / employee / attendance)
│   ├── docs/database-design.md  # tables, indexes, cross-DB rules (keep in sync with entities)
│   ├── docs/api/             # API reference per feature (auth.md, employees.md, attendance.md); keep in sync with endpoints
│   ├── dist/                 # compiled output (do not edit)
│   ├── nest-cli.json         # monorepo project list
│   ├── tsconfig.json         # base + `@app/shared` path; each app has tsconfig.app.json
│   ├── vitest.config.ts / vitest.config.e2e.ts
│   ├── .oxlintrc.json        # lint config (oxlint, not eslint)
│   ├── docker-compose.yml    # dev MySQL 8.4 (reads backend/.env)
│   ├── docker/mysql/init/    # first-start script: one DB per service
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── index.html            # Vite entry HTML
    ├── vite.config.ts
    ├── src/                  # React source (no semicolons, single quotes)
    │   ├── main.tsx          # BrowserRouter + AuthProvider
    │   ├── App.tsx           # routes
    │   ├── config.ts         # API_BASE_URL from VITE_API_BASE_URL
    │   ├── types/            # API types + runtime type guards (snake_case fields)
    │   ├── services/         # http.ts (axios instance `api`, request(), ApiError), <feature>.service.ts, token-storage.ts
    │   ├── auth/             # AuthProvider, useAuth, RouteGuards (RequireAuth / GuestOnly)
    │   ├── hooks/            # useRequest (data loading)
    │   ├── components/       # index.ts (barrel) + <Name>/{<Name>.tsx, index.ts, <Name>.scss only if needed}
    │   ├── pages/            # index.ts (barrel) + <Name>Page/{<Name>Page.tsx, index.ts, .scss only if needed}
    │   ├── utils/            # cx, attendance (limits, day status), form errors, employee form, format (incl. WIB times), labels, password rules, router state
    │   ├── index.css         # Tailwind entry + design tokens (the only .css file)
    │   └── vite-env.d.ts     # typed VITE_* env vars
    ├── .env.example
    ├── tsconfig.json
    └── package.json
```

Every code path in this project starts with the folder name.
Example: `backend/apps/gateway/src/...`, `backend/libs/shared/src/...`, `frontend/src/...`.

Never edit `dist/` or other build output by hand. Change `src/` and rebuild.

Update this section when structure changes. Add real subfolders under each `src/` once they exist (for example one folder per feature module in backend; `components/`, `pages/`, `hooks/`, `services/`, `types/` in frontend).

## 4. Folder Boundaries (Important)

- `backend/` and `frontend/` are independent. Run commands **inside the correct folder** (`cd` into it first). Never run from workspace root.
- Do not import code across folders. Share logic through the backend API, not by copying files.
- Backend API change = check `frontend/` for impact. Report affected files.
- Keep API contracts (routes, request types, response types) in sync between backend and frontend. Every endpoint is documented in `backend/docs/api/<feature>.md` (request, response, every error status and message); update it in the same change as the endpoint. When backend DTOs or response shapes change, update matching frontend types.
- Do not mix dependencies between folders. Install only in the folder that needs it.

## 5. Setup and Commands

Run inside the folder. **Confirm each command against that folder's `package.json` `scripts` before running.**

| Action  | `backend` | `frontend` |
|---------|-----------|------------|
| Install | `npm install` | `npm install` |
| Run (dev) | `npm run start:dev` | `npm run dev` |
| Type check | `npx tsc --noEmit` | `npx tsc -b` (or `npx tsc --noEmit`) |
| Test (unit) | `npm test` | `npm test` (if configured) |
| Test (e2e) | `npm run test:e2e` | n/a |
| Lint    | `npm run lint` | `npm run lint` |
| Build   | `npm run build` | `npm run build` |
| Run built app | `npm run start:prod` | `npm run preview` |

- Backend dev uses Nest CLI watch mode. Do not swap the tool.
- Vite dev server default port is `5173`. NestJS default port is `3000`. Check for clashes.
- If a script does not exist, tell the user. Do not invent one.
- Run type check, lint, and tests in every folder you changed.

## 6. Dependency Notes

- **TypeScript version:** `typescript-eslint` currently supports TypeScript below 6.1. Keep `typescript` at `~6.0.x` in `frontend/` (TypeScript 7 caused an `ERESOLVE` install error). Do not upgrade TypeScript until `typescript-eslint` supports it.
- Do not fix peer dependency errors with `--force` or `--legacy-peer-deps` unless the user agrees.

## 7. Coding Rules

### General
- Follow existing code style and naming in that folder. Do not reformat unrelated code.
- Keep changes small and focused on the task.
- No new dependency without asking first. If a package is added, add its `@types/*` package when needed.
- Write clear comments for non-obvious logic.
- Handle errors. Do not swallow exceptions silently.
- Never hardcode secrets, passwords, tokens, or API keys.

### TypeScript (both folders)
- Keep `strict` mode on. Do not loosen `tsconfig.json` to make errors go away.
- Do not use `any`. Use `unknown` and narrow it, or write a proper type.
- Do not use `@ts-ignore` or `@ts-expect-error` unless asked. If used, add a comment saying why.
- Avoid non-null assertion `!` and type casts `as X` unless truly safe. Prefer type guards.
- Type function parameters and return values for exported functions.
- Use `import type { ... }` for type-only imports if repo already does.
- **Naming convention (project rule, both folders):**

  | Kind of name | Style | Example |
  |---|---|---|
  | **Data fields**: model attributes, DTO fields, message payloads, API JSON, JWT claims, frontend API types | **snake_case** | `user.employee_id`, `dto.full_name`, `{ "created_at": … }` |
  | Variables, parameters, functions, methods | camelCase | `const employeeId = user.employee_id;` |
  | Classes, types, interfaces, enums | PascalCase | `EmployeeService`, `CreateEmployeeDto` |
  | Constants | UPPER_SNAKE_CASE | `SERVICE_CLIENTS`, `PING_TIMEOUT_MS` |
  | Library options (Sequelize, Nest, React props of libraries) | as the library defines | `allowNull`, `primaryKey`, `isGlobal` |

  A field keeps one name from MySQL to the browser: `employee_id` in the column, model, TCP message, JSON and React type. When destructuring a data object, rename to camelCase (`const { employee_id: employeeId } = user`) or use the property directly (`user.employee_id`); never create a snake_case variable.
- Fix type errors at the root cause. Do not hide them.

### Backend (NestJS)
- Follow Nest structure: **module → controller → service**. One feature = one module. Register new modules in `app.module.ts` (or parent module).
- Controllers handle HTTP only. Business logic goes in services. No logic in controllers.
- Use **DTO classes** for request bodies, params, and queries. Validate with `class-validator` and `class-transformer` through `ValidationPipe`. TypeScript types do not check real incoming data.
- Use dependency injection through constructors. Do not create service instances with `new`.
- Use Nest exceptions (`NotFoundException`, `BadRequestException`, etc.) or a global exception filter. Do not return raw error objects.
- Auth and permission checks go in **guards**, not inside handlers.
- Use pipes for validation and transformation, interceptors for response shaping and logging.
- Use proper HTTP status codes and consistent JSON response shape.
- Read env vars through `ConfigModule` / `ConfigService`. Do not scatter `process.env` across code.
- Never log passwords, tokens, or personal data.
- Keep CORS config strict. Do not set `*` for production. Allow the Vite origin (`http://localhost:5173`) in dev.
- Database: the ORM is **Sequelize** (`sequelize` v6 + `sequelize-typescript` + `@nestjs/sequelize`, MySQL driver `mysql2`). Follow its existing patterns (see section 12). Do not add another ORM.
- Schema changes go **only through migrations** (`backend/apps/<service>/migrations/*.ts`, run by `sequelize-cli`). Never use `sequelize.sync()` / `synchronize: true`, and never change a migration that has already run; add a new one.
- Table design lives in `backend/docs/database-design.md`. Keep it, the models and the migrations in sync.
- Tests: place `*.spec.ts` next to the file. Mock dependencies with Nest `Test.createTestingModule`.

### Frontend (React.js + Vite + TypeScript)
- Use functional components and hooks. Follow style already used in repo.
- Component files use `.tsx`. Non-JSX files use `.ts`.
- Type component props. Type `useState`, `useRef`, and API responses explicitly when inference is not enough.
- Reuse existing components and styles before making new ones.
- Keep API calls in a service/api layer, not inside UI components. Type request and response there.
- Handle loading, error, and empty states for every data fetch.
- Do not touch the DOM directly. Use state and refs.
- Use stable `key` props in lists. No array index as key if list can change.
- **Env vars:** Vite exposes only variables prefixed with `VITE_`, read with `import.meta.env.VITE_*`. Do not use `process.env` in frontend code. Add new vars to `src/vite-env.d.ts` (`ImportMetaEnv`) so they are typed. Never put secrets in `VITE_` vars, they are public in the bundle.
- Env changes need dev server restart. Remind user.
- Backend URL comes from env var or Vite `server.proxy`. Do not hardcode `localhost` URLs in components.
- Static files in `public/` are served at root. Files imported from `src/` get bundled.
- **API layer pattern**: HTTP uses **axios** through the single instance in `src/services/http.ts` (base URL, 15 s timeout, token request interceptor, 401 response interceptor). Call the backend only via `request(config, parseWith(<typeGuard>, '<what>'))` from a `src/services/<feature>.service.ts` function; never import `axios` in components, pages or other files, and never create another instance. The type guard checks the response at runtime (no `as` casts on API data). Errors are always `ApiError` (`status` 0 = unreachable or timeout); show them with `toFormErrors()` in forms. File downloads (attendance photos) use `requestBlob()` and are shown via `URL.createObjectURL` (`AttendancePhoto`), never an `<img src>` to the API, since that can't send the token. The attendance camera uses `getUserMedia` (`CameraCapture`); file upload is only the fallback when no camera can be used.
- **Folder rule**: every component and page has its own folder with `<Name>.tsx`, `index.ts` re-exporting it, and a `<Name>.scss` only if Tailwind can't express a style; register it in the root `components/index.ts` / `pages/index.ts`. Pages and other code import from the root barrel (`'../../components'`); components import each other by folder (`'../Button'`), never via the root barrel (circular imports).
- **Data loading**: pages load data with `useRequest(key, load)` (`src/hooks/useRequest.ts`), never with `useEffect` + `setState` (`react-hooks/set-state-in-effect` is an error). Put every input of the request in `key`. Handle `loading`, `error` (with a Try again calling `reload`) and the empty state.
- **Non-component exports**: `.tsx` files export only components (`react-refresh/only-export-components`). Constants and helpers go in `.ts` files (e.g. `utils/labels.ts`, `Button/button-styles.ts`).
- **Auth in the UI**: read the session with `useAuth()`; put pages behind `RequireAuth` (or `GuestOnly`) routes in `App.tsx`, and HR-only pages also inside `RequireRole role="ADMIN"`. Route guards only decide what to show; the backend enforces access. Router `location.state` is read through the guards in `utils/location-state.ts`, never cast.
- **Styling: Tailwind CSS v4** utility classes (`@tailwindcss/vite`), joined with `cx()` from `src/utils/cx.ts`. Use the token colors from `src/index.css` (`bg-surface`, `text-ink-muted`, `border-line`, `bg-primary`, `{danger,info,success,warning}-{bg,line,ink}`, …), never Tailwind's raw palette or hex values: the tokens switch for dark mode. Never rely on `className` order to override a utility for the same property (Tailwind's CSS order wins); give each variant its own value. `src/index.css` is the **only** `.css` file (Tailwind v4 can't be loaded from `.scss`; it would silently produce no utilities). Anything Tailwind can't express goes in a co-located `<Name>.scss` (`sass` is installed). No UI library without asking.

## 8. Safety Rules (Never Break)

- Never delete files, data, or branches without explicit permission.
- Never touch `.env` files (`.env`, `.env.local`, `.env.production`, etc.), credentials, or production config.
- Never run destructive commands (`rm -rf`, `DROP TABLE`, `git reset --hard`, `git push --force`) without asking.
- Never run against production database or production API. Use dev or test only.
- Never run database migrations, schema sync, or seeders without asking first (`npm run db:migrate`, `db:migrate:undo:<service>`, seed scripts). Never call `sequelize.sync()` (including `{ force: true }` / `{ alter: true }`) or set `synchronize: true` in `SequelizeModule` options. Testing against a throwaway container you start and remove yourself is fine.
- Never run `npm audit fix --force` or major dependency upgrades (including TypeScript, NestJS, Vite, or React major versions) without asking.
- Never commit or push unless asked.

## 9. Before Checking or Running Code

- [ ] Read this file
- [ ] Know which folder(s) task touches
- [ ] `cd` into correct folder
- [ ] Read `package.json` scripts and `tsconfig.json` of that folder
- [ ] Confirm environment (dev / test / prod). Default: dev.
- [ ] Confirm dependencies installed (`node_modules` exists) in that folder
- [ ] Confirm `.env` exists and points to dev (do not print its values)
- [ ] Confirm database is dev/test, not production (backend)
- [ ] Confirm backend running if frontend needs the API
- [ ] Confirm ports do not clash
- [ ] Confirm no secrets will be exposed in output
- [ ] Confirm command is not destructive

## 10. After Making Changes

- [ ] Type check passes in each changed folder
- [ ] Code runs without errors in each changed folder
- [ ] Tests pass in each changed folder
- [ ] Lint passes in each changed folder
- [ ] Build passes (`npm run build`) if config, deps, types, or many files changed
- [ ] Backend API change checked against frontend, types updated
- [ ] New backend module registered, DTOs validated
- [ ] No new `any`, `@ts-ignore`, or loosened `tsconfig` settings
- [ ] Summarize what changed and why, briefly
- [ ] List files created, edited, or removed, with full path starting at folder name

## 11. Communication Rules

- Be short and direct.
- Always name the folder when reporting. Example: "`backend/src/...` changed".
- State what was done, what failed, and what is next.
- If unsure, ask. Do not guess.
- Report errors with full message and likely cause. For type errors, include the TS error code (for example `TS2322`).

## 12. Known Issues and Notes

- `npm create vite` installs TypeScript 7, which conflicts with `typescript-eslint`. Fixed by pinning `typescript@~6.0` (see section 6).
- Backend was scaffolded with `@nestjs/cli@12`: ESM (`"type": "module"`), so relative imports need the `.js` suffix (e.g. `./app.module.js`). Tests use **vitest** (not jest), lint uses **oxlint** (not eslint). `typescript` pinned to `~6.0.x` here too.
- Backend uses `@nestjs/platform-express` (scaffold default) as the HTTP adapter.
- Database: **MySQL 8.4** via `backend/docker-compose.yml` (`docker compose up -d` inside `backend/`). One database per service: `dexa_auth`, `dexa_employee`, `dexa_attendance`. The init script only runs on an empty volume; `docker compose down -v` resets it but **deletes data** — ask first.
- Backend service app layout (auth, employee, attendance): the `src/` root holds only `main.ts`, `<app>.module.ts` and `ping.controller.ts` / `ping.service.ts` (the health check `GET /health` sends). Everything else lives in a feature folder (`login/`, `users/`, `employees/`, `attendances/`, …) with its own controller and service.
- Backend microservices: apps **never import from each other**; shared code goes in `backend/libs/shared` (`@app/shared`). The gateway talks to services only via `ClientProxy.send()` with patterns from `libs/shared/src/patterns.ts`. Services own their DB; never read another service's DB.
- Backend monorepo uses the plain `tsc` builder (not rspack). `nest generate app/library` would switch it to rspack and add jest files, so add apps/libs by hand following the existing ones (folder + `tsconfig.app.json` + `nest-cli.json` project + `SERVICE_KEYS` entry).
- `process.env` is read only in `libs/shared/src/services.ts`, `apps/gateway/src/main.ts` (both needed before DI exists) `scripts/`, `sequelize.config.ts` and `apps/*/seeders/` (CLI tools, no DI). App code reads config through `ConfigService` (`@nestjs/config`, `ConfigModule.forRoot({ isGlobal: true })` in each app). `.env` is loaded by `nest start --env-file` / `node --env-file`.
- **Sequelize conventions** (backend):
  - Models live in the owning service: `backend/apps/<service>/src/<feature>/<name>.model.ts`, registered with `SequelizeModule.forFeature([...])`. A service never imports another service's model.
  - Shared connection options: `sequelizeOptions()` in `libs/shared/src/database.ts`. They set `timestamps: true`, `paranoid: true` (soft delete via `deleted_at`), `createdAt: 'created_at'` / `updatedAt: 'updated_at'` / `deletedAt: 'deleted_at'` (snake_case timestamp attributes), `timezone: '+00:00'` (store UTC), and `synchronize: false`. No `underscored`: model attributes are already snake_case (see the naming rule in section 7), so attribute names equal column names.
  - Soft delete: `destroy()` sets `deleted_at`, normal queries skip deleted rows, `restore()` undoes it, `paranoid: false` includes deleted rows. Never hard delete (`destroy({ force: true })`) without asking.
  - The `not_deleted` generated column (unique keys that ignore deleted rows) exists **only in migrations**, never in models.
  - **Employee codes** (`EMP-0001`) are generated only by `EmployeeCodeService.next(transaction)` (`apps/employee/src/employees/employee-code.service.ts`), always inside the transaction that inserts the employee. It locks the `sequences` row (`FOR UPDATE`), so concurrent creates get consecutive codes. Never compute codes with `MAX()+1`, never accept them from the client, and never format with MySQL `LPAD(n, 4)` (truncates past 9999). Don't use `AUTO_INCREMENT` for codes (a generated column can't refer to it, MySQL error 3109).
  - **Seeders**: TypeScript in `backend/apps/<service>/seeders/`, same format and rules as migrations (CLI signature, erasable TS, no `@app/shared`, values written out). Run with `npm run db:seed` (employee first, then auth) and `npm run db:seed:undo`; executed seeders are recorded in each database's `sequelize_data` table. Seeders must be safe to re-run (skip existing live rows). The seeded HR employee ID `e0000000-0000-4000-8000-000000000001` is shared by the employee and auth seeders: keep them in sync. Seed credentials come from `SEED_ADMIN_*` in `.env`; never log the password.
  - Passwords: hash and check only through `PasswordService` (`apps/auth/src/passwords/`, `bcryptjs`, cost 12). Never store, log or return plain passwords or hashes. Password DTO fields use `PASSWORD_MIN_LENGTH` / `PASSWORD_MAX_BYTES` (72, bcrypt's limit) from `@app/shared`.
- **Auth and API conventions** (backend; details in `backend/README.md` → API / Protecting an endpoint):
  - The auth service **signs** JWTs, the gateway **verifies** them; both read `JWT_SECRET` via `getJwtSecret()` (min 32 chars). Claims are `JwtPayload` in `@app/shared` (`sub`, `employee_id`, `role`, `must_change_password`).
  - Global guards in the gateway protect every endpoint by default. Use `@Public()`, `@Roles(...)`, `@AllowDuringPasswordChange()`, `@CurrentUser()`; never check auth inside a handler, and take ids from `@CurrentUser()`, never from the body or URL.
  - Gateway → service calls go through `sendToService()` (`apps/gateway/src/clients/rpc.ts`). Services report expected failures with `throw rpcError(status, message)`; anything else becomes a generic 500. Don't throw Nest `HttpException`s inside microservices (they arrive as 500).
  - **Every response body is `{ status, message, data? }`** (`apps/gateway/src/common/api-response.ts`): `ResponseEnvelopeInterceptor` wraps what a handler returns, `HttpExceptionFilter` wraps errors. Handlers return plain data, never build the envelope themselves; set the success text with `@ResponseMessage('…')` (default `Success`). `data` is left out when empty; validation errors are `400 Validation failed` with `data.errors: string[]`. Never put internal details (hosts, ports, stack traces, SQL) in a response; log them instead. `/health` is public, so it reports only `unreachable` / `timeout`. The one exception to the envelope is a file download: a handler returning a `StreamableFile` (e.g. `GET /attendance/:id/photo`) is sent as is.
  - Login: same `401 Invalid email or password` for unknown email and wrong password, and `PasswordService.verify()` runs bcrypt even when the user doesn't exist (timing).
- **Role management guardrails** (backend; full rules in `backend/docs/database-design.md` → Roles). Apply to every endpoint or message that changes a user's role, deactivates, or deletes an employee/user:
  1. Only `ADMIN` may set `role` (gateway `RolesGuard` + DTO validation; default `EMPLOYEE`).
  2. Nobody may change their own role, deactivate or delete themselves (auth service compares `actor_user_id` from the JWT with the target; `403`).
  3. The last active `ADMIN` may not be demoted, deactivated or deleted (`409`). Check it in the auth service **inside a transaction** after `SELECT … WHERE role = 'ADMIN' AND is_active AND deleted_at IS NULL FOR UPDATE`, never as a plain count before the update (race: two admins demoting each other).
  4. Record who did it (`employees.updated_by`).
  Each rule needs a test, including a concurrent "two admins demote each other" case.
  Implemented in `backend/apps/auth/src/users/users.service.ts`: lock the active-admin rows (`FOR UPDATE`) **before** the target row, so concurrent role changes queue instead of deadlocking.
- **Cross-service writes** (backend gateway, e.g. `apps/gateway/src/employees/employees.service.ts`): two databases share no transaction, so every flow that writes to two services runs in a fixed order with an **undo step** for the second failure (create: employee → login, undo = delete employee; update: employee → login, undo = restore the `previous` values the employee service returned; delete: login → employee, undo = restore login). Undo steps go through `undo()`, which logs `MANUAL FIX NEEDED` with ids if the undo itself fails, then the original error is returned. Employees and logins are 1:1: HR acts only on employees; never add an endpoint that changes a login without its employee.
  - Avoid MySQL 8 reserved words as column names (e.g. `last_value`, `rank`, `rows`, `groups`): they work only when backtick-quoted and break plain SQL in DBeaver.
  - **No circular imports between model files.** With ESM + `emitDecoratorMetadata`, `design:type` reads the imported class while the file loads, so two models importing each other crash with `ReferenceError: Cannot access 'X' before initialization`. Define associations on one side only (e.g. `Employee` `@BelongsTo(() => Department)`, no `@HasMany` back).
  - `tsconfig.json` sets `useDefineForClassFields: false`. Required by `sequelize-typescript`: with it `true` (the ES2022+ default), class fields shadow Sequelize's attribute getters and every model value reads as `undefined`. Do not remove it.
  - Migrations: run by **`sequelize-cli`** (devDependency) with `backend/sequelize.config.ts`, where each service database is a CLI "environment" (`--env auth|employee|attendance`, plus `--migrations-path apps/<service>/migrations`). Use the npm scripts: `npm run db:migrate` (all services), `npm run db:migrate:status`, `npm run db:migrate:undo:<service>` (last one of that service). For any other CLI command: `npm run sequelize -- <command> --env <service> --migrations-path apps/<service>/migrations`. Each database tracks its own runs in a `sequelize_meta` table.
  - Migration files: TypeScript in `backend/apps/<service>/migrations/`, named `YYYYMMDDHHmmss-<description>.ts` (the CLI's 14-digit format), exporting `async function up(queryInterface, Sequelize)` and `down(queryInterface)`. Node runs them directly (type stripping), so only erasable TS syntax, and no `@app/shared` imports (write values out; migrations are snapshots).
  - **Do not use `sequelize-cli migration:generate`** (or `model:generate` / `init`): it writes CommonJS `.js` files, which fail in this ESM package (`module is not defined in ES module scope`) and break the TS-only rule. Create a migration by copying an existing `.ts` one and renaming it with a new timestamp.
- `backend/docker/mysql/init/01-create-databases.sh` must stay executable (`chmod +x`): Docker Desktop mounts report it as executable either way, so the entrypoint runs it instead of sourcing it.
- **Attendance uploads** (gateway, `apps/gateway/src/attendance/`): multipart is parsed by multer **in memory** (`MulterModule` limits from `UPLOAD_MAX_SIZE_MB`, 413 if bigger); `PhotoFilePipe` accepts only real JPEG/PNG/WebP by file signature (never trust `Content-Type` or the file name). Only `PhotoStorageService` touches `UPLOAD_DIR` (UUID names, paths checked to stay inside it); only the relative path goes over TCP. Photos are never public static files. The working day is computed by the attendance service in `ATTENDANCE_TIME_ZONE` (Asia/Jakarta) via `attendanceDateOf()`.
- <add more known bugs, quirks, or gotchas here>

---
*Last updated: 2026-11-06*
