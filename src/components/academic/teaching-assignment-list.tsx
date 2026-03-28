"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { AddTeachingAssignmentDialog } from "./add-teaching-assignment-dialog";
import { EditTeachingAssignmentDialog } from "./edit-teaching-assignment-dialog";
import type {
  ClassItem,
  SemesterItem,
  TeachingAssignmentItem,
} from "./schemas";

export function TeachingAssignmentList({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const [data, setData] = useState<TeachingAssignmentItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [semesters, setSemesters] = useState<SemesterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<TeachingAssignmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [assignmentRows, classRows, semesterRows] = await Promise.all([
        apiGet<TeachingAssignmentItem[]>("/api/teaching-assignments"),
        apiGet<ClassItem[]>("/api/classes"),
        apiGet<SemesterItem[]>("/api/semesters"),
      ]);

      setData(assignmentRows);
      setClasses(classRows);
      setSemesters(semesterRows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal memuat assignment";
      setData([]);
      setClasses([]);
      setSemesters([]);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const classLabelMap = useMemo(
    () =>
      new Map(
        classes.map((item) => [
          item.id,
          `${item.name}${item.academicYear ? ` - ${item.academicYear}` : ""}`,
        ]),
      ),
    [classes],
  );

  const semesterLabelMap = useMemo(
    () =>
      new Map(
        semesters.map((item) => [
          item.id,
          `${item.nama}${item.tahunAjaranNama ? ` - ${item.tahunAjaranNama}` : ""}`,
        ]),
      ),
    [semesters],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/teaching-assignments/${deleteTarget.id}`);
      toast.success("Assignment guru-mapel berhasil dihapus");
      setDeleteTarget(null);
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus assignment",
      );
    } finally {
      setDeleting(false);
    }
  }

  function getResolvedClassLabel(item: TeachingAssignmentItem) {
    return classLabelMap.get(item.kelasId) || item.kelasName || item.kelasId;
  }

  function getResolvedSemesterLabel(item: TeachingAssignmentItem) {
    return (
      semesterLabelMap.get(item.semesterId) ||
      [item.semesterName, item.tahunAjaranNama].filter(Boolean).join(" - ") ||
      item.semesterId
    );
  }

  if (loading && data.length === 0) {
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-zinc-500" />;
  }

  if (errorMessage && data.length === 0) {
    return (
      <InlineState
        title="Assignment guru-mapel belum tersedia"
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
          description="Aksi tambah, edit, dan hapus assignment guru-mapel disembunyikan."
          variant="info"
          className="text-sm"
        />
      ) : (
        <div className="flex justify-end">
          <AddTeachingAssignmentDialog onSuccess={fetchData} />
        </div>
      )}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-900">
                <TableHead className="text-zinc-400">Guru</TableHead>
                <TableHead className="text-zinc-400">Mapel</TableHead>
                <TableHead className="text-zinc-400">Kelas</TableHead>
                <TableHead className="text-zinc-400">Semester</TableHead>
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
                    Belum ada assignment guru-mapel.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-zinc-800 text-zinc-300 hover:bg-zinc-800/50"
                  >
                    <TableCell className="font-medium text-white">
                      {item.guruName}
                    </TableCell>
                    <TableCell>
                      {item.mataPelajaranName} ({item.mataPelajaranCode})
                    </TableCell>
                    <TableCell>{getResolvedClassLabel(item)}</TableCell>
                    <TableCell>{getResolvedSemesterLabel(item)}</TableCell>
                    {!readOnly ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <EditTeachingAssignmentDialog
                            assignment={item}
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
              Belum ada assignment guru-mapel.
            </div>
          ) : (
            data.map((item) => (
              <article
                key={item.id}
                className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {item.guruName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {item.mataPelajaranName} ({item.mataPelajaranCode})
                  </p>
                </div>
                <p className="text-sm text-zinc-300">
                  {getResolvedClassLabel(item)} |{" "}
                  {getResolvedSemesterLabel(item)}
                </p>
                {!readOnly ? (
                  <div className="flex justify-end gap-1">
                    <EditTeachingAssignmentDialog
                      assignment={item}
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
              <AlertDialogTitle>Hapus assignment guru-mapel?</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                {deleteTarget
                  ? `${deleteTarget.guruName} untuk ${deleteTarget.mataPelajaranName} di ${getResolvedClassLabel(deleteTarget)} akan dihapus.`
                  : "Assignment akan dihapus."}
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
