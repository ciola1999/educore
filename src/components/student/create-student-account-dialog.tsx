"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserRoundPlus } from "lucide-react";
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
import type { StudentListItem } from "@/hooks/use-student-list";
import { apiPost } from "@/lib/api/request";

const createStudentAccountSchema = z
  .object({
    email: z.string().email("Email akun siswa tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    confirmPassword: z
      .string()
      .min(8, "Konfirmasi password minimal 8 karakter"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak cocok",
  });

type CreateStudentAccountFormValues = z.infer<
  typeof createStudentAccountSchema
>;

interface CreateStudentAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentListItem | null;
  onSuccess: () => void;
}

export function CreateStudentAccountDialog({
  open,
  onOpenChange,
  student,
  onSuccess,
}: CreateStudentAccountDialogProps) {
  const [loading, setLoading] = useState(false);
  const form = useForm<CreateStudentAccountFormValues>({
    resolver: zodResolver(createStudentAccountSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!student) {
      return;
    }

    const suggestedEmail = `${student.nis}@student.educore.local`;
    form.reset({
      email: suggestedEmail,
      password: "",
      confirmPassword: "",
    });
  }, [form, student]);

  async function handleSubmit(values: CreateStudentAccountFormValues) {
    if (!student) {
      return;
    }

    setLoading(true);
    try {
      await apiPost<{ accountCreated: true }>(
        `/api/students/${student.id}/account`,
        {
          email: values.email.trim().toLowerCase(),
          password: values.password,
        },
      );
      toast.success("Akun login siswa berhasil dibuat");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat akun siswa",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPlus className="h-5 w-5 text-sky-300" />
            Buat Akun Login Siswa
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {student
              ? `Buat akun login untuk ${student.fullName} (${student.nis}).`
              : "Buat akun login siswa."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4 py-2"
          >
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

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Buat Akun"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
