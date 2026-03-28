# Sync Contract Phase 2

Dokumen ini mendefinisikan kontrak sinkronisasi minimum untuk Fase 2 EduCore:
- 2.1 Master Data
- 2.2 Jadwal
- 2.3 Absensi
- 2.4 Keuangan Dasar

Tujuannya:
- menjaga kompatibilitas SQLite desktop <-> Turso
- mencegah drift schema dan payload
- memastikan source of truth dan conflict handling konsisten

---

## 1. Common Metadata

Semua entitas syncable minimal memiliki:

```ts
type SyncEntityBase = {
  id: string;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus?: "synced" | "pending" | "error";
  hlc?: string | null;
};
```

### Rules
- `id` stabil lintas runtime
- `version` naik untuk mutasi write yang bermakna
- `updatedAt` diperbarui setiap perubahan
- `deletedAt` untuk soft delete
- `syncStatus` hanya state lokal, bukan shared business truth
- `hlc` dipakai jika conflict engine sudah aktif

---

## 2. Transport Model

### Push
Desktop mengirim perubahan lokal ke cloud.

```ts
type PushDeltaPayload = {
  actorUserId: string;
  deviceId: string;
  checkpoint?: string | null;
  mutations: Array<{
    table: string;
    operation: "upsert" | "delete";
    record: Record<string, unknown>;
    version: number;
    updatedAt: string;
    hlc?: string | null;
  }>;
};
```

### Pull
Desktop meminta perubahan cloud setelah checkpoint terakhir.

```ts
type PullDeltaPayload = {
  deviceId: string;
  lastCheckpoint: string | null;
  tables?: string[];
};
```

```ts
type PullDeltaResponse = {
  checkpoint: string;
  changes: Array<{
    table: string;
    operation: "upsert" | "delete";
    record: Record<string, unknown>;
  }>;
};
```

---

## 3. Conflict Policy

Default policy:
- LWW dengan HLC-aware comparison jika tersedia

Fallback:
1. bandingkan `hlc`
2. kalau tidak ada, bandingkan `updatedAt`
3. kalau tetap sama, gunakan deterministic tie-breaker

### Exceptions
- pembayaran dan ledger sensitif tidak boleh hanya bergantung ke LWW buta
- untuk transaksi keuangan, prioritaskan append-only event atau audit-first model

---

## 4. 2.1 Master Data

Entitas:
- `academic_years`
- `semesters`
- `classes`
- `subjects`
- `teacher_subjects`

### Master Data Rules
- identity kelas harus eksplisit dan konsisten
- referential integrity harus aman sebelum push/pull
- soft delete harus mempertimbangkan in-use relation

### Recommended sync order
1. `academic_years`
2. `semesters`
3. `subjects`
4. `classes`
5. `teacher_subjects`

---

## 5. 2.2 Jadwal

Entitas:
- `schedules`

Depends on:
- `classes`
- `subjects`
- `teacher_subjects`
- `semesters`

### Rules
- jangan apply schedule mutation jika dependency belum ada
- conflict bentrok guru/kelas/waktu harus dicek lokal sebelum push
- perubahan jadwal harus memperbarui metadata dependensi yang relevan jika diperlukan

---

## 6. 2.3 Absensi

Entitas:
- `attendance`
- jika ada projection/summary table, treat sebagai derived data, bukan primary sync entity

Depends on:
- `students`
- `classes`
- `schedules` atau session/day context

### Rules
- attendance raw record adalah data primer
- summary/rekap sebaiknya derived atau rebuildable
- offline capture harus selalu write local dulu
- duplicate attendance per session/student harus dicegah oleh rule lokal

---

## 7. 2.4 Keuangan Dasar

Entitas:
- `billing_categories`
- `invoices`
- `payments`

### Rules
- pembayaran tidak boleh melebihi saldo tagihan yang valid
- write keuangan harus punya audit trail
- lebih aman menyimpan transaksi sebagai event lalu derive status invoice
- hindari overwrite state saldo tanpa dasar event yang jelas

### Recommended sync order
1. `billing_categories`
2. `invoices`
3. `payments`

---

## 8. Validation Contract

Semua payload sync harus lolos:
- structural validation
- business invariant validation
- permission validation

Payload invalid harus:
- ditolak
- diberi kode error jelas
- tidak diam-diam di-drop tanpa jejak

---

## 9. Observability

Sync idealnya melog:
- push count
- pull count
- failed mutation count
- last checkpoint
- last success time
- per-table error summary

Minimal agar mudah audit:
- mutation gagal
- conflict resolved
- foreign key/dependency missing

