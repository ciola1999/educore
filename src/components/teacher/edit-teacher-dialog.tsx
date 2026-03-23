"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Teacher } from "@/hooks/use-teacher-list";
import { apiPatch } from "@/lib/api/request";

const updateTeacherSchema = z.object({
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  role: z.enum(["super_admin", "admin", "teacher", "staff"]),
  password: z.string().min(8, "Password minimal 8 karakter").optional(),
  nip: z.string().optional(),
  jenisKelamin: z.enum(["L", "P"]).nullable().optional(),
  tempatLahir: z.string().optional(),
  tanggalLahir: z.string().optional(),
  alamat: z.string().optional(),
  noTelepon: z.string().optional(),
  isActive: z.boolean(),
});

type UpdateTeacherFormValues = z.infer<typeof updateTeacherSchema>;

type EditTeacherDialogProps = {
  teacher: Teacher;
  onSuccess: () => void;
};

export function EditTeacherDialog({
  teacher,
  onSuccess,
}: EditTeacherDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<UpdateTeacherFormValues>({
    resolver: zodResolver(updateTeacherSchema),
    defaultValues: {
      fullName: teacher.fullName,
      email: teacher.email,
      role: teacher.role,
      password: "",
      nip: teacher.nip ?? "",
      jenisKelamin: teacher.jenisKelamin ?? null,
      tempatLahir: teacher.tempatLahir ?? "",
      tanggalLahir: teacher.tanggalLahir
        ? new Date(teacher.tanggalLahir).toISOString().slice(0, 10)
        : "",
      alamat: teacher.alamat ?? "",
      noTelepon: teacher.noTelepon ?? "",
      isActive: teacher.isActive,
    },
  });

  useEffect(() => {
    form.reset({
      fullName: teacher.fullName,
      email: teacher.email,
      role: teacher.role,
      password: "",
      nip: teacher.nip ?? "",
      jenisKelamin: teacher.jenisKelamin ?? null,
      tempatLahir: teacher.tempatLahir ?? "",
      tanggalLahir: teacher.tanggalLahir
        ? new Date(teacher.tanggalLahir).toISOString().slice(0, 10)
        : "",
      alamat: teacher.alamat ?? "",
      noTelepon: teacher.noTelepon ?? "",
      isActive: teacher.isActive,
    });
  }, [form, teacher]);

  async function handleSubmit(values: UpdateTeacherFormValues) {
    setLoading(true);
    try {
      await apiPatch<{ updated: true }>(`/api/teachers/${teacher.id}`, {
        fullName: values.fullName,
        email: values.email,
        role: values.role,
        password: values.password || undefined,
        nip: values.nip || null,
        jenisKelamin: values.jenisKelamin || null,
        tempatLahir: values.tempatLahir || null,
        tanggalLahir: values.tanggalLahir || null,
        alamat: values.alamat || null,
        noTelepon: values.noTelepon || null,
        isActive: values.isActive,
      });
      toast.success("Data user berhasil diperbarui");
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memperbarui data user",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-9 w-9 text-zinc-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] border-zinc-800 bg-zinc-900 p-0 text-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">Edit User</DialogTitle>
            <DialogDescription className="px-6 text-zinc-400">
              Lengkapi data diri user dan reset password jika diperlukan.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[80dvh] overflow-y-auto px-6 pb-3">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4 py-2"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Lengkap</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-zinc-950 border-zinc-800"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-zinc-950 border-zinc-800"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-zinc-950 border-zinc-800">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                            <SelectItem value="super_admin">
                              Super Admin
                            </SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="teacher">Teacher</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password Baru (opsional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            className="bg-zinc-950 border-zinc-800"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm">
                  <p className="font-medium text-zinc-200">Status Wali Kelas</p>
                  <p className="mt-1 text-zinc-300">
                    {teacher.isHomeroomTeacher ? "Ya" : "Tidak"}
                  </p>
                  <p className="mt-1 text-zinc-500">
                    Status ini mengikuti assignment pada modul Data Kelas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NIP</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-zinc-950 border-zinc-800"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="noTelepon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>No. Telepon</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-zinc-950 border-zinc-800"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jenisKelamin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jenis Kelamin</FormLabel>
                        <Select
                          value={field.value ?? "unset"}
                          onValueChange={(value) =>
                            field.onChange(value === "unset" ? null : value)
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="bg-zinc-950 border-zinc-800">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                            <SelectItem value="unset">-</SelectItem>
                            <SelectItem value="L">Laki-laki</SelectItem>
                            <SelectItem value="P">Perempuan</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tanggalLahir"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tanggal Lahir</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            className="bg-zinc-950 border-zinc-800"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="tempatLahir"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tempat Lahir</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-zinc-950 border-zinc-800"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="alamat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alamat</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-zinc-950 border-zinc-800"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(event) =>
                            field.onChange(event.target.checked)
                          }
                        />
                        Akun aktif
                      </label>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="pt-1">
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Simpan"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
