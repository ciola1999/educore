"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiDelete, apiGet } from "@/lib/api/request";
import { AddSemesterDialog } from "./add-semester-dialog";
import { EditSemesterDialog } from "./edit-semester-dialog";
import type { SemesterItem } from "./schemas";

function formatSemesterDate(value: string | Date | number) {
  const normalizedDate =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value < 10_000_000_000 ? value * 1000 : value)
        : null;

  if (normalizedDate) {
    const year = normalizedDate.getFullYear();
    const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");
    const day = String(normalizedDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return "-";
}

export function SemesterList({ readOnly = false }: { readOnly?: boolean }) {
  const [data, setData] = useState<SemesterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SemesterItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      setData(await apiGet<SemesterItem[]>("/api/semesters"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal memuat data semester";
      setData([]);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/semesters/${deleteTarget.id}`);
      toast.success("Semester berhasil dihapus");
      setDeleteTarget(null);
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus semester",
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
        title="Data semester belum tersedia"
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
      {readOnly ? (
        <InlineState
          title="Mode read only"
          description="Aksi tambah, edit, dan hapus semester disembunyikan."
          variant="info"
          className="text-sm"
        />
      ) : (
        <div className="flex justify-end">
          <AddSemesterDialog onSuccess={fetchData} />
        </div>
      )}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-900">
                <TableHead className="text-zinc-400">Semester</TableHead>
                <TableHead className="text-zinc-400">Tahun Ajaran</TableHead>
                <TableHead className="text-zinc-400">Periode</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
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
                    colSpan={readOnly ? 4 : 5}
                    className="h-24 text-center text-zinc-500"
                  >
                    Belum ada semester.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-zinc-800 text-zinc-300 hover:bg-zinc-800/50"
                  >
                    <TableCell className="font-medium text-white">
                      {item.nama}
                    </TableCell>
                    <TableCell>{item.tahunAjaranNama || "-"}</TableCell>
                    <TableCell>
                      {formatSemesterDate(item.tanggalMulai)} s/d{" "}
                      {formatSemesterDate(item.tanggalSelesai)}
                    </TableCell>
                    <TableCell>
                      {item.isActive ? "Aktif" : "Tidak aktif"}
                    </TableCell>
                    {!readOnly ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <EditSemesterDialog
                            semester={item}
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
              Belum ada semester.
            </div>
          ) : (
            data.map((item) => (
              <article
                key={item.id}
                className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {item.nama}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {item.tahunAjaranNama || "-"}
                  </p>
                </div>
                <p className="text-sm text-zinc-300">
                  {formatSemesterDate(item.tanggalMulai)} s/d{" "}
                  {formatSemesterDate(item.tanggalSelesai)}
                </p>
                <p className="text-sm text-zinc-300">
                  Status: {item.isActive ? "Aktif" : "Tidak aktif"}
                </p>
                {!readOnly ? (
                  <div className="flex justify-end gap-1">
                    <EditSemesterDialog semester={item} onSuccess={fetchData} />
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
          <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus semester?</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                {deleteTarget
                  ? `Semester ${deleteTarget.nama} akan dihapus dari master data akademik.`
                  : "Semester akan dihapus."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
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
    </div>
  );
}
