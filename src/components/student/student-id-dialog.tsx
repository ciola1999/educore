"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { IdCard } from "@/components/common/id-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Student, StudentIdCard } from "@/core/db/schema";
import { getOrCreateStudentCard } from "@/core/services/student-service";

interface StudentIdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
}

export function StudentIdDialog({
  open,
  onOpenChange,
  student,
}: StudentIdDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [cardPayload, setCardPayload] = useState<StudentIdCard | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);

  // Hook untuk menghandle print area spesifik
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `IDCard-${student?.fullName}`,
    onAfterPrint: () => {
      toast.success("ID card berhasil dicetak");
    },
  });

  useEffect(() => {
    const loadCardPayload = async () => {
      if (!open || !student) return;

      setLoadingCard(true);
      try {
        const payload = await getOrCreateStudentCard(student.id);
        if (!payload) {
          toast.error("Data kartu siswa tidak ditemukan");
          setCardPayload(null);
          return;
        }

        setCardPayload(payload as any);
      } catch (error) {
        console.error("❌ Gagal membuat kartu siswa:", error);
        toast.error("Gagal menyiapkan QR card siswa");
        setCardPayload(null);
      } finally {
        setLoadingCard(false);
      }
    };

    loadCardPayload();
  }, [open, student]);

  if (!student) return null;

  const birthInfo = (() => {
    const place = student.tempatLahir?.trim();
    const date = student.tanggalLahir
      ? new Intl.DateTimeFormat("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }).format(new Date(student.tanggalLahir))
      : null;

    if (place && date) return `${place}, ${date}`;
    if (place) return place;
    if (date) return date;
    return "-";
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Student ID Card</DialogTitle>
          <DialogDescription>
            Preview ID Card for {student.fullName}. Use the print button to save
            as PDF or print.
          </DialogDescription>
        </DialogHeader>

        {/* Preview Area (Centered) */}
        <div className="flex items-center justify-center bg-gray-50 py-8 rounded-lg border border-dashed border-gray-200">
          {/* Ini yang akan dicetak */}
          <div ref={printRef} className="print:m-4">
            <IdCard
              name={student.fullName}
              idNumber={student.nis}
              userRole="STUDENT"
              studentClass={student.grade}
              secondaryId={student.nisn ?? undefined}
              qrValue={
                cardPayload
                  ? JSON.stringify({
                      studentId: cardPayload.studentId,
                      nis: student.nis, // Use from student prop
                      token: cardPayload.token,
                      cardNumber: cardPayload.cardNumber,
                    })
                  : student.nis
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-zinc-50 p-3 text-xs text-zinc-700">
          <div>
            <p className="text-zinc-500">NISN</p>
            <p className="font-medium">{student.nisn || "-"}</p>
          </div>
          <div>
            <p className="text-zinc-500">Kelas</p>
            <p className="font-medium">{student.grade}</p>
          </div>
          <div>
            <p className="text-zinc-500">Tempat/Tgl Lahir</p>
            <p className="font-medium">{birthInfo}</p>
          </div>
          <div>
            <p className="text-zinc-500">Kontak Wali</p>
            <p className="font-medium">{student.parentPhone || "-"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-zinc-500">Alamat</p>
            <p className="font-medium line-clamp-2">{student.alamat || "-"}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => handlePrint()}
            disabled={loadingCard || !cardPayload}
          >
            <Printer className="mr-2 h-4 w-4" />
            {loadingCard ? "Preparing..." : "Print Card"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
