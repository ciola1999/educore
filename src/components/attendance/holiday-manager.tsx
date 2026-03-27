"use client";

import { CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiDelete, apiGet, apiPost } from "@/lib/api/request";
import { InlineState } from "../common/inline-state";

type HolidayItem = {
  id: string;
  date: string;
  name: string;
};

export function HolidayManager({
  initialHolidays,
}: {
  initialHolidays?: HolidayItem[];
}) {
  const [holidays, setHolidays] = useState<HolidayItem[]>(
    initialHolidays ?? [],
  );
  const [loading, setLoading] = useState(initialHolidays === undefined);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newHoliday, setNewHoliday] = useState({ date: "", name: "" });
  const [error, setError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);

  const loadHolidays = useCallback(async () => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<HolidayItem[]>("/api/attendance/holidays", {
        timeoutMs: 30000,
      });
      if (requestId === requestSequenceRef.current) {
        setHolidays(data);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal memuat hari libur";
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
    if (initialHolidays !== undefined) {
      requestSequenceRef.current += 1;
      setHolidays(initialHolidays);
      setLoading(false);
      return;
    }
    void (async () => {
      await loadHolidays();
    })();
  }, [initialHolidays, loadHolidays]);

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newHoliday.date || !newHoliday.name.trim()) {
      toast.error("Tanggal dan nama hari libur wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/api/attendance/holidays", {
        date: newHoliday.date,
        name: newHoliday.name.trim(),
      });
      toast.success("Hari libur berhasil disimpan");
      setNewHoliday({ date: "", name: "" });
      await loadHolidays();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan hari libur",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await apiDelete(`/api/attendance/holidays/${id}`);
      toast.success("Hari libur berhasil dihapus");
      await loadHolidays();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus hari libur",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-6">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-zinc-100">
            Kalender Hari Libur
          </h3>
          <p className="text-sm text-zinc-400">
            Hari libur akan memblokir QR Attendance otomatis pada tanggal
            terkait.
          </p>
        </div>

        <form
          onSubmit={handleAdd}
          className="grid gap-4 lg:grid-cols-[1.4fr_220px_auto]"
        >
          <div className="space-y-2">
            <Label htmlFor="holiday-name" className="text-zinc-300">
              Nama Hari Libur
            </Label>
            <Input
              id="holiday-name"
              value={newHoliday.name}
              onChange={(event) =>
                setNewHoliday((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Contoh: Libur Nasional"
              className="border-zinc-800 bg-zinc-950 text-zinc-100"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="holiday-date" className="text-zinc-300">
              Tanggal
            </Label>
            <Input
              id="holiday-date"
              type="date"
              value={newHoliday.date}
              onChange={(event) =>
                setNewHoliday((current) => ({
                  ...current,
                  date: event.target.value,
                }))
              }
              className="border-zinc-800 bg-zinc-950 text-zinc-100"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="mt-auto bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Simpan
          </Button>
        </form>
      </div>

      {error ? (
        <InlineState
          title="Hari libur belum bisa dimuat"
          description={error}
          actionLabel="Muat Ulang"
          onAction={() => {
            void loadHolidays();
          }}
          variant="error"
        />
      ) : null}

      {submitting || deletingId ? (
        <InlineState
          title="Kalender hari libur sedang diperbarui"
          description="Perubahan hari libur sedang diproses. Data terbaru akan dimuat ulang setelah aksi selesai."
          variant="info"
          className="text-sm"
        />
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12 text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : holidays.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {holidays.map((holiday) => (
            <div
              key={holiday.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-300">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-zinc-100">{holiday.name}</p>
                    <p className="text-sm text-zinc-400">{holiday.date}</p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={deletingId === holiday.id}
                  aria-label={`Hapus hari libur ${holiday.name}`}
                  onClick={() => {
                    void handleDelete(holiday.id);
                  }}
                  className="text-zinc-500 hover:bg-red-950/40 hover:text-red-300"
                >
                  {deletingId === holiday.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <InlineState
          title="Belum ada hari libur"
          description="Tambahkan tanggal penting sekolah atau hari libur nasional agar QR Attendance menghormati kalender akademik."
          variant="info"
        />
      )}
    </div>
  );
}
