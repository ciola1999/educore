"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
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
  DialogTrigger,
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
import { apiPost } from "@/lib/api/request";

const createStudentSchema = z
  .object({
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
    createAccount: z.boolean(),
    email: z
      .string()
      .email("Email akun tidak valid")
      .optional()
      .or(z.literal("")),
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .optional()
      .or(z.literal("")),
    confirmPassword: z
      .string()
      .min(8, "Konfirmasi password minimal 8 karakter")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (!value.createAccount) {
      return;
    }

    if (!value.email?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Email akun siswa wajib diisi",
      });
    }

    if (!value.password?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Password akun siswa wajib diisi",
      });
    }

    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Konfirmasi password tidak cocok",
      });
    }
  });

type CreateStudentFormValues = z.infer<typeof createStudentSchema>;

interface AddStudentDialogProps {
  onSuccess: () => void;
}

export function AddStudentDialog({ onSuccess }: AddStudentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<CreateStudentFormValues>({
    resolver: zodResolver(createStudentSchema),
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
      createAccount: false,
      email: "",
      password: "",
      confirmPassword: "",
    },
  });
  const createAccount = form.watch("createAccount");

  async function handleSubmit(values: CreateStudentFormValues) {
    setLoading(true);
    try {
      const result = await apiPost<{
        id: string;
        created: true;
        userCreated?: boolean;
      }>("/api/students", {
        nis: values.nis.trim(),
        nisn: values.nisn?.trim() || undefined,
        fullName: values.fullName.trim(),
        gender: values.gender,
        grade: values.grade.trim(),
        parentName: values.parentName?.trim() || undefined,
        parentPhone: values.parentPhone?.trim() || undefined,
        tempatLahir: values.tempatLahir?.trim() || undefined,
        tanggalLahir: values.tanggalLahir || undefined,
        alamat: values.alamat?.trim() || undefined,
        account: values.createAccount
          ? {
              email: values.email?.trim().toLowerCase(),
              password: values.password || "",
            }
          : undefined,
      });

      toast.success(
        result.userCreated
          ? "Siswa dan akun login berhasil ditambahkan"
          : "Siswa berhasil ditambahkan",
      );
      form.reset();
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menambahkan siswa",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-sky-600 hover:bg-sky-500 text-white gap-2">
          <Plus className="h-4 w-4" />
          Tambah Siswa
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(50rem,calc(100dvh-4rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-zinc-100 sm:max-w-2xl">
        <DialogHeader className="shrink-0 px-6 pt-6">
          <DialogTitle>Tambah Siswa</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Lengkapi data identitas siswa baru.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400">NIS</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Masukkan NIS..."
                          className="bg-zinc-900/50 border-zinc-800 focus:ring-sky-500/20"
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
                      <FormLabel className="text-zinc-400">
                        NISN (Opsional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Masukkan 10 digit NISN..."
                          className="bg-zinc-900/50 border-zinc-800 focus:ring-sky-500/20"
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
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400">
                        Nama Lengkap
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Nama lengkap siswa..."
                          className="bg-zinc-900/50 border-zinc-800 focus:ring-sky-500/20"
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
                      <FormLabel className="text-zinc-400">Kelas</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Contoh: X-A, XI-IPA-1..."
                          className="bg-zinc-900/50 border-zinc-800 focus:ring-sky-500/20"
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
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400">
                        Jenis Kelamin
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-zinc-900/50 border-zinc-800 focus:ring-sky-500/20">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
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
                      <FormLabel className="text-zinc-400">
                        Tanggal Lahir
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          className="bg-zinc-900/50 border-zinc-800 focus:ring-sky-500/20 [color-scheme:dark]"
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
                  name="tempatLahir"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-400">
                        Tempat Lahir
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Kota lahir..."
                          className="bg-zinc-900/50 border-zinc-800 focus:ring-sky-500/20"
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
                      <FormLabel className="text-zinc-400">Nama Wali</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Nama orang tua/wali..."
                          className="bg-zinc-900/50 border-zinc-800 focus:ring-sky-500/20"
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
                    <FormLabel className="text-zinc-400">No. HP Wali</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Contoh: 0812..."
                        className="bg-zinc-900/50 border-zinc-800 focus:ring-sky-500/20"
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
                    <FormLabel className="text-zinc-400">Alamat</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Alamat lengkap tempat tinggal..."
                        className="bg-zinc-900/50 border-zinc-800 focus:ring-sky-500/20"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <FormField
                  control={form.control}
                  name="createAccount"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 transition-colors hover:bg-zinc-900/50">
                      <FormControl>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-sky-600 focus:ring-offset-zinc-950"
                          checked={field.value}
                          onChange={(event) =>
                            field.onChange(event.target.checked)
                          }
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-medium text-zinc-100">
                          Buat akun login untuk siswa ini
                        </FormLabel>
                        <p className="text-[12px] text-zinc-500">
                          Siswa akan dapat login menggunakan email dan password.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {createAccount ? (
                <div className="space-y-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 transition-all">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]" />
                    <p className="text-sm font-semibold text-sky-200">
                      Kredensial Akun Siswa
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sky-200/70">
                            Email Login
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="email@sekolah.com"
                              className="bg-zinc-900/80 border-zinc-800 focus:ring-sky-500/20"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sky-200/70">
                            Password Login
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Min. 8 karakter..."
                              className="bg-zinc-900/80 border-zinc-800 focus:ring-sky-500/20"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sky-200/70">
                          Konfirmasi Password
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="Ulangi password..."
                            className="bg-zinc-900/80 border-zinc-800 focus:ring-sky-500/20"
                          />
                        </FormControl>
                        <FormMessage className="text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}
            </div>

            <DialogFooter className="shrink-0 bg-zinc-900/50 px-6 py-4 border-t border-zinc-800/50">
              <Button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto bg-sky-600 hover:bg-sky-500 px-8"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menyimpan...</span>
                  </div>
                ) : (
                  "Simpan Data Siswa"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
