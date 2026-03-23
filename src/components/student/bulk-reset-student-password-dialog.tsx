"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
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
import type { StudentListItem } from "@/hooks/use-student-list";
import { apiPost } from "@/lib/api/request";

const bulkResetPasswordSchema = z
  .object({
    scope: z.enum(["all_with_account", "visible_with_account"]),
    password: z.string().min(8, "Password default minimal 8 karakter"),
    confirmPassword: z
      .string()
      .min(8, "Konfirmasi password minimal 8 karakter"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak cocok",
  });

type BulkResetPasswordFormValues = z.infer<typeof bulkResetPasswordSchema>;

interface BulkResetStudentPasswordDialogProps {
  students: StudentListItem[];
  visibleStudents: StudentListItem[];
  onSuccess: () => void;
}

export function BulkResetStudentPasswordDialog({
  students,
  visibleStudents,
  onSuccess,
}: BulkResetStudentPasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const allWithAccount = students.filter((student) => student.hasAccount);
  const visibleWithAccount = visibleStudents.filter(
    (student) => student.hasAccount,
  );

  const form = useForm<BulkResetPasswordFormValues>({
    resolver: zodResolver(bulkResetPasswordSchema),
    defaultValues: {
      scope: "all_with_account",
      password: "",
      confirmPassword: "",
    },
  });

  const selectedScope = form.watch("scope");
  const candidateCount =
    selectedScope === "visible_with_account"
      ? visibleWithAccount.length
      : allWithAccount.length;

  async function handleSubmit(values: BulkResetPasswordFormValues) {
    const targetStudents =
      values.scope === "visible_with_account"
        ? visibleWithAccount
        : allWithAccount;

    if (targetStudents.length === 0) {
      toast.error("Tidak ada akun siswa aktif pada scope yang dipilih.");
      return;
    }

    setLoading(true);
    try {
      const result = await apiPost<{
        updated: number;
        skipped: number;
        message: string;
      }>("/api/students/accounts/reset-password/bulk", {
        studentIds: targetStudents.map((student) => student.id),
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
          : "Gagal reset password massal akun student",
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
          className="border-amber-700/60 text-amber-300 hover:bg-amber-900/20"
        >
          <KeyRound className="mr-2 h-4 w-4" />
          Reset Password Massal
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Reset Password Massal Student</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Terapkan password default baru untuk akun student dalam scope yang
            dipilih.
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
                  <FormLabel>Scope Reset</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectItem value="all_with_account">
                        Semua siswa dengan akun ({allWithAccount.length})
                      </SelectItem>
                      <SelectItem value="visible_with_account">
                        Hasil filter aktif dengan akun (
                        {visibleWithAccount.length})
                      </SelectItem>
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
                  <FormLabel>Password Default Baru</FormLabel>
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
                  "Reset Password Massal"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
