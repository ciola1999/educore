# Phase 1 API Contract

Dokumen ini merangkum endpoint backend phase 1 yang saat ini siap dipakai untuk UI.

## Response Shape

Semua endpoint phase 1 mengikuti pola:

```json
{ "success": true, "data": ... }
```

atau

```json
{ "success": false, "error": "Pesan error", "code": "OPTIONAL_CODE" }
```

## Auth Notes

- Semua endpoint memakai session login web.
- `401` berarti user belum login / sesi invalid.
- `403` berarti user login tetapi tidak punya permission.
- Untuk phase 1, permission utama:
  - `users:*` untuk teacher management
  - `academic:*` untuk class/subject
  - `attendance:*` untuk attendance
  - `settings:manage` untuk sync settings

## Teachers

### `GET /api/teachers`

Query:
- `search`
- `role`: `super_admin | admin | teacher | staff`
- `sortBy`: `fullName | email | createdAt`
- `sortOrder`: `asc | desc`

Success:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "fullName": "Guru A",
      "email": "guru@example.com",
      "role": "teacher"
    }
  ]
}
```

### `POST /api/teachers`

Body:

```json
{
  "fullName": "Guru A",
  "email": "guru@example.com",
  "role": "teacher",
  "password": "secret123"
}
```

Success:

```json
{
  "success": true,
  "data": { "id": "uuid" }
}
```

Known error code:
- `EMAIL_EXISTS`
- `VALIDATION_ERROR`

### `DELETE /api/teachers/:id`

Success:

```json
{
  "success": true,
  "data": { "deleted": true }
}
```

## Classes

### `GET /api/classes`

Success:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "X-RPL-1",
      "academicYear": "2025/2026",
      "homeroomTeacherId": "uuid-or-null",
      "homeroomTeacherName": "Nama Guru"
    }
  ]
}
```

### `POST /api/classes`

Body:

```json
{
  "name": "X-RPL-1",
  "academicYear": "2025/2026",
  "homeroomTeacherId": "uuid"
}
```

Success:

```json
{
  "success": true,
  "data": { "id": "uuid" }
}
```

### `PATCH /api/classes/:id`

Body:

```json
{
  "name": "X-RPL-2",
  "academicYear": "2025/2026",
  "homeroomTeacherId": "uuid"
}
```

Success:

```json
{
  "success": true,
  "data": { "updated": true }
}
```

### `DELETE /api/classes/:id`

Success:

```json
{
  "success": true,
  "data": { "deleted": true }
}
```

## Subjects

### `GET /api/subjects`

Success:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Matematika",
      "code": "MTK-X"
    }
  ]
}
```

### `POST /api/subjects`

Body:

```json
{
  "name": "Matematika",
  "code": "MTK-X"
}
```

Success:

```json
{
  "success": true,
  "data": { "created": true }
}
```

### `PATCH /api/subjects/:id`

### `DELETE /api/subjects/:id`

Response success sama seperti class mutation:

```json
{
  "success": true,
  "data": { "updated": true }
}
```

atau

```json
{
  "success": true,
  "data": { "deleted": true }
}
```

## Attendance

### `GET /api/attendance/classes`

Dipakai untuk dropdown kelas attendance.

Success:

```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "X-RPL-1" }
  ]
}
```

### `GET /api/attendance/students?classId=...&date=YYYY-MM-DD`

Dipakai untuk daftar siswa attendance manual.

Special case:
- `classId=all` hanya valid untuk baca daftar, bukan untuk submit bulk manual.

Success:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "nis": "12345",
      "fullName": "Siswa A",
      "grade": "X-RPL-1",
      "status": "present",
      "notes": "",
      "checkInTime": null,
      "checkOutTime": null,
      "isLocked": false
    }
  ]
}
```

### `POST /api/attendance/bulk`

Body:

```json
{
  "classId": "uuid",
  "date": "2026-03-18",
  "records": [
    {
      "studentId": "uuid",
      "status": "present",
      "notes": ""
    }
  ]
}
```

Success:

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Data absensi berhasil disimpan (1 siswa)"
  }
}
```

Catatan implementasi:
- `recordedBy` tidak perlu dikirim dari client. Backend akan override otomatis dari `session.user.id`.
- `classId=all` tidak valid untuk submit bulk manual.

### `POST /api/attendance/projection-sync`

Dipakai untuk background sync users -> students projection.

Success:

```json
{
  "success": true,
  "data": {
    "classCreated": 0,
    "studentUpserted": 0,
    "settingsSeeded": 0
  }
}
```

### `POST /api/attendance/scan`

Dipakai untuk scan QR attendance. Endpoint ini memproses payload QR di backend, bukan di client.

Body:

```json
{
  "qrData": "{\"nis\":\"2324.10.001\"}"
}
```

Success:

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Selamat pagi, Aditya!",
    "type": "CHECK_IN",
    "data": {
      "fullName": "Aditya Putra",
      "nis": "2324.10.001",
      "grade": "10-A",
      "time": "07:01",
      "status": "on-time",
      "type": "in",
      "lateMinutes": 0
    }
  }
}
```

Catatan implementasi:
- Endpoint tetap memakai wrapper response standar project.
- Result scan (`CHECK_IN`, `CHECK_OUT`, `ERROR`) dikembalikan di dalam `data`.
- Permission: `attendance:write`.

### `GET /api/attendance/today`

Dipakai untuk panel log QR hari ini.

Success:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "studentId": "uuid",
      "snapshotStudentName": "Aditya Putra",
      "snapshotStudentNis": "2324.10.001",
      "date": "2026-03-19",
      "checkInTime": "2026-03-19T00:01:00.000Z",
      "checkOutTime": null,
      "status": "PRESENT"
    }
  ]
}
```

## Sync Settings

### `POST /api/sync/full`
### `POST /api/sync/push`
### `POST /api/sync/pull`

Untuk web saat ini semua mengembalikan no-op aman:

```json
{
  "success": true,
  "data": {
    "status": "success",
    "message": "Web version is always live-to-cloud."
  }
}
```

Desktop/Tauri tetap memakai dynamic import local sync path dari client wrapper.
