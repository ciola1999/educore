"use client";

import { Loader2 } from "lucide-react";
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
import { deleteStudent } from "@/core/services/student-service";

interface DeleteStudentDialogProps {
  student: { id: string; fullName: string } | null;
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
    if (!student) return;

    setLoading(true);
    try {
      const success = await deleteStudent(student.id);

      if (success) {
        onOpenChange(false);
        onSuccess();
        toast.success(`Berhasil menghapus siswa: ${student.fullName}`);
        window.dispatchEvent(new Event("students:changed"));
      } else {
        throw new Error("Gagal menghapus ke database.");
      }
    } catch (error) {
      console.error("❌ Delete failed:", error);
      toast.error("Gagal menghapus data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Student?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            Are you sure you want to delete{" "}
            <span className="text-white font-semibold">
              {student?.fullName}
            </span>
            ? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-600 hover:bg-red-500 text-white"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
