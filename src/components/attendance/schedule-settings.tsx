"use client";

import { Clock3, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiDelete, apiGet, apiPost } from "@/lib/api/request";
import type { AttendanceSetting } from "@/lib/db/schema";
import { InlineState } from "../common/inline-state";

const DAY_OPTIONS = [
  { value: "0", label: "Minggu" },
  { value: "1", label: "Senin" },
  { value: "2", label: "Selasa" },
  { value: "3", label: "Rabu" },
  { value: "4", label: "Kamis" },
  { value: "5", label: "Jumat" },
  { value: "6", label: "Sabtu" },
] as const;

export function ScheduleSettings({
  initialSettings,
}: {
  initialSettings?: AttendanceSetting[];
}) {
  const [settings, setSettings] = useState<AttendanceSetting[]>(
    initialSettings ?? [],
  );
  const [loading, setLoading] = useState(initialSettings === undefined);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);

  const loadSettings = useCallback(async () => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<AttendanceSetting[]>(
        "/api/attendance/settings",
        { timeoutMs: 30000 },
      );
      if (requestId === requestSequenceRef.current) {
        setSettings(data);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat pengaturan";
      if (requestId === requestSequenceRef.current) {
        setError(message);
      }
    } finally {
      if (requestId === requestSequenceRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (initialSettings !== undefined) {
      requestSequenceRef.current += 1;
      setSettings(initialSettings);
      setLoading(false);
      return;
    }
    void (async () => {
      await loadSettings();
    })();
  }, [initialSettings, loadSettings]);

  function handleAdd() {
    setSettings((current) => [
      ...current,
      {
        id: `temp-${Date.now()}`,
        dayOfWeek: 1,
        startTime: "07:00",
        endTime: "15:00",
        lateThreshold: "07:15",
        entityType: "student",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        syncStatus: "pending",
        version: 1,
        hlc: null,
      },
    ]);
  }

  function updateSetting(id: string, patch: Partial<AttendanceSetting>) {
    setSettings((current) =>
      current.map((setting) =>
        setting.id === id ? { ...setting, ...patch } : setting,
      ),
    );
  }

  async function handleSave(setting: AttendanceSetting) {
    setSavingId(setting.id);
    try {
      await apiPost("/api/attendance/settings", {
        id: setting.id,
        dayOfWeek: setting.dayOfWeek,
        startTime: setting.startTime,
        endTime: setting.endTime,
        lateThreshold: setting.lateThreshold,
        entityType: setting.entityType,
        isActive: setting.isActive,
      });
      toast.success("Pengaturan absensi berhasil disimpan");
      await loadSettings();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan pengaturan",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (id.startsWith("temp-")) {
      setSettings((current) => current.filter((setting) => setting.id !== id));
      return;
    }

    setSavingId(id);
    try {
      await apiDelete(`/api/attendance/settings/${id}`);
      toast.success("Pengaturan absensi berhasil dihapus");
      await loadSettings();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus pengaturan",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">
            Jadwal Batas Absensi
          </h3>
          <p className="text-sm text-zinc-400">
            Atur jam masuk, batas terlambat, dan hari aktif untuk QR Attendance.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleAdd}
          className="bg-sky-600 text-white hover:bg-sky-500"
        >
          <Plus className="mr-2 h-4 w-4" />
          Tambah Jadwal
        </Button>
      </div>

      {error ? (
        <InlineState
          title="Pengaturan absensi belum bisa dimuat"
          description={error}
          actionLabel="Muat Ulang"
          onAction={() => {
            void loadSettings();
          }}
          variant="error"
        />
      ) : null}

      {savingId ? (
        <InlineState
          title="Menyinkronkan pengaturan absensi"
          description="Perubahan jadwal sedang diproses. Data terbaru akan dimuat ulang setelah aksi selesai."
          variant="info"
          className="text-sm"
        />
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : settings.length > 0 ? (
        <div className="grid gap-4">
          {settings.map((setting) => (
            <div
              key={setting.id}
              className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-5"
            >
              <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr_1fr_1fr_auto]">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Hari</Label>
                  <Select
                    value={String(setting.dayOfWeek)}
                    onValueChange={(value) => {
                      updateSetting(setting.id, {
                        dayOfWeek: Number.parseInt(value, 10),
                      });
                    }}
                  >
                    <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                      {DAY_OPTIONS.map((day) => (
                        <SelectItem key={day.value} value={day.value}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">Jam Masuk</Label>
                  <Input
                    type="time"
                    value={setting.startTime}
                    onChange={(event) => {
                      updateSetting(setting.id, {
                        startTime: event.target.value,
                      });
                    }}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">Batas Terlambat</Label>
                  <Input
                    type="time"
                    value={setting.lateThreshold}
                    onChange={(event) => {
                      updateSetting(setting.id, {
                        lateThreshold: event.target.value,
                      });
                    }}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">Jam Selesai</Label>
                  <Input
                    type="time"
                    value={setting.endTime}
                    onChange={(event) => {
                      updateSetting(setting.id, {
                        endTime: event.target.value,
                      });
                    }}
                    className="border-zinc-800 bg-zinc-950 text-zinc-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">Tipe</Label>
                  <Select
                    value={setting.entityType}
                    onValueChange={(value) => {
                      updateSetting(setting.id, {
                        entityType: value as AttendanceSetting["entityType"],
                      });
                    }}
                  >
                    <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                      <SelectItem value="student">Siswa</SelectItem>
                      <SelectItem value="employee">Pegawai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    disabled={savingId === setting.id}
                    aria-label={`Simpan pengaturan absensi ${setting.entityType} hari ${setting.dayOfWeek}`}
                    onClick={() => {
                      void handleSave(setting);
                    }}
                    className="bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    {savingId === setting.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    disabled={savingId === setting.id}
                    aria-label={`Hapus pengaturan absensi ${setting.entityType} hari ${setting.dayOfWeek}`}
                    onClick={() => {
                      void handleDelete(setting.id);
                    }}
                    className="text-zinc-500 hover:bg-red-950/40 hover:text-red-300"
                  >
                    {savingId === setting.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                <Clock3 className="h-4 w-4" />
                {setting.isActive
                  ? "Aktif untuk perhitungan QR Attendance."
                  : "Nonaktif dan tidak dipakai untuk validasi QR Attendance."}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <InlineState
          title="Belum ada jadwal absensi"
          description="Tambahkan minimal satu jadwal aktif agar QR Attendance memiliki batas waktu yang jelas."
          variant="info"
        />
      )}
    </div>
  );
}
