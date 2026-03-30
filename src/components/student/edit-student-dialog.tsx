"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import type { StudentListItem } from "@/hooks/use-student-list";
import { apiPatch } from "@/lib/api/request";

const updateStudentSchema = z.object({
  nis: z.string().min(5, "NIS minimal 5 karakter"),
  nisn: z
    .string()
    .regex(/^[0-9]{10}$/, "NISN harus 10 digit angka")
    .optional()
    .or(z.literal("")),
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  gender: z.enum(["L", "P"]),
  grade: z.string().min(1, "Kelas wajib diisi"),
  parentName: z.string().optional(),
  parentPhone: z
    .string()
    .regex(/^[0-9+\-\s]+$/, "Nomor HP tidak valid")
    .optional()
    .or(z.literal("")),
  tempatLahir: z.string().optional(),
  tanggalLahir: z.string().optional(),
  alamat: z.string().optional(),
  accountEmail: z
    .string()
    .email("Email akun tidak valid")
    .optional()
    .or(z.literal("")),
  newPassword: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .optional()
    .or(z.literal("")),
  confirmNewPassword: z
    .string()
    .min(8, "Konfirmasi password minimal 8 karakter")
    .optional()
    .or(z.literal("")),
});

type UpdateStudentFormValues = z.infer<typeof updateStudentSchema>;

interface EditStudentDialogProps {
  student: StudentListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function resolveStudentActionKey(student: StudentListItem) {
  const rawId = student.id?.trim();
  if (
    rawId &&
    rawId !== "null" &&
    rawId !== "undefined" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      rawId,
    )
  ) {
    return rawId;
  }

  return student.nis.trim();
}

export function EditStudentDialog({
  student,
  open,
  onOpenChange,
  onSuccess,
}: EditStudentDialogProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<UpdateStudentFormValues>({
    resolver: zodResolver(updateStudentSchema),
    defaultValues: {
      nis: "",
      nisn: "",
      fullName: "",
      gender: "L",
      grade: "",
      parentName: "",
      parentPhone: "",
      tempatLahir: "",
      tanggalLahir: "",
      alamat: "",
      accountEmail: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  useEffect(() => {
    if (!student) {
      return;
    }

    form.reset({
      nis: student.nis,
      nisn: student.nisn ?? "",
      fullName: student.fullName,
      gender: student.gender,
      grade: student.grade,
      parentName: student.parentName ?? "",
      parentPhone: student.parentPhone ?? "",
      tempatLahir: student.tempatLahir ?? "",
      tanggalLahir: student.tanggalLahir
        ? new Date(student.tanggalLahir).toISOString().slice(0, 10)
        : "",
      alamat: student.alamat ?? "",
      accountEmail: student.accountEmail ?? "",
      newPassword: "",
      confirmNewPassword: "",
    });
  }, [form, student]);

  async function handleSubmit(values: UpdateStudentFormValues) {
    if (!student) {
      return;
    }

    setLoading(true);
    try {
      if (
        student.hasAccount &&
        values.newPassword !== values.confirmNewPassword
      ) {
        form.setError("confirmNewPassword", {
          message: "Konfirmasi password tidak cocok",
        });
        setLoading(false);
        return;
      }

      await apiPatch<{ updated: true }>(
        `/api/students/${resolveStudentActionKey(student)}`,
        {
          nis: values.nis.trim(),
          nisn: values.nisn?.trim() || "",
          fullName: values.fullName.trim(),
          gender: values.gender,
          grade: values.grade.trim(),
          parentName: values.parentName?.trim() || "",
          parentPhone: values.parentPhone?.trim() || "",
          tempatLahir: values.tempatLahir?.trim() || "",
          tanggalLahir: values.tanggalLahir || undefined,
          alamat: values.alamat?.trim() || "",
          account: student.hasAccount
            ? {
                email: values.accountEmail?.trim()
                  ? values.accountEmail.trim().toLowerCase()
                  : undefined,
                password: values.newPassword || undefined,
                confirmPassword: values.confirmNewPassword || undefined,
              }
            : undefined,
        },
      );
      toast.success("Data siswa berhasil diperbarui");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memperbarui siswa",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(42rem,calc(100dvh-4rem))] w-[calc(100vw-1rem)] flex-col overflow-hidden border-zinc-800 bg-zinc-900 p-0 text-white sm:max-w-xl">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>Edit Siswa</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Perbarui data identitas siswa.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="nis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NIS</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="border-zinc-800 bg-zinc-950"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nisn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NISN</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="border-zinc-800 bg-zinc-950"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Lengkap</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="border-zinc-800 bg-zinc-950"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kelas</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="border-zinc-800 bg-zinc-950"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jenis Kelamin</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="border-zinc-800 bg-zinc-950">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
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
                          className="border-zinc-800 bg-zinc-950"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tempatLahir"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tempat Lahir</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="border-zinc-800 bg-zinc-950"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="parentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Wali</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="border-zinc-800 bg-zinc-950"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="parentPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No. HP Wali</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="border-zinc-800 bg-zinc-950"
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
                        className="border-zinc-800 bg-zinc-950"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {student?.hasAccount ? (
                <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <p className="text-sm font-medium text-zinc-200">
                    Kredensial Akun Login
                  </p>
                  <FormField
                    control={form.control}
                    name="accountEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Login</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            className="border-zinc-800 bg-zinc-950"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password Baru</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              className="border-zinc-800 bg-zinc-950"
                              placeholder="Kosongkan jika tidak diganti"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmNewPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Konfirmasi Password Baru</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              className="border-zinc-800 bg-zinc-950"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    Password akun tidak bisa ditampilkan karena disimpan dalam
                    bentuk hash terenkripsi.
                  </p>
                </div>
              ) : null}
            </div>

            <DialogFooter className="shrink-0 border-t border-zinc-800 px-4 py-4 sm:px-6">
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
      </DialogContent>
    </Dialog>
  );
}
