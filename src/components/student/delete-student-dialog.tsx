"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import type { StudentListItem } from "@/hooks/use-student-list";
import { apiDelete } from "@/lib/api/request";

interface DeleteStudentDialogProps {
  student: StudentListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function DeleteStudentDialog({
  student,
  open,
  onOpenChange,
  onSuccess,
}: DeleteStudentDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!student) {
      return;
    }

    setLoading(true);
    try {
      await apiDelete<{ deleted: true }>(`/api/students/${student.id}`);
      toast.success("Siswa berhasil dihapus");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus siswa",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white rounded-2xl shadow-2xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-red-500 mb-2">
            <div className="p-2 rounded-full bg-red-500/10 ring-1 ring-red-500/20">
              <Trash2 className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-xl font-bold">
              Hapus Siswa?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-zinc-400 text-base leading-relaxed">
            Data siswa{" "}
            <span className="text-white font-semibold">
              {student?.fullName}
            </span>{" "}
            akan dinonaktifkan dari daftar aktif.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
          <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 rounded-xl h-11 px-6">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void handleDelete();
            }}
            disabled={loading}
            className="bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl h-11 px-8 shadow-lg shadow-red-900/20 transition-all border-0"
          >
            {loading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              "Hapus"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
