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
npm run start:dev       # all four apps in watch mode
```

Check that everything is up: http://localhost:3000/health returns each service's status. If a service is down, the gateway still answers, with `"status": "degraded"`.

Run a single app instead (e.g. while working on one service):

```bash
npx nest start auth --watch --env-file .env
```

## Database

On first start, MySQL creates one database per service (`dexa_auth`, `dexa_employee`, `dexa_attendance`) and grants `DB_USER` access to each (see `docker/mysql/init/`).
The init script runs only when the data volume is empty. After changing DB names or credentials in `.env`, reset it with `docker compose down -v` (this **deletes all local DB data**).

Stop MySQL with `docker compose down` (data is kept).

## Commands

| Action | Command |
|--------|---------|
| Dev (all apps, watch) | `npm run start:dev` |
| Build all apps | `npm run build` |
| Run built apps | `npm run start:prod` |
| Type check | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| E2E tests | `npm run test:e2e` |

## Adding a message to a service

1. Add the pattern to `libs/shared/src/patterns.ts`, e.g. `EMPLOYEE_PATTERNS.FIND_ALL`.
2. Handle it in the service's controller with `@MessagePattern(EMPLOYEE_PATTERNS.FIND_ALL)`.
3. Call it from the gateway with `client.send(EMPLOYEE_PATTERNS.FIND_ALL, payload)`, injecting the client via `@Inject(SERVICE_CLIENTS.employee)`.
