"use client";

import { Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export function AddStudentDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const rawTanggalLahir = (formData.get("tanggalLahir") as string) || "";
    const data: StudentInput = {
      nis: formData.get("nis") as string,
      fullName: formData.get("fullName") as string,
      gender: (formData.get("gender") as "L" | "P") || "L",
      grade: formData.get("grade") as string,
      parentName: (formData.get("parentName") as string) || null,
      parentPhone: (formData.get("parentPhone") as string) || null,
      email: (formData.get("email") as string) || null,
      nisn: (formData.get("nisn") as string) || null,
      tempatLahir: (formData.get("tempatLahir") as string) || null,
      tanggalLahir: rawTanggalLahir ? new Date(rawTanggalLahir) : null,
      alamat: (formData.get("alamat") as string) || null,
    };

    try {
      await upsertStudent(data);
      toast.success("Siswa berhasil ditambahkan!");
      setOpen(false);
      window.dispatchEvent(new Event("students:changed"));
    } catch (error: unknown) {
      // ✅ Perbaikan Biome: Menggunakan 'unknown' alih-alih 'any' untuk Type-Safety
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errObj = error as Record<string, unknown>;

      if (
        errorMessage.includes("UNIQUE constraint failed: students.nis") ||
        errorMessage.includes("code: 2067") ||
        errObj.code === "NIS_ALREADY_EXISTS"
      ) {
        toast.error("Gagal: NIS ini sudah terdaftar di database!", {
          description: "Silakan gunakan NIS yang berbeda.",
        });
      } else if (errObj.name === "ZodError") {
        const zodErrors = errObj.errors as { message: string }[] | undefined;
        toast.error("Data tidak valid", {
          description: zodErrors?.[0]?.message || "Periksa kembali isian Anda.",
        });
      } else {
        toast.error("Terjadi Kesalahan", {
          description: errorMessage,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          suppressHydrationWarning={true}
          className="bg-blue-600 hover:bg-blue-500 gap-2 shadow-lg shadow-blue-900/20"
        >
          <UserPlus className="h-4 w-4" /> Add Student
        </Button>
      </DialogTrigger>
      {/* ✅ PERBAIKAN RESPONSIVITAS: Ditambahkan max-h-[85dvh] dan overflow-y-auto */}
      <DialogContent className="sm:max-w-[500px] max-h-[85dvh] overflow-y-auto bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Fill in the student's academic and personal details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {/* Section: Academic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nis">NIS (Nomor Induk)</Label>
              <Input
                id="nis"
                name="nis"
                placeholder="e.g. 2024001"
                className="bg-zinc-950 border-zinc-700"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nisn">NISN</Label>
              <Input
                id="nisn"
                name="nisn"
                placeholder="e.g. 0098765432"
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email Login (Opsional)</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="siswa@sekolah.sch.id"
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="grade">Grade / Class</Label>
              <Input
                id="grade"
                name="grade"
                placeholder="e.g. X-RPL-1"
                className="bg-zinc-950 border-zinc-700"
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              name="fullName"
              placeholder="Student Full Name"
              className="bg-zinc-950 border-zinc-700"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Gender</Label>
            <Select name="gender" required defaultValue="L">
              <SelectTrigger className="bg-zinc-950 border-zinc-700">
                <SelectValue placeholder="Select Gender" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                <SelectItem value="L">Male (Laki-laki)</SelectItem>
                <SelectItem value="P">Female (Perempuan)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tempatLahir">Tempat Lahir</Label>
              <Input
                id="tempatLahir"
                name="tempatLahir"
                placeholder="e.g. Bandung"
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tanggalLahir">Tanggal Lahir</Label>
              <Input
                id="tanggalLahir"
                name="tanggalLahir"
                type="date"
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="alamat">Alamat</Label>
            <Input
              id="alamat"
              name="alamat"
              placeholder="Alamat lengkap siswa"
              className="bg-zinc-950 border-zinc-700"
            />
          </div>

          <div className="my-2 border-t border-zinc-800"></div>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
            Parent Information
          </p>

          {/* Section: Parent Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="parentName">Parent Name</Label>
              <Input
                id="parentName"
                name="parentName"
                placeholder="Father/Mother"
                className="bg-zinc-950 border-zinc-700"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="parentPhone">Phone Number</Label>
              <Input
                id="parentPhone"
                name="parentPhone"
                type="tel"
                placeholder="0812..."
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
                "Save Record"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
