"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IDCardView } from "../id-card/id-card-view";

type StudentCardPayload = {
  fullName: string;
  nis: string;
  nisn?: string | null;
  alamat?: string | null;
};

interface StudentIdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentCardPayload | null;
}

export function StudentIdDialog({
  open,
  onOpenChange,
  student,
}: StudentIdDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Preview Kartu Siswa</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Cetak kartu siswa dari data roster saat ini.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 flex justify-center">
          {student ? (
            <IDCardView
              name={student.fullName}
              id={student.nis}
              personRole="student"
              nisn={student.nisn || undefined}
              address={student.alamat || undefined}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
