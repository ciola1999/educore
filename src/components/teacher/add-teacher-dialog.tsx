"use client";

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
import { hashPassword } from "@/lib/auth/hash";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddTeacherDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const db = await getDb();
      const password = formData.get("password") as string;
      
      // Jika password kosong, jangan di-hash (atau handle default)
      // Di sini kita biarkan null atau hash kalau ada isinya
      const passwordHash = password ? await hashPassword(password) : null;

      await db.insert(users).values({
        id: crypto.randomUUID(),
        fullName: formData.get("fullName") as string,
        email: formData.get("email") as string,
        role: formData.get("role") as "teacher" | "staff",
        passwordHash,
        syncStatus: "pending",
        createdAt: new Date(), // Opsional: Tergantung schema, biasanya default value udah handle
        updatedAt: new Date(),
      });

      console.log("✅ Teacher added!");

      // 1. Tutup Dialog dulu biar UI bersih
      setOpen(false);

      // 2. AUTO F5 (Reload Halaman)
      // Kita pakai window.location.reload() karena router.refresh() kadang 
      // tidak mengambil data terbaru dari SQLite lokal dengan cepat.
      window.location.reload(); 

    } catch (error: any) {
      console.error("❌ Failed to save:", error);
      
      // Ambil pesan error dalam bentuk string penuh
      const errorMessage = error?.message || String(error);
      // Kadang info penting ada di properti 'cause'
      const errorCause = error?.cause?.message || String(error?.cause || ""); 

      // Cek apakah error mengandung kata-kata kunci ini
      if (
        errorMessage.includes("UNIQUE constraint failed") || 
        errorMessage.includes("users.email") ||
        errorCause.includes("UNIQUE constraint failed") ||
        errorMessage.includes("SQLITE_CONSTRAINT")
      ) {
        alert("⚠️ GAGAL: Email ini sudah terdaftar!\nMohon gunakan alamat email yang berbeda.");
      } else {
        // Jika error lain, tampilkan pesan aslinya tapi lebih pendek
        alert("❌ Gagal menyimpan data.\nKemungkinan email sudah ada atau ada masalah koneksi.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button suppressHydrationWarning={true} className="bg-blue-600 hover:bg-blue-500 gap-2 shadow-lg shadow-blue-900/20">
          <UserPlus className="h-4 w-4" /> Add Teacher
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle>Add New Teacher</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Fill in the teacher's details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              name="fullName"
              placeholder="Teacher's Full Name"
              className="bg-zinc-950 border-zinc-700"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="teacher@school.edu"
              className="bg-zinc-950 border-zinc-700"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select name="role" defaultValue="teacher">
                <SelectTrigger className="bg-zinc-950 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
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
                "Save Teacher"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}