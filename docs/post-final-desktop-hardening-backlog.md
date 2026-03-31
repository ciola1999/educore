# Post-Final Desktop Hardening Backlog

Tanggal referensi: 1 April 2026

Dokumen ini memecah follow-up pasca-final menjadi backlog yang konkret. Tujuannya bukan membuka ulang blocker MSI yang sudah lolos, tetapi menurunkan residual risk dengan urutan kerja yang sehat.

## 1. Release Policy

Status saat ini:
- `MSI` = signed off
- `NSIS` = belum signed off

Action:
- [ ] tulis di release note dan channel distribusi bahwa Windows yang didukung saat ini adalah `MSI`
- [ ] treat `NSIS` sebagai track hardening terpisah
- [ ] jangan gabungkan status `MSI ready` menjadi `all Windows bundlers ready`

Definition of done:
- [ ] `NSIS` punya build sukses
- [ ] install/uninstall sukses
- [ ] login/logout/login ulang sukses
- [ ] smoke desktop-safe routes sukses
- [ ] sync online/offline sukses

## 2. Secret Minimization

Masalah saat ini:
- desktop runtime masih membawa konfigurasi packaged yang sensitif

Target:
- installer tidak membawa token sync permanen yang luas
- runtime bootstrap hanya membawa minimum config untuk start lokal
- credential sync desktop diprovision saat first-run admin

Action:
- [ ] audit field di `runtime-config.json`
- [ ] pindahkan credential sync dari packaged resource ke provisioning first-run
- [ ] simpan credential di keyring / secure local store
- [ ] siapkan flow recovery bila keyring hilang atau korup
- [ ] rotasi token desktop yang saat ini dipakai untuk packaged runtime

Definition of done:
- [ ] runtime bundle tidak lagi membawa secret sync permanen
- [ ] onboarding admin desktop pertama bisa mengisi credential dengan aman
- [ ] relogin/restart tetap stabil setelah provisioning

## 3. Artifact Control

Masalah saat ini:
- installer sudah final secara fungsional, tetapi kontrol distribusi perlu lebih disiplin

Action:
- [ ] catat hash `SHA-256` artifact MSI final
- [ ] simpan metadata build final: timestamp, commit, operator, smoke status
- [ ] batasi distribusi installer ke channel resmi
- [ ] tambahkan code signing MSI

Definition of done:
- [ ] artifact final punya hash resmi
- [ ] artifact final punya signature resmi
- [ ] ada catatan build yang bisa diaudit

## 4. Runtime Hardening

Action:
- [ ] tambah observability ringan untuk crash embedded runtime pasca-startup
- [ ] tambah recovery UX yang lebih jelas bila loopback runtime mati setelah window terbuka
- [ ] evaluasi retry policy startup yang lebih adaptif

Definition of done:
- [ ] runtime crash setelah startup memberi pesan jujur dan path recovery yang jelas
- [ ] incident desktop bisa dipostmortem dari log lokal

## 5. Codebase Maintainability

Masalah saat ini:
- `desktop-local-api.ts` masih besar

Action:
- [ ] lanjut pecah modul auth desktop
- [ ] lanjut pecah modul sync desktop
- [ ] tambah test terarah di boundary auth packaged vs middleware loopback

Definition of done:
- [ ] audit auth/sync packaged lebih mudah
- [ ] regression desktop login/logout bisa tertangkap lebih cepat

## 6. Suggested Priority

Prioritas paling disarankan:
1. `MSI-only release policy` dan artifact control
2. secret minimization + first-run provisioning
3. `NSIS` readiness
4. runtime hardening lanjutan
5. modularisasi lanjutan
