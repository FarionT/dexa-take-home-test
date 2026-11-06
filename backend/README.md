# Dexa Test – Backend

NestJS **monorepo with four apps**: one HTTP gateway and three TCP microservices, each owning its own MySQL database.

```
Browser ──HTTP──▶ gateway    :3000 ──TCP──▶ auth       :3001 ─▶ dexa_auth
                  (CORS, auth,      ──TCP──▶ employee   :3002 ─▶ dexa_employee
                   uploads)         ──TCP──▶ attendance :3003 ─▶ dexa_attendance
```

| Path | What |
|------|------|
| `apps/gateway/` | Only HTTP entry point. Forwards requests to services over TCP |
| `apps/auth/` | Login, users, JWT |
| `apps/employee/` | Employee master data (HR) |
| `apps/attendance/` | WFH attendance with photo |
| `libs/shared/` | Imported as `@app/shared`: service addresses, message patterns, shared types |
| `scripts/run-all.ts` | Starts all four apps in one terminal |
| `docker-compose.yml` | Dev MySQL 8.4 |

## Local setup

Requires Node.js 22.18+ and Docker.

```bash
cp .env.example .env    # then change the passwords / JWT secret
docker compose up -d    # MySQL 8.4 on localhost:3306
npm install
npm run db:migrate      # create the tables in all three databases
npm run db:seed         # 3 departments + the first HR admin (login from SEED_ADMIN_* in .env)
npm run start:dev       # all four apps in watch mode
```

Check that everything is up: http://localhost:3000/health returns each service's status and whether it can reach its database. If a service or database is down, the gateway still answers, with `"status": "degraded"`.

Run a single app instead (e.g. while working on one service):

```bash
npx nest start auth --watch --env-file .env
```

## Database

ORM: **Sequelize** (`sequelize-typescript` models, `@nestjs/sequelize`). Table design: [`docs/database-design.md`](docs/database-design.md).

| Service | Database | Models | Migrations |
|---------|----------|--------|------------|
| auth | `dexa_auth` | `apps/auth/src/users/` | `apps/auth/migrations/` |
| employee | `dexa_employee` | `apps/employee/src/departments/`, `employees/` | `apps/employee/migrations/` |
| attendance | `dexa_attendance` | `apps/attendance/src/attendances/` | `apps/attendance/migrations/` |

- Every table has `created_at`, `updated_at` and `deleted_at`. Models are `paranoid`: `destroy()` is a soft delete, and normal queries skip deleted rows.
- Tables are created **only by migrations**: TypeScript files run by [`sequelize-cli`](https://github.com/sequelize/cli), configured in `sequelize.config.ts` (one CLI "environment" per service database). Sequelize's `sync()` is never used.
- Each database records its executed migrations in its own `sequelize_meta` table.

### MySQL container

On first start, MySQL creates one database per service (`dexa_auth`, `dexa_employee`, `dexa_attendance`) and grants `DB_USER` access to each (see `docker/mysql/init/`).
The init script runs only when the data volume is empty. After changing DB names or credentials in `.env`, reset it with `docker compose down -v` (this **deletes all local DB data**).

Stop MySQL with `docker compose down` (data is kept).

## Commands

| Action | Command |
|--------|---------|
| Dev (all apps, watch) | `npm run start:dev` |
| Build all apps | `npm run build` |
| Run built apps | `npm run start:prod` |
| Run pending migrations (all services) | `npm run db:migrate` |
| Migration status | `npm run db:migrate:status` |
| Undo a service's last migration | `npm run db:migrate:undo:auth` (or `:employee`, `:attendance`) |
| Seed departments + first HR admin | `npm run db:seed` |
| Remove the seeded rows | `npm run db:seed:undo` |
| Any other sequelize-cli command | `npm run sequelize -- <command> --env <service> --migrations-path apps/<service>/migrations` |
| Type check | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| E2E tests | `npm run test:e2e` |

## Adding a migration

1. Copy an existing migration to `apps/<service>/migrations/YYYYMMDDHHmmss-<description>.ts` and edit it. Don't use `sequelize-cli migration:generate`: it creates a CommonJS `.js` file that fails in this ESM project.
2. Write the ENUM values out in the migration; don't import app code (migrations run on plain Node and must stay a fixed snapshot).
3. Update the model and `docs/database-design.md` to match.
4. `npm run db:migrate`. Never edit a migration that already ran; add a new one.

## Adding a message to a service

1. Add the pattern to `libs/shared/src/patterns.ts`, e.g. `EMPLOYEE_PATTERNS.FIND_ALL`.
2. Handle it in the service's controller with `@MessagePattern(EMPLOYEE_PATTERNS.FIND_ALL)`.
3. Call it from the gateway with `client.send(EMPLOYEE_PATTERNS.FIND_ALL, payload)`, injecting the client via `@Inject(SERVICE_CLIENTS.employee)`.
