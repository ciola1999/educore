"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
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
import type { StudentListItem } from "@/hooks/use-student-list";
import { apiPost } from "@/lib/api/request";

const bulkAccountSchema = z
  .object({
    scope: z.enum(["all_without_account", "visible_without_account"]),
    emailDomain: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,63}$/,
        "Domain email tidak valid",
      ),
    password: z.string().min(8, "Password default minimal 8 karakter"),
    confirmPassword: z
      .string()
      .min(8, "Konfirmasi password minimal 8 karakter"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak cocok",
  });

type BulkAccountFormValues = z.infer<typeof bulkAccountSchema>;

interface BulkCreateStudentAccountsDialogProps {
  students: StudentListItem[];
  visibleStudents: StudentListItem[];
  onSuccess: () => void;
}

const bulkCreateAccountOutlineButtonClass =
  "rounded-2xl border-emerald-700/70 bg-emerald-950/40 text-emerald-100 hover:border-emerald-500 hover:bg-emerald-900/60 hover:text-white";

export function BulkCreateStudentAccountsDialog({
  students,
  visibleStudents,
  onSuccess,
}: BulkCreateStudentAccountsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const allWithoutAccount = useMemo(
    () => students.filter((student) => !student.hasAccount),
    [students],
  );
  const visibleWithoutAccount = useMemo(
    () => visibleStudents.filter((student) => !student.hasAccount),
    [visibleStudents],
  );

  const form = useForm<BulkAccountFormValues>({
    resolver: zodResolver(bulkAccountSchema),
    defaultValues: {
      scope: "all_without_account",
      emailDomain: "student.educore.local",
      password: "",
      confirmPassword: "",
    },
  });

  const selectedScope = form.watch("scope");
  const candidateCount =
    selectedScope === "visible_without_account"
      ? visibleWithoutAccount.length
      : allWithoutAccount.length;

  async function handleSubmit(values: BulkAccountFormValues) {
    const targetStudents =
      values.scope === "visible_without_account"
        ? visibleWithoutAccount
        : allWithoutAccount;

    if (targetStudents.length === 0) {
      toast.error("Tidak ada siswa tanpa akun pada scope yang dipilih.");
      return;
    }

    setLoading(true);
    try {
      const result = await apiPost<{
        created: number;
        skipped: number;
        message: string;
      }>("/api/students/accounts/bulk", {
        studentIds: targetStudents.map((student) => student.id),
        emailDomain: values.emailDomain,
        password: values.password,
      });
      toast.success(result.message);
      setOpen(false);
      form.reset({
        ...values,
        password: "",
        confirmPassword: "",
      });
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal membuat akun student secara massal",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={bulkCreateAccountOutlineButtonClass}
        >
          <UsersRound className="mr-2 h-4 w-4" />
          Buat Akun Massal
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Akun Student Massal</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Sistem membuat email otomatis dengan pola{" "}
            <span className="font-mono text-zinc-200">NIS@domain</span>.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4 py-2"
          >
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scope Pembuatan</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectItem value="all_without_account">
                        Semua siswa tanpa akun ({allWithoutAccount.length})
                      </SelectItem>
                      <SelectItem value="visible_without_account">
                        Hasil filter aktif tanpa akun (
                        {visibleWithoutAccount.length})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emailDomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain Email</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-zinc-950 border-zinc-800" />
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
                  <FormLabel>Password Default</FormLabel>
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

            <p className="text-xs text-zinc-500">
              Target akun yang akan diproses:{" "}
              <span className="font-semibold text-zinc-300">
                {candidateCount}
              </span>
            </p>

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Proses Massal"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
