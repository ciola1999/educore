"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertStudent } from "@/core/services/student-service";
import type { StudentInput } from "@/core/validation/schemas";

interface EditStudentDialogProps {
  student: {
    id: string;
    nis: string;
    nisn?: string | null;
    fullName: string;
    gender: "L" | "P";
    grade: string;
    parentName?: string | null;
    parentPhone?: string | null;
    tempatLahir?: string | null;
    tanggalLahir?: Date | null;
    alamat?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditStudentDialog({
  student,
  open,
  onOpenChange,
  onSuccess,
}: EditStudentDialogProps) {
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    nis: "",
    nisn: "",
    email: "",
    fullName: "",
    gender: "L" as "L" | "P",
    grade: "",
    tempatLahir: "",
    tanggalLahir: "",
    alamat: "",
    parentName: "",
    parentPhone: "",
  });

  useEffect(() => {
    if (student) {
      setFormData({
        nis: student.nis,
        nisn: student.nisn || "",
        email: "",
        fullName: student.fullName,
        gender: student.gender,
        grade: student.grade,
        tempatLahir: student.tempatLahir || "",
        tanggalLahir: student.tanggalLahir
          ? new Date(student.tanggalLahir).toISOString().split("T")[0]
          : "",
        alamat: student.alamat || "",
        parentName: student.parentName || "",
        parentPhone: student.parentPhone || "",
      });
    }
  }, [student]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!student) return;

    setLoading(true);
    try {
      const payload: StudentInput = {
        id: student.id,
        nis: formData.nis,
        fullName: formData.fullName,
        gender: formData.gender as "L" | "P",
        grade: formData.grade,
        tempatLahir: formData.tempatLahir || null,
        tanggalLahir: formData.tanggalLahir
          ? new Date(formData.tanggalLahir)
          : null,
        alamat: formData.alamat || null,
        parentName: formData.parentName || null,
        parentPhone: formData.parentPhone || null,
        email: formData.email || null,
      };

      await upsertStudent(payload);

      onOpenChange(false);
      onSuccess();
      toast.success("Data siswa berhasil diperbarui");
    } catch (error: any) {
      console.error("❌ Update failed:", error);
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("UNIQUE constraint failed")) {
        toast.error("NIS atau email sudah digunakan siswa lain");
      } else {
        toast.error("Gagal update data siswa");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Update student information below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-nis">NIS</Label>
              <Input
                id="edit-nis"
                value={formData.nis}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nis: e.target.value }))
                }
                className="bg-zinc-950 border-zinc-700"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-nisn">NISN</Label>
              <Input
                id="edit-nisn"
                value={formData.nisn}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nisn: e.target.value }))
                }
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email Login (Opsional)</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="kosongkan jika tidak diubah"
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-grade">Grade</Label>
              <Input
                id="edit-grade"
                value={formData.grade}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, grade: e.target.value }))
                }
                className="bg-zinc-950 border-zinc-700"
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-fullName">Full Name</Label>
            <Input
              id="edit-fullName"
              value={formData.fullName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, fullName: e.target.value }))
              }
              className="bg-zinc-950 border-zinc-700"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(value: "L" | "P") =>
                setFormData((prev) => ({ ...prev, gender: value }))
              }
            >
              <SelectTrigger className="bg-zinc-950 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                <SelectItem value="L">Male (Laki-laki)</SelectItem>
                <SelectItem value="P">Female (Perempuan)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-tempatLahir">Tempat Lahir</Label>
              <Input
                id="edit-tempatLahir"
                value={formData.tempatLahir}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tempatLahir: e.target.value,
                  }))
                }
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-tanggalLahir">Tanggal Lahir</Label>
              <Input
                id="edit-tanggalLahir"
                type="date"
                value={formData.tanggalLahir}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tanggalLahir: e.target.value,
                  }))
                }
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-alamat">Alamat</Label>
            <Input
              id="edit-alamat"
              value={formData.alamat}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, alamat: e.target.value }))
              }
              className="bg-zinc-950 border-zinc-700"
            />
          </div>

          <div className="my-2 border-t border-zinc-800"></div>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
            Parent Information
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-parentName">Parent Name</Label>
              <Input
                id="edit-parentName"
                value={formData.parentName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    parentName: e.target.value,
                  }))
                }
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-parentPhone">Phone</Label>
              <Input
                id="edit-parentPhone"
                value={formData.parentPhone}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    parentPhone: e.target.value,
                  }))
                }
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
