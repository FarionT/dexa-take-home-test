# dexa-take-home-test

Fullstack take-home test: a WFH employee attendance app (employees log in and clock in with a photo) and an HR admin app (manage employee data, view attendance).

| Folder | Stack |
|--------|-------|
| [`backend/`](backend/) | NestJS 12 + TypeScript, MySQL 8.4 |
| [`frontend/`](frontend/) | React + Vite + TypeScript |

## Tech choices

- **MySQL**: listed as a preferred database in the brief, and the data (employees, credentials, attendance records) is plainly relational.
- **One database per service** (`dexa_auth`, `dexa_employee`, `dexa_attendance`), following the microservices requirement: each service owns its data.
- **Photos** are stored as files; the database keeps only the file path and metadata.

## Requirements

- Node.js (v22+)
- Docker (Docker Desktop on macOS/Windows)

Default ports: MySQL `3306`, backend `3000`, frontend `5173`.

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
npm run start:dev      # http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

## Useful commands

| Action | `backend/` | `frontend/` |
|--------|-----------|-------------|
| Type check | `npx tsc --noEmit` | `npx tsc -b` |
| Lint | `npm run lint` | `npm run lint` |
| Unit tests | `npm test` | — |
| E2E tests | `npm run test:e2e` | — |
| Build | `npm run build` | `npm run build` |

Stop the database with `docker compose down` (inside `backend/`); data is kept.
