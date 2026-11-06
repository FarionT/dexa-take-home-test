# Auth API

Login, current user and password change. All requests go to the **gateway**, which forwards them to the auth service over TCP.

| | |
|---|---|
| Base URL (dev) | `http://localhost:3000` (`PORT` in `backend/.env`) |
| Format | JSON in, JSON out (`Content-Type: application/json`) |
| Field names | `snake_case` everywhere (`access_token`, `must_change_password`) |
| Response body | Always `{ status, message, data? }`, see [Response format](#response-format) |
| Auth | `Authorization: Bearer <access_token>` on every endpoint not marked **public** |

## Response format

Every response, success or error, has the same envelope:

```json
{
  "status": 200,
  "message": "Login successful",
  "data": { }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | number | Same as the HTTP status code |
| `message` | string | Human-readable summary, safe to show to the user |
| `data` | object | The result. **Left out** when there is nothing to return (most errors) |

Errors use the same fields. Validation errors list every problem in `data.errors`:

```json
{ "status": 401, "message": "Invalid email or password" }
```

```json
{
  "status": 400,
  "message": "Validation failed",
  "data": {
    "errors": ["email must be a valid email address", "password is required"]
  }
}
```

Responses never contain internal details (hosts, ports, stack traces); those go to the server log. An unexpected server error is always `{ "status": 500, "message": "Something went wrong. Please try again." }`.

## Endpoints

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| `POST` | [`/auth/login`](#post-authlogin) | public | Exchange email + password for an access token |
| `GET` | [`/auth/me`](#get-authme) | any logged-in user | The current user |
| `POST` | [`/auth/change-password`](#post-authchange-password) | any logged-in user | Set a new password; returns a new token |

---

## `POST /auth/login`

**Public.** Checks the email and password and returns an access token.

### Request

```json
{
  "email": "hradmin@company.com",
  "password": "password123!"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Required. Valid email, max 255 characters. Trimmed and lowercased by the server, so `" HRAdmin@Company.com "` works |
| `password` | string | Required. At most 72 bytes (bcrypt's limit). No other rules at login |

Any other field is rejected (`property role should not exist`).

### Response `200 OK`

```json
{
  "status": 200,
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "id": "a0000000-0000-4000-8000-000000000001",
      "employee_id": "e0000000-0000-4000-8000-000000000001",
      "email": "hradmin@company.com",
      "role": "ADMIN",
      "must_change_password": false,
      "last_login_at": "2026-11-06T06:30:10.159Z"
    }
  }
}
```

`data` fields:

| Field | Description |
|-------|-------------|
| `access_token` | JWT to send as `Authorization: Bearer <access_token>` |
| `token_type` | Always `"Bearer"` |
| `expires_in` | Token lifetime in **seconds** (`JWT_EXPIRES_IN`, default `1d` = `86400`) |
| `user` | See [User object](#user-object). `last_login_at` is this login's time |

If `data.user.must_change_password` is `true`, the client must send the user to change their password first: every other endpoint returns `403` until then (see [First login with a generated password](#first-login-with-a-generated-password)).

### Errors

| Status | `message` | When |
|--------|-----------|------|
| `400` | `Validation failed`, problems in `data.errors`, e.g. `["email must be a valid email address", "password is required"]` | Invalid body |
| `401` | `Invalid email or password` | Unknown email **or** wrong password (deliberately the same, see [Security notes](#security-notes)) |
| `403` | `This account is deactivated. Please contact HR.` | Correct password, but the account is deactivated |
| `503` | `Service is temporarily unavailable. Please try again.` | Auth service down or not answering within 5 s |

### Example

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"hradmin@company.com","password":"password123!"}'
```

---

## `GET /auth/me`

**Any logged-in user**, including users who still have to change their password. Returns the current user, read fresh from the database (so it reflects a deactivation immediately, unlike the token).

### Request

No body. The user comes from the token; query parameters such as `?user_id=…` are ignored.

```bash
curl -s http://localhost:3000/auth/me -H "Authorization: Bearer $TOKEN"
```

### Response `200 OK`

`data` is a [User object](#user-object):

```json
{
  "status": 200,
  "message": "Current user",
  "data": {
    "id": "a0000000-0000-4000-8000-000000000001",
    "employee_id": "e0000000-0000-4000-8000-000000000001",
    "email": "hradmin@company.com",
    "role": "ADMIN",
    "must_change_password": false,
    "last_login_at": "2026-11-06T06:30:10.000Z"
  }
}
```

### Errors

| Status | `message` | When |
|--------|-----------|------|
| `401` | `Login required` | No `Authorization` header, or not `Bearer <token>` |
| `401` | `Your session has expired or is invalid. Please log in again.` | Token expired, tampered with, or signed with another secret |
| `401` | `Your session is no longer valid. Please log in again.` | Valid token, but the user was deactivated or deleted since |
| `503` | `Service is temporarily unavailable. Please try again.` | Auth service down |

---

## `POST /auth/change-password`

**Any logged-in user**, including users who still have to change their password. Checks the current password, stores the new one, and returns a **new token**. The old token keeps working until it expires, but it may still say `must_change_password: true`, so the client should switch to the new one.

### Request

```json
{
  "current_password": "Generated9x",
  "new_password": "BudiPass2026"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `current_password` | string | Required, at most 72 bytes |
| `new_password` | string | Required. At least 8 characters, at most 72 bytes, at least one letter and one number. Must differ from the current password |

### Response `200 OK`

Same `data` as [login](#response-200-ok), with `"message": "Password changed"`: a new `access_token`, and `data.user.must_change_password` is now `false`.

### Errors

| Status | `message` | When |
|--------|-----------|------|
| `400` | `Validation failed`, problems in `data.errors`, e.g. `["new_password must contain a number", "new_password must be at least 8 characters"]` | New password breaks the rules |
| `400` | `Current password is incorrect` | Wrong `current_password` |
| `400` | `New password must be different from the current one` | Same password again |
| `401` | see [`GET /auth/me`](#errors-1) | Missing, invalid or expired token; user deactivated |
| `503` | `Service is temporarily unavailable. Please try again.` | Auth service down |

`current_password` being wrong is a `400`, not a `401`: the user is logged in, only the form value is wrong, so the client should show the error instead of logging out.

### Example

```bash
curl -s -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"current_password":"Generated9x","new_password":"BudiPass2026"}'
```

---

## Objects

### User object

Never contains the password or its hash.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | User id (`dexa_auth.users.id`) |
| `employee_id` | string (UUID) | The employee this login belongs to. Every user is an employee, HR included |
| `email` | string | Login email, lowercase |
| `role` | `"ADMIN"` \| `"EMPLOYEE"` | `ADMIN` = HR. ADMIN can also use every EMPLOYEE endpoint |
| `must_change_password` | boolean | `true` while the user still has a system-generated password |
| `last_login_at` | string (ISO 8601, UTC) \| `null` | Last successful login |


### Token (JWT) claims

The `access_token` is a JWT signed with `HS256` and `JWT_SECRET`. Clients may decode it (e.g. to read `exp`), but must not trust it for anything security-related: the server checks it on every request.

```json
{
  "sub": "a0000000-0000-4000-8000-000000000001",
  "employee_id": "e0000000-0000-4000-8000-000000000001",
  "role": "ADMIN",
  "must_change_password": false,
  "iat": 1793946610,
  "exp": 1794033010
}
```

| Claim | Description |
|-------|-------------|
| `sub` | User id |
| `employee_id` | Employee id; endpoints use it for "my" data (e.g. my attendance) |
| `role` | `ADMIN` or `EMPLOYEE` at login time |
| `must_change_password` | See [First login with a generated password](#first-login-with-a-generated-password) |
| `iat` / `exp` | Issued at / expires at (Unix seconds) |

## Rules for all protected endpoints

These apply to every endpoint in the API, not only `/auth/*`. Checked in this order:

| # | Check | Failure |
|---|-------|---------|
| 1 | Valid `Authorization: Bearer <token>` (signature, expiry, claims) | `401` |
| 2 | If `must_change_password` is `true`, only `/auth/me` and `/auth/change-password` are allowed | `403 Please change your password before continuing.` |
| 3 | The endpoint's required role. `ADMIN` passes `EMPLOYEE` checks too | `403 You do not have permission to do this.` |

Public endpoints (`POST /auth/login`, `GET /health`) skip all three.

## Flows

### Normal login

```
POST /auth/login → 200 { data: { access_token, user } }
store data.access_token; send it as "Authorization: Bearer …" on every request
any 401 → token expired or session ended → show the login page
```

### First login with a generated password

New employees get a system-generated password from HR (created with the employee, coming with the employee feature).

```
POST /auth/login → 200, data.user.must_change_password = true
   any other endpoint → 403 "Please change your password before continuing."
POST /auth/change-password { current_password: <generated>, new_password } → 200 { data: { new access_token } }
replace the stored token with the new one → normal use
```

### Logout

Tokens are stateless, so logout is client-side: delete the stored token. A token stays valid until `exp`. See [Known limitations](#known-limitations).

## Security notes

- **Passwords** are stored only as bcrypt hashes (`bcryptjs`, cost 12) and never returned or logged. Passwords over 72 bytes are rejected rather than silently cut (bcrypt ignores everything after 72 bytes).
- **No account probing**: an unknown email and a wrong password return the same `401` and take about the same time (bcrypt runs against a dummy hash when the email doesn't exist). The "deactivated" `403` only appears after a correct password.
- **Identity comes from the token**: endpoints use the token's `sub` / `employee_id`, never ids from the body, URL or query.
- **Unknown fields are rejected** (`400`), so a client can't sneak in fields like `role`.

## Known limitations

- **No token revocation**: a token stays valid until it expires (`JWT_EXPIRES_IN`, default 1 day), even after logout. Deactivation is checked by `GET /auth/me` and `POST /auth/change-password`, but other endpoints rely on the token alone. Production would use short-lived tokens plus refresh tokens.
- **No login rate limiting yet**: repeated wrong passwords are only slowed by bcrypt. Production would add `@nestjs/throttler` or similar on `POST /auth/login`.
- **Role changes apply at the next login**: the role is copied into the token when it is issued.

## TypeScript types (for the frontend)

The same shapes the backend uses (`backend/libs/shared/src/auth.ts`). The frontend keeps its own copy (folders don't share code).

```ts
export type Role = 'ADMIN' | 'EMPLOYEE';

export interface AuthUser {
  id: string;
  employee_id: string;
  email: string;
  role: Role;
  must_change_password: boolean;
  last_login_at: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResult {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: AuthUser;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

/** Every response body: success and error. */
export interface ApiResponse<T = undefined> {
  status: number;
  message: string;
  data?: T;
}

/** `data` of a 400 validation error. */
export interface ValidationErrorData {
  errors: string[];
}

// e.g. POST /auth/login -> ApiResponse<LoginResult>, GET /auth/me -> ApiResponse<AuthUser>
```
