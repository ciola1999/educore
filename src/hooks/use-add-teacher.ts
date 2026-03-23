"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { apiPost } from "@/lib/api/request";

const addTeacherSchema = z.object({
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  role: z.enum(["admin", "teacher", "staff"]),
  password: z.string().min(8, "Password minimal 8 karakter"),
  nip: z.string().optional(),
  jenisKelamin: z.enum(["L", "P"]).optional(),
  tempatLahir: z.string().optional(),
  tanggalLahir: z.string().optional(),
  alamat: z.string().optional(),
  noTelepon: z.string().optional(),
  isActive: z.boolean(),
});

type AddTeacherFormValues = z.infer<typeof addTeacherSchema>;

type UseAddTeacherHookOptions = {
  onSuccess?: () => void;
};

export function useAddTeacherHook(options: UseAddTeacherHookOptions = {}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<AddTeacherFormValues>({
    resolver: zodResolver(addTeacherSchema),
    defaultValues: {
      fullName: "",
      email: "",
      role: "teacher",
      password: "",
      nip: "",
      jenisKelamin: undefined,
      tempatLahir: "",
      tanggalLahir: "",
      alamat: "",
      noTelepon: "",
      isActive: true,
    },
  });

  const onSubmit = async (values: AddTeacherFormValues) => {
    setLoading(true);

    try {
      await apiPost<{ id: string }>("/api/teachers", {
        fullName: values.fullName,
        email: values.email,
        role: values.role,
        password: values.password,
        nip: values.nip || null,
        jenisKelamin: values.jenisKelamin || null,
        tempatLahir: values.tempatLahir || null,
        tanggalLahir: values.tanggalLahir || null,
        alamat: values.alamat || null,
        noTelepon: values.noTelepon || null,
        isActive: values.isActive,
      });
      toast.success("Guru berhasil ditambahkan!");
      setOpen(false);
      form.reset();
      options.onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan sistem";

      if (message.toLowerCase().includes("email")) {
        form.setError("email", { message });
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return {
    open,
    setOpen,
    loading,
    form,
    onSubmit: form.handleSubmit(onSubmit),
  };
}
