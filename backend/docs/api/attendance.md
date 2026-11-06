# Attendance API

WFH attendance of the logged-in employee: check in and check out with a photo as proof, see today's status and the own history. HR (`ADMIN`) uses the same endpoints for their own attendance, and has a **read-only** monitoring list of everyone's attendance. Nobody can edit or approve attendance.

| | |
|---|---|
| Base URL (dev) | `http://localhost:3000` |
| Auth | `Authorization: Bearer <access_token>` on every endpoint (see [Auth API](auth.md)) |
| Response body | Always `{ status, message, data? }`, see [Auth API → Response format](auth.md#response-format). **Exception**: a successful `GET /attendance/:id/photo` returns the image itself |
| Field names | `snake_case` |

## Endpoints

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| `POST` | [`/attendance/check-in`](#post-attendancecheck-in) | any logged-in user | Start the working day, with a photo |
| `POST` | [`/attendance/check-out`](#post-attendancecheck-out) | any logged-in user | End the working day, with a photo |
| `GET` | [`/attendance/me/today`](#get-attendancemetoday) | any logged-in user | Today's check-in / check-out (which button to show) |
| `GET` | [`/attendance/me`](#get-attendanceme) | any logged-in user | Own attendance history, one item per day |
| `GET` | [`/attendance`](#get-attendance) | ADMIN | HR monitoring: everyone's days, today by default |
| `GET` | [`/attendance/:id/photo`](#get-attendanceidphoto) | owner or ADMIN | The photo of one check-in / check-out |

The employee always comes from the token, and the time is always the server's: neither can be sent by the client.

---

## Rules

| Rule | Error |
|------|-------|
| The **working day** is the date in **Asia/Jakarta** (WIB, UTC+7) when the server receives the request. 00:30 WIB counts for the new day | — |
| Check-in: at most once per day | `409 You have already checked in today` |
| Check-out: only after a check-in on the **same** working day | `400 You have not checked in today` |
| Check-out: at most once per day | `409 You have already checked out today` |
| Both need a photo: JPEG, PNG or WebP, at most `UPLOAD_MAX_SIZE_MB` (default 5 MB). The type is read from the file's bytes, not from its name or `Content-Type` | `400` / `413` |
| The employee must be `ACTIVE`. A deactivated or deleted login is already refused on every request (`401`, see [Auth API → Rules](auth.md#rules-for-all-protected-endpoints)); check-in / check-out also check the employee record itself | `403 Your employee record is inactive. Please contact HR.` |

A check-in at 23:00 and a check-out at 01:00 the next day are on two different working days: the check-out is refused. Night shifts are out of scope for this test.

---

## Objects

### Attendance object

One check-in or check-out.

```json
{
  "id": "3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c",
  "employee_id": "d0c05509-fcfd-4041-a6bf-1a2121e13929",
  "type": "CHECK_IN",
  "attendance_date": "2026-11-06",
  "recorded_at": "2026-11-06T01:05:12.345Z",
  "notes": "Working from home today",
  "photo": {
    "mime": "image/jpeg",
    "size": 183245,
    "url": "/attendance/3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c/photo"
  }
}
```

| Field | Description |
|-------|-------------|
| `type` | `CHECK_IN` or `CHECK_OUT` |
| `attendance_date` | `YYYY-MM-DD`, the working day in Asia/Jakarta |
| `recorded_at` | ISO 8601 in UTC, set by the server. Show it in local time (`01:05Z` = 08:05 WIB) |
| `notes` | Optional text from the employee, or `null` |
| `photo.mime` | `image/jpeg`, `image/png` or `image/webp` (detected from the file) |
| `photo.size` | Bytes |
| `photo.url` | Path on the gateway. Needs the `Authorization` header, so an `<img src>` can't load it directly: fetch it as a blob (see [the photo endpoint](#get-attendanceidphoto)) |

Where the file is stored on the server is never returned.

### Attendance day object

One employee's working day.

```json
{
  "employee_id": "d0c05509-fcfd-4041-a6bf-1a2121e13929",
  "attendance_date": "2026-11-06",
  "check_in": { "...": "Attendance object" },
  "check_out": null,
  "work_minutes": null
}
```

| Field | Description |
|-------|-------------|
| `check_in` / `check_out` | Attendance object, or `null` if not done (yet) |
| `work_minutes` | Whole minutes from check-in to check-out; `null` until both exist |

A day with a check-in and no check-out is either still in progress (today) or a forgotten check-out (earlier days).

---

## `POST /attendance/check-in`

**Any logged-in user.** Body is **`multipart/form-data`**, not JSON:

| Field | Type | Rules |
|-------|------|-------|
| `photo` | file | **Required.** JPEG, PNG or WebP, at most `UPLOAD_MAX_SIZE_MB` (default 5 MB). The frontend takes it with the browser camera |
| `notes` | text | Optional, up to 255 characters, trimmed. Empty becomes `null` |

Any other field (for example `recorded_at` or `employee_id`) is rejected with `400`.

```bash
curl -s -X POST http://localhost:3000/attendance/check-in \
  -H "Authorization: Bearer $TOKEN" \
  -F "photo=@selfie.jpg" \
  -F "notes=Working from home today"
```

In the browser, send a `FormData` and let the browser set the `Content-Type` (it adds the multipart boundary):

```ts
const form = new FormData()
form.append('photo', blob, 'selfie.jpg')
form.append('notes', 'Working from home today')
```

### Response `201 Created`

```json
{
  "status": 201,
  "message": "Checked in",
  "data": { "...": "Attendance object, type CHECK_IN" }
}
```

### Errors

| Status | `message` | When |
|--------|-----------|------|
| `400` | `photo is required` | No `photo` file, an empty file, or the body is not multipart |
| `400` | `photo must be a JPEG, PNG or WebP image` | The file's bytes are not one of these types, whatever its name or `Content-Type` says |
| `400` | `Unexpected field` | A file sent under another field name than `photo`, or a second file |
| `400` | `Validation failed`, e.g. `data.errors: ["notes must be shorter than or equal to 255 characters"]` | Invalid `notes`, or an unknown field (`property recorded_at should not exist`) |
| `401` | `Login required` (or another token error) | Missing or invalid token |
| `403` | `Please change your password before continuing.` | The user still has a temporary password |
| `403` | `Your employee record is inactive. Please contact HR.` | The employee was deactivated or deleted after the token was issued |
| `409` | `You have already checked in today` | A check-in already exists for today |
| `413` | `File too large` | The photo is bigger than `UPLOAD_MAX_SIZE_MB` |
| `503` | `Service is temporarily unavailable. Please try again.` | The attendance or employee service is down |

---

## `POST /attendance/check-out`

**Any logged-in user.** Same body, response shape and photo errors as [check-in](#post-attendancecheck-in).

### Response `201 Created`

```json
{
  "status": 201,
  "message": "Checked out",
  "data": { "...": "Attendance object, type CHECK_OUT" }
}
```

### Errors

The check-in errors (except its `409`), plus:

| Status | `message` | When |
|--------|-----------|------|
| `400` | `You have not checked in today` | No check-in for today's working day |
| `409` | `You have already checked out today` | A check-out already exists for today |

---

## `GET /attendance/me/today`

**Any logged-in user.** The caller's current working day (Asia/Jakarta). Use it to decide which button to show: no `check_in` → Check in; `check_in` without `check_out` → Check out; both → done for today.

### Response `200 OK`

```json
{
  "status": 200,
  "message": "Today's attendance",
  "data": {
    "employee_id": "d0c05509-fcfd-4041-a6bf-1a2121e13929",
    "attendance_date": "2026-11-06",
    "check_in": { "...": "Attendance object" },
    "check_out": null,
    "work_minutes": null
  }
}
```

Before checking in, `check_in` and `check_out` are both `null`: the response is still `200`.

---

## `GET /attendance/me`

**Any logged-in user.** The caller's own history, **one item per working day**, newest first. Days without any check-in are not listed (no "absent" rows).

### Query parameters

| Param | Default | Rules |
|-------|---------|-------|
| `page` | `1` | Whole number ≥ 1 |
| `limit` | `10` | Whole number 1–100. Counts days, not single check-ins |
| `date_from` | — | `YYYY-MM-DD`, inclusive |
| `date_to` | — | `YYYY-MM-DD`, inclusive. Not before `date_from` |

```bash
curl -s "http://localhost:3000/attendance/me?date_from=2026-11-01&date_to=2026-11-30" -H "Authorization: Bearer $TOKEN"
```

### Response `200 OK`

```json
{
  "status": 200,
  "message": "My attendance",
  "data": {
    "items": [
      {
        "employee_id": "d0c05509-fcfd-4041-a6bf-1a2121e13929",
        "attendance_date": "2026-11-06",
        "check_in": { "...": "Attendance object" },
        "check_out": { "...": "Attendance object" },
        "work_minutes": 545
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 4, "total_pages": 1 }
  }
}
```

### Errors

| Status | `message` | When |
|--------|-----------|------|
| `400` | `Validation failed`, e.g. `data.errors: ["date_from must be a valid date"]` | Invalid query (`date_to must be a date in YYYY-MM-DD format`, `limit must not be greater than 100`, `page must be a whole number`) |
| `400` | `date_from must not be after date_to` | Reversed range |

---

## `GET /attendance`

**ADMIN.** HR monitoring, **read only**: everyone's working days, one item per employee per day. Newest date first; within a date, whoever checked in first. Only employees who checked in appear: there are no "absent" rows. Deleted attendance records are hidden; deleted employees' records are still shown, with their name.

### Query parameters

| Param | Default | Rules |
|-------|---------|-------|
| `date_from` | today | `YYYY-MM-DD`, inclusive, working day in Asia/Jakarta. **Without `date_from` and `date_to` the list shows today.** With only one of them, the other side is open (e.g. `date_from` alone = from that day until now) |
| `date_to` | today | `YYYY-MM-DD`, inclusive. Not before `date_from` |
| `department_id` | — | Department UUID (the employee's **current** department) |
| `search` | — | Up to 100 characters, trimmed. Partial, case-insensitive match on employee name, employee code or email, same as `GET /employees` |
| `page` | `1` | Whole number ≥ 1 |
| `limit` | `10` | Whole number 1–100. Counts days |

```bash
curl -s "http://localhost:3000/attendance?date_from=2026-11-01&date_to=2026-11-30&department_id=d0000000-0000-4000-8000-000000000002&search=budi" \
  -H "Authorization: Bearer $TOKEN"
```

### Response `200 OK`

```json
{
  "status": 200,
  "message": "Attendance",
  "data": {
    "items": [
      {
        "employee_id": "d0c05509-fcfd-4041-a6bf-1a2121e13929",
        "attendance_date": "2026-11-06",
        "check_in": { "...": "Attendance object" },
        "check_out": { "...": "Attendance object" },
        "work_minutes": 545,
        "employee": {
          "id": "d0c05509-fcfd-4041-a6bf-1a2121e13929",
          "employee_code": "EMP-0002",
          "full_name": "Budi Santoso",
          "department": { "id": "d0000000-0000-4000-8000-000000000002", "name": "Engineering" },
          "status": "ACTIVE",
          "is_deleted": false
        }
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 1, "total_pages": 1, "date_from": "2026-11-06", "date_to": "2026-11-06" }
  }
}
```

| Field | Description |
|-------|-------------|
| `employee` | Who the day belongs to, read from the employee service. `status` and `department` are the employee's **current** values. `is_deleted: true` for an employee deleted later. `null` only if the employee record doesn't exist at all |
| `meta.date_from` / `meta.date_to` | The range actually used: today's date when none was sent, `null` for an open side. Show it above the list ("Showing 6 Nov 2026") |

HR opens photos with [`GET /attendance/:id/photo`](#get-attendanceidphoto), which allows ADMIN for every record.

### Errors

| Status | `message` | When |
|--------|-----------|------|
| `400` | `Validation failed`, e.g. `data.errors: ["department_id must be a valid id"]` | Invalid query (same date and paging rules as [`GET /attendance/me`](#get-attendanceme), plus `search must be shorter than or equal to 100 characters`) |
| `400` | `date_from must not be after date_to` | Reversed range |
| `403` | `You do not have permission to do this.` | Caller is not ADMIN |

An unknown `department_id`, or a search that matches nobody, is not an error: the list is empty.

### How the list is built

The attendance database stores only `employee_id`; names and departments belong to the employee service. The gateway combines them:

1. `department_id` or `search` sent → `employee.find-ids` returns the matching employee ids (deleted employees included).
2. `attendance.list-days` returns one page of days for those ids (or everyone) in the date range.
3. `employee.find-by-ids` returns the names of the employees on that page, in **one** call (not one per row).

Names are never copied into `attendances`, so a renamed employee shows the new name on old records too.

---

## `GET /attendance/:id/photo`

**The owner of the record, or an ADMIN.** Returns the **image bytes**, not JSON:

| Header | Value |
|--------|-------|
| `Content-Type` | `image/jpeg`, `image/png` or `image/webp` |
| `Content-Disposition` | `inline` |
| `Cache-Control` | `private, max-age=3600` (the browser may cache it; shared caches may not) |
| `X-Content-Type-Options` | `nosniff` |

Errors are JSON in the usual envelope.

```bash
curl -s http://localhost:3000/attendance/3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c/photo -H "Authorization: Bearer $TOKEN" -o photo.jpg
```

An `<img src>` can't send the token, so the frontend fetches the photo with the API client as a blob and shows it with `URL.createObjectURL(blob)`.

### Errors

| Status | `message` | When |
|--------|-----------|------|
| `400` | `Validation failed (uuid is expected)` | `:id` is not a UUID |
| `404` | `Attendance not found` | Unknown id, **or** the record belongs to someone else and the caller is not ADMIN (same answer, so ids can't be probed) |
| `404` | `Photo not found` | The record exists but its file is missing on the server (logged for a fix) |

---

## How it works

```
browser ──multipart──▶ gateway :3000                                  attendance :3003
                        1. JwtAuthGuard / SessionGuard / PasswordChangeGuard / RolesGuard
                        2. multer reads the file into memory (413 if too big)
                        3. PhotoFilePipe: file present? real JPEG/PNG/WebP?
                        4. employee.find-one ──TCP──▶ employee :3002 (ACTIVE?)
                        5. save to UPLOAD_DIR/attendance/YYYY/MM/<uuid>.<ext>
                        6. attendance.record ──TCP──────────────────────▶ day rules, INSERT
                        7. refused? remove the saved file, return the error
```

- Only the path and metadata travel over TCP, not the image (TCP messages stay small).
- The file name is a new UUID; the uploaded name is never used.
- If the attendance service is unreachable or times out (`503`), the file is **kept**: after a timeout the record may have been stored anyway, and an orphan file is the lesser problem.
- Two simultaneous check-ins: the unique key `(employee_id, attendance_date, type, not_deleted)` lets only one in; the other gets `409`.

Service messages (gateway → attendance service, `libs/shared/src/patterns.ts`):

| Pattern | Payload | Reply |
|---------|---------|-------|
| `attendance.record` | `{ employee_id, type, photo_path, photo_mime, photo_size, notes }` | Attendance record (without `photo.url`) |
| `attendance.today` | `{ employee_id }` | Attendance day |
| `attendance.list-days` | `{ page, limit, employee_ids?, date_from?, date_to? }` | `{ items: AttendanceDay[], total }` |
| `attendance.find-photo` | `{ id, viewer_employee_id, viewer_is_admin }` | `{ photo_path, photo_mime }` |

Gateway → employee service, for `GET /attendance`:

| Pattern | Payload | Reply |
|---------|---------|-------|
| `employee.find-ids` | `{ search?, department_id? }` | `string[]`: matching employee ids, deleted employees included |
| `employee.find-by-ids` | `{ ids }` | `EmployeeSummary[]`: `{ id, employee_code, full_name, department, status, is_deleted }`; unknown ids are left out |
