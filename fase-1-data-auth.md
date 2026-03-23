# Fase 1: Fondasi Data & Authentikasi

## Overview
Fase 1 fokus membangun inti data yang akan digunakan semua modul EduCore, termasuk setup database lokal, Drizzle ORM, autentikasi, RBAC dasar, dan setup sync engine awal untuk user data. Implementasi mengikuti prinsip security-first, zero-trust, dan offline-first dengan pola arsitektur modern sesuai standar Maret 2026.

## Project Type
WEB (EduCore adalah hybrid desktop + web, tetapi untuk Fase 1 fokus pada fondasi yang bersama)

## Success Criteria
- Registrasi dan login berfungsi di web dan desktop dengan proteksi terhadap brute force, credential stuffing, dan session hijacking
- Session persist di desktop (via keychain yang terenkripsi) dan web (cookies/httpOnly dengan SameSite dan Secure flags)
- User bisa ganti password, logout, dan mengaktifkan/menonaktifkan 2FA (opsional untuk Fase 1)
- Data user tersinkronisasi antar device dengan conflict resolution yangandalan menggunakan HLC
- Semua endpoint dilindungi oleh rate limiting dan input validation yang ketat
- Aplikasi bebas dari kritis vulnerability sesuai OWASP Top 10 2024

## Tech Stack
- **Database**: SQLite dengan SQLCipher (via Tauri plugin SQL) untuk desktop, Turso (libSQL) untuk web - keduanya menggunakan enkripsi at-rest
- **ORM**: Drizzle Kit untuk migrasi dan schema management dengan type safety penuh
- **Authentication**: 
  - Desktop: Tauri plugin authenticator dengan biometric fallback atau Argon2id hash di SQLite
  - Web: NextAuth.js (Auth.js) dengan provider credentials dan dukungan untuk WebAuthn/FIDO2 (opsional)
- **Shared Logic**: Zod untuk validasi input dan Argon2id untuk password hashing
- **Sync Engine**: Hybrid Logical Clock (HLC) untuk versioning, Turso sebagai cloud DB dengan enkripsi end-to-end untuk data sensitif
- **Security**: 
  - Rate limiting pada semua endpoint auth
  - CSP headers yang ketat
  - Protection terhadap CSRF, XSS, SQL injection
  - Secure headers implementation
  - Dependency scanning dan vulnerability assessment

## File Structure
```
src/
├── core/
│   ├── db/
│   │   ├── schema.ts          # Schema awal: users, roles, permissions, user_roles, sessions, audit_logs
│   │   ├── connection.ts      # Database connection abstraction dengan connection pooling dan retry logic
│   │   └── migrations.ts      # Drizzle migrations dengan checksum verification
│   ├── services/
│   │   ├── auth-service.ts    # Auth service dengan brute force protection dan secure session management
│   │   ├── sync-service.ts    # Sync service dengan HLC dan conflict resolution
│   │   └── audit-service.ts   # Audit service untuk logging aktivitas sensitif
│   ├── sync/
│   │   ├── hlc.ts             # HLC timestamp generation dengan monotonic clock protection
│   │   └── engine.ts          # Background sync queue dengan exponential backoff dan dead letter queue
│   ├── validation/
│   │   └── schemas.ts         # Zod schemas untuk semua input dan output validation
│   ├── middleware/
│   │   ├── auth.ts            # JWT validation dan role-based access control middleware
│   │   ├── rateLimit.ts       # Rate limiting middleware dengan Redis/TurboStore backend
│   │   ├── validation.ts      # Request validation middleware menggunakan Zod
│   │   └── audit.ts           # Audit logging middleware
│   └── env.ts                 # Runtime detection utilities dengan secure defaults
├── types/
│   └── index.ts               # TypeScript types derived dari Drizzle dengan _infer utility types
├── lib/
│   ├── auth/                  # Auth utilities (argon2 hashing, session management, token utilities)
│   ├── security/              # Security utilities (helmet wrapper, rate limiting, input sanitization)
│   └── db/                    # Database utilities (transaction helpers, query builders)
├── hooks/
│   ├── use-auth.ts            # Custom hook untuk auth dengan loading states dan error boundaries
│   ├── use-sync.ts            # Hook untuk sync status dan manual trigger
│   └── use-audit.ts           # Hook untuk mengakses audit logs
├── app/
│   ├── (auth)/                # Auth routes (login, register, etc.) dengan route grouping
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── reset-password/    # Password reset flow
│   │       ├── [token]/page.tsx
│   │       └── request/page.tsx
│   ├── api/                   # API routes untuk auth dan sync
│   │   ├── auth/
│   │   │   ├── session/       # NextAuth session endpoints
│   │   │   ├── csrf/          # CSRF token endpoint
│   │   │   └── webhook/       # Webhook endpoints untuk integrasi
│   │   └── sync/              # Sync endpoints untuk delta updates
│   └── dashboard/             # Dashboard yang terproteksi dengan suspense dan error boundaries
│       ├── layout.tsx
│       └── loading.tsx        # Loading state untuk data yang belum tersinkron
├── components/
│   ├── auth/                  # Auth-specific components dengan accessibility
│   │   ├── login-form.tsx
│   │   ├── register-form.tsx
│   │   └── mfa-setup.tsx      # Multi-factor authentication setup (opsional)
│   ├── security/              # Security-related components
│   │   └── security-badge.tsx # Menampilkan status keamanan session
│   └── ui/                    # Komponen UI yang dapat digunakan kembali
└── lib/
    └── utils/                 # Utility functions dengan pure functions dan type guards
```

## Task Breakdown

### Task 1: Setup Database Lokal dan Drizzle ORM dengan Security Hardening
- **Agent**: database-architect
- **Skills**: database-design, clean-code, vulnerability-scanner
- **Priority**: P0
- **Dependencies**: None
- **INPUT**: 
  - Tauri project setup
  - Bun package manager
  - Variabel lingkungan untuk kunci enkripsi
- **OUTPUT**: 
  - SQLite database terenkripsi dengan SQLCipher menggunakan kunci yang disimpan di keychain (desktop) atau variabel lingkungan (web)
  - Schema awal Drizzle yang lengkap dengan constraints, indexes, dan audit logging
  - Migrasi pertama tergenerate dengan drizzle-kit yang termasuk verifikasi checksum
  - Database connection abstraction yang menggunakan connection pooling, retry logic, dan circuit breaker pattern
  - Implementasi row-level security untuk data sensitif (jika didukung oleh database)
- **VERIFY**: 
  - `bun run db:generate` dan `bun run db:migrate` berhasil tanpa error
  - Koneksi database berhasil di kedua environment dengan retry logic yang bekerja
  - Schema tabel terlihat di database dengan kolom yang benar (id UUID v7, version, timestamps, soft delete, audit fields)
  - Semua kolom sensitif (password hash, token) menggunakan tipe data yang sesuai dan tidak berisi plain text
  - Indexes dibuat berdasarkan pola query yang diidentifikasi dalam arsitektur
  - Constraints (NOT NULL, UNIQUE, CHECK) diterapkan untuk integritas data
  - Tidak ada hardcoded secrets dalam kode atau konfigurasi

### Task 2: Implementasi Autentikasi Desktop dengan Proteksi Lanjutan
- **Agent**: backend-specialist
- **Skills**: clean-code, api-patterns, database-design, vulnerability-scanner
- **Priority**: P1
- **Dependencies**: Task 1 (Database setup)
- **INPUT**: 
  - Database connection yang bekerja dengan security hardening
  - Schema users dengan password hash yang menggunakan argon2id dan salt per-user
- **OUTPUT**: 
  - Service autentikasi untuk desktop menggunakan Argon2id dengan memory hardness yang dapat disesuaikan
  - Integrasi dengan Tauri plugin authenticator untuk biometric login (Touch ID, Face ID, Windows Hello)
  - Protection terhadap brute force attacks dengan exponential backoff dan account lockout setelah 5 attempts gagal
  - Secure session management dengan session rotation dan invalidasi pada perubahan password
  - Endpoint/register dan login untuk desktop via Tauri commands dengan input validation yang ketat
  - Implementasi logout yang membersihkan semua data sensitif dari memory dan secure storage
  - Audit logging untuk semua aktivitas autentikasi (login berhasil/gagal, logout, perubahan password)
- **VERIFY**: 
  - Pengguna bisa register dan login di aplikasi desktop dengan atau tanpa biometric
  - Password disimpan sebagai hash argon2id dengan salt unik per user, bukan plain text
  - Session persists setelah aplikasi ditutup dan dibuka kembali dengan deteksi pencurian session
  - Account terkunci setelah 5 attempts login gagal dan membutuhkan unlock melalui email atau admin
  - Logout menghapus session dengan benar dan membersihkan semua data dari memory
  - Semua aktivitas autentikasi tercatat dalam audit log dengan timestamp dan IP address
  - Tidak ada vulnerability dalam implementasi sesuai dengan scan vulnerability-scanner

### Task 3: Implementasi Autentikasi Web (NextAuth.js) dengan Standar Industri
- **Agent**: backend-specialist
- **Skills**: clean-code, api-patterns, nodejs-best-practices, vulnerability-scanner
- **Priority**: P1
- **Dependencies**: Task 1 (Database setup)
- **INPUT**: 
  - Database connection yang bekerja dengan security hardening
  - Schema users yang sama dengan desktop dengan dukungan untuk multi-factor authentication
- **OUTPUT**: 
  - Konfigurasi NextAuth.js (Auth.js) dengan provider credentials yang menggunakan argon2id untuk password hashing
  - Implementasi CSRF protection yang otomatis untuk semua routes auth
  - Rate limiting pada endpoint auth untuk mencegah brute force dan credential stuffing
  - Secure cookie konfigurasi dengan HttpOnly, Secure, SameSite=Strict flags dan session rotation
  - Halaman login dan register di Next.js app router dengan loading states dan error boundaries
  - API route untuk auth callbacks dengan validation yang ketat menggunakan Zod
  - Implementasi session hijacking detection melalui fingerprinting browser dan IP address
  - Dukungan untuk logout dari semua perangkat melalui session invalidation di database
  - Integrasi dengan audit service untuk logging semua aktivitas autentikasi
- **VERIFY**: 
  - Pengguna bisa register dan login di browser dengan proteksi terhadap serangan umum
  - Password divalidasi dengan Zod untuk kompleksitas minimum sebelum hash dan disimpan
  - Session cookie diset dengan benar (httpOnly, secure, SameSite) dan dirotasi secara berkala
  - Redirect ke halaman yang diminta setelah login berhasil dengan deteksi kembali ke halaman yang sama
  - Route yang dilindungi tidak bisa diakses tanpa login atau dengan session yang kedaluwarsa
  - Rate limiting bekerja dengan membatasi attempts dari sama IP atau username
  - Session hijacking detection berfungsi dengan memaksa login ulang ketika fingerprint berubah signifikan
  - Semua aktivitas tercatat dalam audit log yang tidak dapat diubah

### Task 4: Implementasi RBAC Dasar dengan Prinsip Minimum Privilege
- **Agent**: backend-specialist
- **Skills**: clean-code, api-patterns, vulnerability-scanner
- **Priority**: P1
- **Dependencies**: Task 2 & 3 (Auth implementations)
- **INPUT**: 
  - Sistem autentikasi yang bekerja dengan audit logging
  - Schema roles dan user_roles dengan hierarki yang jelas
- **OUTPUT**: 
  - Seed data untuk role: admin, guru, staff, siswa, ortu dengan permission yang sesuai prinsip minimum privilege
  - Middleware/guard untuk proteksi route berdasarkan role dan permission yang granular
  - Helper function untuk check permission dan role yang dapat digunakan di service dan controller
  - Integrasi dengan service layer untuk filter data berdasarkan role dan mengembalikan error 403 untuk akses yang tidak diizinkan
  - Implementasi audit logging untuk semua akses yang ditolak dan aktivitas sensitif
  - Dukungan untuk role inheritance dan permission yang dapat ditambahkan tanpa perubahan schema besar
  - Middleware yang melindungi terhadap privilege escalation attacks
- **VERIFY**: 
  - User dengan role tertentu hanya bisa mengakses route yang sesuai dengan permission yang diberikan
  - Admin bisa mengakses semua area yang ditentukan, guru hanya kelasnya sendiri dan data terkait, dsb.
  - Attempt akses tanpa izin menghasilkan error 403 yang konsisten dan tidak bocoran informasi tentang eksistensi resource
  - Role dan permission disimpan di database dan dapat diquery melalui service dengan performa yang baik
  - Tidak ada jalan bocor untuk privilege escalation melalui manipulasi parameter atau session
  - Semua aktivitas yang terkait dengan akses data tercatat dalam audit log

### Task 5: Setup Sync Engine Awal untuk User Data dengan Keamanan End-to-End
- **Agent**: backend-specialist
- **Skills**: clean-code, api-patterns, vulnerability-scanner
- **Priority**: P2
- **Dependencies**: Task 1 (Database), Task 2 & 3 (Auth)
- **INPUT**: 
  - Database schema dengan user data yang termasuk field sensitif yang terenkripsi
  - Sistem autentikasi yang bekerja dengan session yang aman
- **OUTPUT**: 
  - Service sync dengan metode push/pull delta untuk user data yang hanya menyinkronkan data yang diperlukan
  - Integrasi dengan Turso sebagai cloud DB dengan enkripsi end-to-end untuk data sensitif menggunakan kunci yang disimpan di perangkat
  - Implementasi HLC (Hybrid Logical Clock) untuk versioning yang resistant terhadap clock skew dan clock backward
  - Conflict resolution yang menggunakan strategi Last-Write-Wins dengan timestamp yang dapat diverifikasi
  - Background sync queue yang menggunakan exponential backoff, jitter, dan dead letter queue untuk handling failure
  - Manual trigger untuk sync dengan visual feedback dan opsi untuk sync selektif
  - Implementasi selective sync untuk mengurangi penggunaan bandwidth dan mempercepat proses sinkronisasi
  - Dukungan untuk offline-first dengan antrian lokal yang disinkronkan ketika koneksi tersedia
  - Integrasi dengan audit service untuk logging semua aktivitas sync dan konflik yang terdeteksi
- **VERIFY**: 
  - Data user yang dibuat di web muncul di desktop setelah sync dengan menjaga kerahasiaan data sensitif
  - Data yang dibuat di desktop muncul di web setelah sync dengan integritas yang terjaga
  - Conflict resolution menggunakan HLC bekerja dengan benar ketika terjadi perubahan simultan
  - Sync berjalan di background tanpa blokir UI dengan penggunaan web workers atau service workers
  - Error handling untuk koneksi gagal bekerja dengan retry mechanism yang tidak mengganggu pengalaman pengguna
  - Status sync ditampilkan kepada user dengan indikator yang jelas (syncing, success, error, offline)
  - Tidak ada data sensitif yang dikirim ke server tanpa enkripsi end-to-end
  - Semua aktivitas sync tercatat dalam audit log yang dapat diverifikasi

### Task 6: Implementasi Ganti Password dan Logout dengan Security yang Ketat
- **Agent**: backend-specialist
- **Skills**: clean-code, api-patterns, vulnerability-scanner
- **Priority**: P2
- **Dependencies**: Task 2 & 3 (Auth implementations)
- **INPUT**: 
  - Sistem autentikasi yang bekerja dengan brute force protection
  - Session management yang secure dengan deteksi pencurian
- **OUTPUT**: 
  - Fitur ganti password dengan validasi Zod yang mencakup kompleksitas, panjang, dan larangan penggunaan password yang sama
  - Implementasi password history untuk mencegah reuse password terakhir N kali
  - Logout yang membersihkan session di kedua environment dengan invalidasi token di database dan client-side
  - Notifikasi berhasil/gagal melalui toast yang tidak bocoran informasi sensitif
  - Halaman settings untuk ganti password dengan konfirmasi dan dukungan untuk menunjukkan kekuatan password
  - Implementasi secure password change yang mewajibkan verifikasi password lama dan membatasi frequency perubahan
  - Dukungan untuk memaksa logout dari semua perangkat setelah perubahan password
  - Audit logging untuk semua aktivitas perubahan password dan logout
- **VERIFY**: 
  - User bisa ganti password dengan berhasil ketika memenuhi semua persyaratan keamanan
  - Password lama harus benar untuk bisa mengganti dan tidak boleh sama dengan N password terakhir
  - Setelah ganti password, session lama invalid di semua perangkat dan user harus login lagi dengan kredensial baru
  - Logout membersihkan semua data session dan redirect ke halaman login dengan membersihkan penyimpanan sensitif
  - Notifikasi tidak bocoran informasi seperti apakah password lama benar atau salah
  - Rate limiting diterapkan pada endpoint ganti password untuk mencegah brute force
  - Semua aktivitas terkait password tercatat dalam audit log yang tidak dapat diubah

## Phase X: Verification Checklist Komprehensif
Setelah semua task selesai, jalankan verifikasi berikut sesuai dengan standar Maret 2026:

### 1. Lint & Type Check
```bash
bun run lint
bun run typecheck
```

### 2. Security Scan Komprehensif
```bash
# Vulnerability scanning
python .agent/skills/vulnerability-scanner/scripts/security_scan.py .

# Dependency checking
bun run audit

# Secret scanning
git secrets --scan
```

### 3. UX & Accessibility Audit
```bash
python .agent/skills/frontend-design/scripts/ux_audit.py .
python .agent/skills/webapp-testing/scripts/playwright_runner.py . --tags @accessibility
```

### 4. Build Verification dengan Optimasi
```bash
bun run build
# Verifikasi output build untuk memastikan tidak ada informasi sensitif yang ter-expose
```

### 5. Runtime Verification dengan Penetration Testing
```bash
# Start dev server dan test manual:
bun run dev
# Test di browser: http://localhost:3000
# Test desktop: cd src-tauri && cargo tauri dev

# Jalankan penetration testing dasar
python .agent/skills/red-team-tactics/scripts/basic_pentest.py http://localhost:3000
```

### 6. Code Quality dan Standards Compliance
```bash
# Periksa kepatuhan terhadap clean-code standards
python .agent/skills/clean-code/scripts/standards_check.py .

# Verifikasi tidak ada penggunaan pola yang tidak dianjurkan
grep -r "any\|@ts-ignore\|eval\(\|setTimeout\|setInterval" src/ --exclude-dir=node_modules
```

### 7. Fase X Completion Marker
Tambahkan ini ke file rencana setelah semua check pass:
```markdown
## ✅ PHASE X COMPLETE
- Lint: ✅ Pass
- Type Check: ✅ Pass
- Security Scan: ✅ No critical issues
- Dependency Audit: ✅ No vulnerable dependencies
- UX Audit: ✅ WCAG 2.2 AA compliant
- Build: ✅ Success dengan optimasi
- Penetration Testing: ✅ No critical vulnerabilities
- Date: [Current Date]
```

## Catatan Penting untuk Implementasi Maret 2026
- Semua query harus menggunakan parameterized queries atau query builder untuk mencegah SQL injection
- Semua input harus divalidasi dan sanitasi dengan Zod di frontend dan backend menggunakan schema yang sama
- Soft delete harus diimplementasi dari awal dengan deleted_at IS NULL di semua query yang relevan
- Password harus dihash dengan Argon2id dengan parameter yang dapat disesuaikan (memory cost, time cost, parallelism)
- Session harus dihandle dengan aman menggunakan teknik yang modern (short-lived access tokens dengan refresh tokens)
- Sync engine harus menangani konflik dengan HLC yang resistant terhadap clock skew dan menggunakan vector timestamps untuk akurasi yang lebih baik
- Implementasikan prinsip least privilege di semua layanan dan komponent
- Gunakan teknik defense in depth dengan multiple layers of security
- Semua logging harus menghindari pencatatan informasi sensitif (password, token, PII)
- Implementasikan rate limiting pada semua endpoint yang sensitif
- Gunakan CSP headers yang ketat untuk mencegah XSS dan data injection
- Implementasikan security headers yang lengkap (HSTS, X-Frame-Options, X-Content-Type-Options, dll.)
- Lakukan regelmäßige security scanning dan dependency checking sebagai bagian dari CI/CD pipeline
- Pastikan semua komunikasi menggunakan HTTPS dengan certificate yang valid
- Implementasikan certificate pinning untuk komunikasi dengan Turso jika diperlukan
- Gunakan teknik seperti subresource integrity (SRI) untuk sumber daya eksternal
- Implementasikan logging yang terstruktur untuk memudahkan audit dan deteksi anomali
- Pastikan semua error message tidak bocoran informasi internal yang dapat digunakan untuk serangan