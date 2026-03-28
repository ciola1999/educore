"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
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
  type JadwalFormValues,
  type JadwalItem,
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

export function EditScheduleDialog({
  schedule,
  onSuccess,
}: {
  schedule: JadwalItem;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<
    TeachingAssignmentScheduleOption[]
  >([]);
  const form = useForm<JadwalFormValues>({
    resolver: zodResolver(jadwalFormSchema),
    defaultValues: {
      guruMapelId: schedule.guruMapelId,
      hari: schedule.hari,
      jamMulai: schedule.jamMulai,
      jamSelesai: schedule.jamSelesai,
      ruangan: schedule.ruangan || "",
    },
  });

  useEffect(() => {
    form.reset({
      guruMapelId: schedule.guruMapelId,
      hari: schedule.hari,
      jamMulai: schedule.jamMulai,
      jamSelesai: schedule.jamSelesai,
      ruangan: schedule.ruangan || "",
    });
  }, [form, schedule]);

  useEffect(() => {
    if (!open) return;

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
  }, [open]);

  async function handleSubmit(values: JadwalFormValues) {
    setLoading(true);
    try {
      await apiPatch(`/api/schedules/${schedule.id}`, values);
      toast.success("Jadwal berhasil diperbarui");
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memperbarui jadwal",
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
        className="h-8 w-8 text-zinc-400 hover:text-emerald-300"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle>Edit Jadwal</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Perbarui slot jadwal tanpa keluar dari boundary guru-mapel.
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
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-500"
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
