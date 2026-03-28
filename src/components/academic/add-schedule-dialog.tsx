"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type Control, type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";
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
import { apiGet, apiPost } from "@/lib/api/request";
import {
  type JadwalFormValues,
  jadwalFormSchema,
  type TeachingAssignmentScheduleOption,
} from "./schemas";

const DAY_OPTIONS = [
  { value: "0", label: "Minggu" },
  { value: "1", label: "Senin" },
  { value: "2", label: "Selasa" },
  { value: "3", label: "Rabu" },
  { value: "4", label: "Kamis" },
  { value: "5", label: "Jumat" },
  { value: "6", label: "Sabtu" },
];

export function AddScheduleDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [assignments, setAssignments] = useState<
    TeachingAssignmentScheduleOption[]
  >([]);
  const defaultValues = useMemo<JadwalFormValues>(
    () => ({
      guruMapelId: "",
      hari: 1,
      jamMulai: "07:00",
      jamSelesai: "08:00",
      ruangan: "",
    }),
    [],
  );
  const form = useForm<JadwalFormValues>({
    resolver: zodResolver(jadwalFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      return;
    }

    void apiGet<TeachingAssignmentScheduleOption[]>(
      "/api/teaching-assignments?view=schedule-options",
    )
      .then((rows) => setAssignments(rows || []))
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memuat assignment jadwal",
        );
      });
  }, [defaultValues, form, open]);

  async function handleSubmit(values: JadwalFormValues) {
    try {
      await apiPost<{ id: string }>("/api/schedules", values);
      toast.success("Jadwal berhasil dibuat");
      form.reset(defaultValues);
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat jadwal",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500">
          <Plus className="h-4 w-4" />
          Tambah Jadwal
        </Button>
      </DialogTrigger>
      <DialogContent className="border-zinc-800 bg-zinc-900 text-white">
        <DialogHeader>
          <DialogTitle>Tambah Jadwal</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Buat jadwal canonical berbasis assignment guru-mapel.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4 py-2"
          >
            <ScheduleSelect
              control={form.control}
              name="guruMapelId"
              label="Assignment Guru-Mapel"
              placeholder="Pilih assignment"
              options={assignments.map((item) => ({
                value: item.id,
                label: `${item.guruName} | ${item.mataPelajaranName} | ${item.kelasName} | ${item.semesterName} - ${item.tahunAjaranNama || "-"}`,
              }))}
            />
            <ScheduleSelect
              control={form.control}
              name="hari"
              label="Hari"
              placeholder="Pilih hari"
              options={DAY_OPTIONS}
            />
            <ScheduleInput
              control={form.control}
              name="jamMulai"
              label="Jam Mulai"
              placeholder="07:00"
            />
            <ScheduleInput
              control={form.control}
              name="jamSelesai"
              label="Jam Selesai"
              placeholder="08:00"
            />
            <ScheduleInput
              control={form.control}
              name="ruangan"
              label="Ruangan"
              placeholder="Lab IPA / Kelas 7A"
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {form.formState.isSubmitting ? (
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

function ScheduleSelect({
  control,
  name,
  label,
  placeholder,
  options,
}: {
  control: Control<JadwalFormValues>;
  name: FieldPath<JadwalFormValues>;
  label: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={String(field.value)}
            onValueChange={(value) => {
              field.onChange(name === "hari" ? Number(value) : value);
            }}
          >
            <FormControl>
              <SelectTrigger className="border-zinc-700 bg-zinc-950">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ScheduleInput({
  control,
  name,
  label,
  placeholder,
}: {
  control: Control<JadwalFormValues>;
  name: FieldPath<JadwalFormValues>;
  label: string;
  placeholder: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              value={typeof field.value === "string" ? field.value : ""}
              placeholder={placeholder}
              className="border-zinc-700 bg-zinc-950"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
