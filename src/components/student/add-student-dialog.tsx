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
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tambah Siswa</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Lengkapi data identitas siswa baru.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4 py-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NIS</FormLabel>
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
                name="nisn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NISN</FormLabel>
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
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kelas</FormLabel>
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
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis Kelamin</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-zinc-950 border-zinc-800">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                name="parentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Wali</FormLabel>
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

            <FormField
              control={form.control}
              name="parentPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>No. HP Wali</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-zinc-950 border-zinc-800" />
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
                    <Input {...field} className="bg-zinc-950 border-zinc-800" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="createAccount"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                    Buat akun login untuk siswa ini
                  </label>
                  <FormMessage />
                </FormItem>
              )}
            />

            {createAccount ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-4">
                <p className="text-sm font-medium text-zinc-200">
                  Kredensial Akun Siswa
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Login</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            className="bg-zinc-950 border-zinc-800"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password Login</FormLabel>
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
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Konfirmasi Password</FormLabel>
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
            ) : null}

            <DialogFooter>
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
