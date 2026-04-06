"use client";

import {
  GraduationCap,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
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
import { cn } from "@/lib/utils";
import type { ClassItem } from "./schemas";

const AddClassDialog = dynamic(
  () => import("./add-class-dialog").then((module) => module.AddClassDialog),
  { ssr: false },
);

const EditClassDialog = dynamic(
  () => import("./edit-class-dialog").then((module) => module.EditClassDialog),
  { ssr: false },
);

export function ClassList({ readOnly = false }: { readOnly?: boolean }) {
  const [data, setData] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await apiGet<ClassItem[]>("/api/classes");
      setData(result || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal memuat data kelas";
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
      await apiDelete<{ deleted: true }>(`/api/classes/${deleteTarget.id}`);
      toast.success("Kelas berhasil dihapus");
      setDeleteTarget(null);
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus kelas",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (loading && data.length === 0) {
    return <Loader2 className="h-8 w-8 animate-spin mx-auto text-zinc-500" />;
  }

  if (errorMessage && data.length === 0) {
    return (
      <InlineState
        title="Data kelas belum tersedia"
        description={errorMessage}
        actionLabel="Muat ulang"
        onAction={() => {
          void fetchData();
        }}
        variant={
          errorMessage.includes("izin") || errorMessage.includes("login")
            ? "warning"
            : "error"
        }
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
        <div>
          <h3 className="text-lg font-bold text-white">Daftar Kelas</h3>
          <p className="text-xs text-zinc-500">
            Kelola rombongan belajar dan wali kelas.
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <AddClassDialog onSuccess={fetchData} />
            <button
              type="button"
              onClick={() => void fetchData()}
              className="group flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900 hover:text-white transition-all"
            >
              <RefreshCw
                className={cn(
                  "h-4.5 w-4.5 transition-transform group-hover:rotate-180",
                  loading && "animate-spin text-orange-400",
                )}
              />
            </button>
          </div>
        )}
      </div>

      {readOnly && (
        <div className="rounded-2xl border border-sky-500/10 bg-sky-500/5 p-4 mx-2">
          <div className="flex items-center gap-3 text-xs text-sky-400/80 uppercase font-bold tracking-widest">
            <ShieldCheck className="h-4 w-4" />
            Mode Lihat Saja Aktif
          </div>
        </div>
      )}

      <div className="rounded-[2rem] border border-zinc-800/80 bg-zinc-950/40 shadow-2xl overflow-hidden backdrop-blur-md">
        <div className="hidden md:block">
          <Table>
            <TableHeader className="bg-zinc-900/50">
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="font-bold text-zinc-400 py-5 pl-8 text-[11px] uppercase tracking-widest">
                  Nama Kelas
                </TableHead>
                <TableHead className="font-bold text-zinc-400 text-[11px] uppercase tracking-widest">
                  Tahun Ajaran
                </TableHead>
                <TableHead className="font-bold text-zinc-400 text-[11px] uppercase tracking-widest">
                  Wali Kelas
                </TableHead>
                {!readOnly && (
                  <TableHead className="font-bold text-zinc-400 text-right pr-8 text-[11px] uppercase tracking-widest">
                    Kontrol
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={readOnly ? 3 : 4}
                    className="h-48 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                        <GraduationCap className="h-8 w-8 text-zinc-700" />
                      </div>
                      <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest">
                        Data Kelas Kosong
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item, index) => (
                  <TableRow
                    key={item.id}
                    className="group border-b border-zinc-800/50 hover:bg-white/5 transition-all duration-300"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <TableCell className="py-5 pl-8">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 font-black">
                          {item.name.charAt(0)}
                        </div>
                        <span className="font-bold text-white tracking-tight">
                          {item.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-zinc-400 border border-zinc-800">
                        {item.academicYear}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span className="text-sm text-zinc-300">
                          {item.homeroomTeacherName || "Belum Ditentukan"}
                        </span>
                      </div>
                    </TableCell>
                    {!readOnly && (
                      <TableCell className="pr-8">
                        <div className="flex justify-end gap-1 translate-x-4 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100">
                          <EditClassDialog
                            classData={item}
                            onSuccess={fetchData}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-lg text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                            onClick={() => setDeleteTarget(item)}
                            type="button"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-4 p-4 md:hidden">
          {data.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-zinc-800 bg-zinc-950/40 p-12 text-center">
              <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest">
                Belum Ada Data Kelas
              </p>
            </div>
          ) : (
            data.map((item) => (
              <article
                key={item.id}
                className="group relative overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-zinc-900/30 p-5 transition-all hover:bg-zinc-900/50"
              >
                <div className="absolute top-0 right-0 p-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-700">
                    {item.academicYear}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400 border border-orange-500/20 font-black text-lg">
                    {item.name.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <p className="font-black text-white tracking-tight">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <p className="text-xs text-zinc-400">
                        {item.homeroomTeacherName || "Belum Ditentukan"}
                      </p>
                    </div>
                  </div>
                </div>

                {!readOnly && (
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-zinc-800/50 pt-4">
                    <EditClassDialog classData={item} onSuccess={fetchData} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 rounded-xl text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
                      onClick={() => setDeleteTarget(item)}
                      type="button"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </Button>
                  </div>
                )}
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
              <AlertDialogTitle>Hapus kelas?</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                {deleteTarget
                  ? `Kelas ${deleteTarget.name} akan dihapus dari master data akademik.`
                  : "Kelas ini akan dihapus."}
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
                onClick={(event) => {
                  event.preventDefault();
                  void handleDelete();
                }}
                className="bg-red-600 text-white hover:bg-red-500"
                disabled={deleting}
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
