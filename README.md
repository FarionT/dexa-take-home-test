# dexa-take-home-test

Fullstack take-home test: a WFH employee attendance app (employees log in and clock in with a photo) and an HR admin app (manage employee data, view attendance).

| Folder | Stack |
|--------|-------|
| [`backend/`](backend/) | NestJS 12 + TypeScript (microservices monorepo), MySQL 8.4, Sequelize |
| [`frontend/`](frontend/) | React + Vite + TypeScript |

## Architecture

```
Browser ──HTTP──▶ gateway    :3000 ──TCP──▶ auth       :3001 ─▶ dexa_auth
                                    ──TCP──▶ employee   :3002 ─▶ dexa_employee
                                    ──TCP──▶ attendance :3003 ─▶ dexa_attendance
```

The backend is four NestJS apps in one monorepo: an HTTP **gateway** (the only entry point for the frontend) and three **TCP microservices**. Each service runs as its own process and owns its own database. If one service goes down, the others keep working. See [`backend/README.md`](backend/README.md).

## Tech choices

- **MySQL**: listed as a preferred database in the brief, and the data (employees, credentials, attendance records) is plainly relational.
- **Microservices** because the brief asks for it. At this scale a single modular NestJS app would normally be enough; the split is kept light (NestJS built-in TCP transport, no message broker).
- **One database per service** (`dexa_auth`, `dexa_employee`, `dexa_attendance`): each service owns its data; services never read each other's tables.
- **Sequelize** as the ORM, with TypeScript migrations run by `sequelize-cli` and soft delete (`paranoid`) on every table. Schema: [`backend/docs/database-design.md`](backend/docs/database-design.md).
- **Photos** are stored as files; the database keeps only the file path and metadata.

## Requirements

- Node.js 22.18+
- Docker (Docker Desktop on macOS/Windows)

Default ports: MySQL `3306`, gateway `3000`, services `3001`–`3003`, frontend `5173`.

## Running locally

### 1. Database

```bash
cd backend
cp .env.example .env   # change the passwords and JWT_SECRET
docker compose up -d
```

On first start MySQL creates the three databases and grants `DB_USER` access to them. This only runs when the data volume is empty. If you change DB names or credentials later, reset with `docker compose down -v` (deletes all local DB data).

### 2. Backend

```bash
cd backend
npm install
npm run db:migrate     # create the tables
npm run db:seed        # 3 departments + the first HR admin (SEED_ADMIN_* in .env)
npm run start:dev      # all four apps; gateway on http://localhost:3000
```

Check http://localhost:3000/health: it shows whether each service and its database are up.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

Log in with the seeded HR admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `backend/.env`). See [`frontend/README.md`](frontend/README.md) for pages, structure and how auth works.

## Trade-offs and production extras

Deliberate choices for the scope of this test, and what a production system would add.

| Area | This project | In production |
|------|--------------|---------------|
| Architecture | Four NestJS apps (gateway + 3 TCP services), because the brief asks for microservices | At this size a single modular app is simpler; split services only when teams or scaling need it |
| Writes across two services | Fixed order with an **undo step** if the second service refuses (e.g. create employee, then login); a failed undo is logged as `MANUAL FIX NEEDED` | An outbox + message queue with retries, idempotent handlers and a dead-letter queue, so the second step finishes once the service is back |
| Service down or slow | One try, 5 s timeout, then `503` | Retries with backoff for safe calls, a circuit breaker, several instances behind a load balancer |
| Login protection | Same `401` for wrong email and password, bcrypt cost 12, **no rate limiting** | Rate limit `POST /auth/login` by IP + email (plus a looser per-IP cap), behind a correctly configured proxy |
| Sessions | JWT in `localStorage` (1 day); the gateway checks the login on every request, so deleting, deactivating or demoting a user applies at once | `HttpOnly` cookie with CSRF protection, short access tokens with refresh tokens, revoking tokens on logout and password change |
| Time zones | One company time zone: every working day and time is **WIB** (Asia/Jakarta) | A time zone per employee, and shifts for work that crosses midnight |
| Attendance photo | Browser camera first; file upload only when no camera can be used (the record doesn't say which) | Store the photo source for HR, add face match / liveness and location if needed |
| Photo storage | Files on the gateway's disk (`UPLOAD_DIR`), served only through an authenticated endpoint | Object storage (e.g. S3) with signed URLs, and a cleanup job for orphan files |
| HR approval | None: HR has **read-only** access to attendance, as the brief says | Correction and leave requests with an approval flow |
| Concurrent edits | Only changed fields are sent; if two HR users change the same field, the last save wins | Optimistic locking (`updated_at` check → `409`) |
| Tests | Backend: unit + e2e tests (vitest); frontend checked by hand in the browser | Frontend unit tests (Vitest + Testing Library) and a few end-to-end tests (Playwright) |
| Running it | MySQL in Docker; the apps run with `npm` | A Dockerfile per app so `docker compose up` starts everything; CI running lint, type check, tests and build |

## Useful commands

| Action | `backend/` | `frontend/` |
|--------|-----------|-------------|
| Type check | `npx tsc --noEmit` | `npx tsc -b` |
| Lint | `npm run lint` | `npm run lint` |
| Unit tests | `npm test` | — |
| E2E tests | `npm run test:e2e` | — |
| Build | `npm run build` | `npm run build` |

Stop the database with `docker compose down` (inside `backend/`); data is kept.
