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
import { AddClassDialog } from "./add-class-dialog";
import { EditClassDialog } from "./edit-class-dialog";
import type { ClassItem } from "./schemas";

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
        title="Class data unavailable"
        description={errorMessage}
        actionLabel="Retry"
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
    <div className="space-y-4">
      {readOnly ? (
        <InlineState
          title="Mode read only"
          description="Role aktif hanya memiliki permission academic:read. Aksi tambah, edit, dan hapus kelas disembunyikan."
          variant="info"
          className="text-sm"
        />
      ) : (
        <div className="flex justify-end">
          <AddClassDialog onSuccess={fetchData} />
        </div>
      )}

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900">
              <TableHead className="text-zinc-400">Class Name</TableHead>
              <TableHead className="text-zinc-400">Year</TableHead>
              <TableHead className="text-zinc-400">Homeroom Teacher</TableHead>
              {!readOnly ? (
                <TableHead className="text-zinc-400 text-right">
                  Actions
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={readOnly ? 3 : 4}
                  className="h-24 text-center text-zinc-500"
                >
                  No classes found.
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-zinc-800 hover:bg-zinc-800/50 text-zinc-300"
                >
                  <TableCell className="font-medium text-white">
                    {item.name}
                  </TableCell>
                  <TableCell>{item.academicYear}</TableCell>
                  <TableCell>{item.homeroomTeacherName || "-"}</TableCell>
                  {!readOnly ? (
                    <TableCell className="text-right flex justify-end gap-1">
                      <EditClassDialog classData={item} onSuccess={fetchData} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-zinc-400 hover:text-red-400"
                        onClick={() => setDeleteTarget(item)}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
              <AlertDialogTitle>Delete class?</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                {deleteTarget
                  ? `Class ${deleteTarget.name} akan dihapus dari academic master data.`
                  : "Class ini akan dihapus."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                disabled={deleting}
              >
                Cancel
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
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
