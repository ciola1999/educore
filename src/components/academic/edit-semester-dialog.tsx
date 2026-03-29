"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { apiGet, apiPatch } from "@/lib/api/request";
import {
  type AcademicYearOption,
  type SemesterFormValues,
  type SemesterItem,
  semesterFormSchema,
} from "./schemas";

function toDateInputValue(value: string | Date | number) {
  const normalizedDate =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value < 10_000_000_000 ? value * 1000 : value)
        : null;

  if (normalizedDate) {
    const year = normalizedDate.getFullYear();
    const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");
    const day = String(normalizedDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return "";
}

export function EditSemesterDialog({
  semester,
  onSuccess,
}: {
  semester: SemesterItem;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const form = useForm<SemesterFormValues>({
    resolver: zodResolver(semesterFormSchema),
    defaultValues: {
      tahunAjaranId: semester.tahunAjaranId,
      nama: semester.nama,
      tanggalMulai: toDateInputValue(semester.tanggalMulai),
      tanggalSelesai: toDateInputValue(semester.tanggalSelesai),
      isActive: semester.isActive,
    },
  });

  useEffect(() => {
    form.reset({
      tahunAjaranId: semester.tahunAjaranId,
      nama: semester.nama,
      tanggalMulai: toDateInputValue(semester.tanggalMulai),
      tanggalSelesai: toDateInputValue(semester.tanggalSelesai),
      isActive: semester.isActive,
    });
  }, [semester, form]);

  useEffect(() => {
    if (!open) return;
    void apiGet<AcademicYearOption[]>("/api/academic-years")
      .then((data) => {
        setAcademicYears(data || []);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Gagal memuat tahun ajaran",
        );
      });
  }, [open]);

  async function handleSubmit(values: SemesterFormValues) {
    setLoading(true);
    try {
      await apiPatch(`/api/semesters/${semester.id}`, values);
      toast.success("Semester berhasil diperbarui");
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memperbarui semester",
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
        className="h-8 w-8 text-zinc-400 hover:text-sky-300"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Edit Semester</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Perbarui semester aktif dan keterkaitannya dengan tahun ajaran.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4 py-2"
            >
              <FormField
                control={form.control}
                name="tahunAjaranId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tahun Ajaran</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-zinc-950 border-zinc-700">
                          <SelectValue placeholder="Pilih tahun ajaran" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        {academicYears.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nama"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Semester</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-zinc-950 border-zinc-700"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="tanggalMulai"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal Mulai</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          className="bg-zinc-950 border-zinc-700"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tanggalSelesai"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tanggal Selesai</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          className="bg-zinc-950 border-zinc-700"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      value={field.value ? "active" : "inactive"}
                      onValueChange={(value) =>
                        field.onChange(value === "active")
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="bg-zinc-950 border-zinc-700">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        <SelectItem value="inactive">Tidak aktif</SelectItem>
                        <SelectItem value="active">Aktif</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-sky-600 hover:bg-sky-500"
                >
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
    </>
  );
}
