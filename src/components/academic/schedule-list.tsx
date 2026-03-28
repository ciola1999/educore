"use client";

import { Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { toast } from "sonner";
import { InlineState } from "@/components/common/inline-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiDelete, apiGet } from "@/lib/api/request";
import { AddScheduleDialog } from "./add-schedule-dialog";
import { EditScheduleDialog } from "./edit-schedule-dialog";
import type { JadwalItem, LegacyScheduleAuditReport } from "./schemas";

const DAY_LABELS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export function ScheduleList({ readOnly = false }: { readOnly?: boolean }) {
  const [data, setData] = useState<JadwalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<JadwalItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [legacyAuditSummary, setLegacyAuditSummary] = useState<{
    totalLegacyRows: number;
    actionableRows: number;
  } | null>(null);
  const deferredSearch = useDeferredValue(search);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      if (dayFilter !== "all") {
        params.set("hari", dayFilter);
      }
      const normalizedSearch = deferredSearch.trim();
      if (normalizedSearch) {
        params.set("search", normalizedSearch);
      }
      const queryString = params.toString();
      setData(
        await apiGet<JadwalItem[]>(
          queryString ? `/api/schedules?${queryString}` : "/api/schedules",
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal memuat data jadwal";
      setData([]);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [dayFilter, deferredSearch]);

  const fetchLegacyAuditSummary = useCallback(async () => {
    if (readOnly) {
      setLegacyAuditSummary(null);
      return;
    }

    try {
      const report = await apiGet<LegacyScheduleAuditReport>(
        "/api/teaching-assignments/schedule-legacy-audit?limit=1",
      );
      const actionableRows =
        report.summary.ready_to_backfill +
        report.summary.ambiguous_assignment +
        report.summary.missing_assignment;
      setLegacyAuditSummary({
        totalLegacyRows: report.totalLegacyRows,
        actionableRows,
      });
    } catch {
      setLegacyAuditSummary(null);
    }
  }, [readOnly]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    void fetchLegacyAuditSummary();
  }, [fetchLegacyAuditSummary]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/schedules/${deleteTarget.id}`);
      toast.success("Jadwal berhasil dihapus");
      setDeleteTarget(null);
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus jadwal",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading && data.length === 0) {
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-zinc-500" />;
  }

  if (errorMessage && data.length === 0) {
    return (
      <InlineState
        title="Data jadwal belum tersedia"
        description={errorMessage}
        actionLabel="Muat ulang"
        onAction={() => {
          void fetchData();
        }}
        variant="error"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-200/80">
            Slot Termuat
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {data.length}
          </p>
        </div>
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-200/80">
            Hari Aktif
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {new Set(data.map((item) => item.hari)).size}
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">
            Ruangan Aktif
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {
              new Set(
                data
                  .map((item) => item.ruangan?.trim())
                  .filter((value): value is string => Boolean(value)),
              ).size
            }
          </p>
        </div>
      </div>
      {legacyAuditSummary && legacyAuditSummary.totalLegacyRows > 0 ? (
        <InlineState
          title="Masih ada backlog schedule legacy"
          description={
            legacyAuditSummary.actionableRows > 0
              ? `${legacyAuditSummary.actionableRows} row legacy masih perlu dipromosikan atau diperbaiki sebelum cleanup Phase 2.2 bisa benar-benar tuntas.`
              : `${legacyAuditSummary.totalLegacyRows} row legacy sudah terdeteksi. Audit tetap perlu dipantau sampai cleanup selesai.`
          }
          variant="warning"
          actionLabel="Buka Audit Jadwal"
          onAction={() => {
            window.location.href =
              "/dashboard/courses?tab=schedule-legacy-audit";
          }}
          className="text-sm"
        />
      ) : null}
      {readOnly ? (
        <InlineState
          title="Mode read only"
          description="Aksi tambah, edit, dan hapus jadwal disembunyikan."
          variant="info"
          className="text-sm"
        />
      ) : (
        <div className="flex justify-end">
          <AddScheduleDialog onSuccess={fetchData} />
        </div>
      )}
      <div className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari guru, mapel, kelas, semester, atau ruangan"
          className="border-zinc-700 bg-zinc-950"
        />
        <Select value={dayFilter} onValueChange={setDayFilter}>
          <SelectTrigger className="border-zinc-700 bg-zinc-950">
            <SelectValue placeholder="Filter hari" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
            <SelectItem value="all">Semua Hari</SelectItem>
            {DAY_LABELS.map((label, index) => (
              <SelectItem key={label} value={String(index)}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-900">
                <TableHead className="text-zinc-400">Hari</TableHead>
                <TableHead className="text-zinc-400">Jam</TableHead>
                <TableHead className="text-zinc-400">Guru Mapel</TableHead>
                <TableHead className="text-zinc-400">Semester</TableHead>
                <TableHead className="text-zinc-400">Ruangan</TableHead>
                {!readOnly ? (
                  <TableHead className="text-right text-zinc-400">
                    Aksi
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={readOnly ? 5 : 6}
                    className="h-24 text-center text-zinc-500"
                  >
                    {search.trim() || dayFilter !== "all"
                      ? "Tidak ada jadwal yang cocok dengan filter saat ini."
                      : "Belum ada jadwal canonical."}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-zinc-800 text-zinc-300 hover:bg-zinc-800/50"
                  >
                    <TableCell className="font-medium text-white">
                      {DAY_LABELS[item.hari] || `Hari ${item.hari}`}
                    </TableCell>
                    <TableCell>
                      {item.jamMulai} - {item.jamSelesai}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-white">
                          {item.guruName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {item.mataPelajaranName} ({item.mataPelajaranCode}) |{" "}
                          {item.kelasName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.semesterName} - {item.tahunAjaranNama || "-"}
                    </TableCell>
                    <TableCell>{item.ruangan || "-"}</TableCell>
                    {!readOnly ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <EditScheduleDialog
                            schedule={item}
                            onSuccess={fetchData}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-zinc-400 hover:text-red-400"
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="space-y-3 p-3 md:hidden">
          {data.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-center text-sm text-zinc-500">
              {search.trim() || dayFilter !== "all"
                ? "Tidak ada jadwal yang cocok dengan filter saat ini."
                : "Belum ada jadwal canonical."}
            </div>
          ) : (
            data.map((item) => (
              <article
                key={item.id}
                className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {DAY_LABELS[item.hari] || `Hari ${item.hari}`} |{" "}
                    {item.jamMulai} - {item.jamSelesai}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {item.guruName} | {item.mataPelajaranName} (
                    {item.mataPelajaranCode})
                  </p>
                </div>
                <p className="text-sm text-zinc-300">
                  {item.kelasName} | {item.semesterName} |{" "}
                  {item.tahunAjaranNama || "-"}
                </p>
                <p className="text-sm text-zinc-300">
                  Ruangan: {item.ruangan || "-"}
                </p>
                {!readOnly ? (
                  <div className="flex justify-end gap-1">
                    <EditScheduleDialog schedule={item} onSuccess={fetchData} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-zinc-400 hover:text-red-400"
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
      {!readOnly ? (
        <AlertDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent className="border-zinc-800 bg-zinc-900 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus jadwal?</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                {deleteTarget
                  ? `${DAY_LABELS[deleteTarget.hari] || deleteTarget.hari}, ${deleteTarget.jamMulai} - ${deleteTarget.jamSelesai} untuk ${deleteTarget.kelasName} akan dihapus.`
                  : "Jadwal akan dihapus."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700"
                disabled={deleting}
              >
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white hover:bg-red-500"
                disabled={deleting}
                onClick={(event) => {
                  event.preventDefault();
                  void handleDelete();
                }}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Hapus"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      <div className="text-xs text-zinc-500">
        Cleanup legacy bisa dipantau dari{" "}
        <Link
          href="/dashboard/courses?tab=schedule-legacy-audit"
          className="text-amber-300 hover:text-amber-200"
        >
          Audit Jadwal
        </Link>
        .
      </div>
    </div>
  );
}
