"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { StudentListItem } from "@/hooks/use-student-list";
import { apiGet, apiPost } from "@/lib/api/request";
import { isUuidLikeClassValue } from "@/lib/utils/class-name";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const repairFormSchema = z.object({
  sourceToken: z.string().trim().min(1, "Grup data legacy wajib dipilih"),
  className: z.string().trim().min(1, "Kelas tujuan wajib diisi"),
});

type RepairFormValues = z.infer<typeof repairFormSchema>;
type LegacyGroup = {
  sourceToken: string;
  count: number;
  samples: Array<{
    id: string;
    nis: string;
    fullName: string;
  }>;
};

type Props = {
  students: StudentListItem[];
  onSuccess: () => void;
};

const bulkRepairOutlineButtonClass =
  "rounded-2xl border-orange-700/70 bg-orange-950/40 text-orange-100 hover:border-orange-500 hover:bg-orange-900/60 hover:text-white disabled:opacity-50";

export function BulkRepairStudentClassesDialog({ students, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [legacyGroups, setLegacyGroups] = useState<LegacyGroup[]>([]);

  const legacyStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          isUuidLikeClassValue(student.grade) || student.grade === "UNASSIGNED",
      ),
    [students],
  );

  const form = useForm<RepairFormValues>({
    resolver: zodResolver(repairFormSchema),
    defaultValues: {
      sourceToken: "",
      className: "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setGroupsLoading(true);
    void apiGet<LegacyGroup[]>("/api/students/classes/legacy-groups")
      .then((result) => {
        setLegacyGroups(result);
        if (result.length > 0) {
          form.setValue("sourceToken", result[0]?.sourceToken ?? "");
        }
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memuat grup data legacy",
        );
      })
      .finally(() => {
        setGroupsLoading(false);
      });
  }, [form, open]);

  async function handleSubmit(values: RepairFormValues) {
    if (legacyStudents.length === 0) {
      toast.error("Tidak ada siswa legacy yang perlu diperbaiki");
      return;
    }

    setLoading(true);
    try {
      const result = await apiPost<{ updated: number; className: string }>(
        "/api/students/classes/repair",
        {
          sourceToken: values.sourceToken,
          className: values.className.trim(),
        },
      );

      toast.success(
        result.updated > 0
          ? `${result.updated} siswa legacy berhasil dipindahkan ke kelas ${result.className}`
          : "Tidak ada siswa legacy yang perlu diperbaiki",
      );
      setOpen(false);
      form.reset();
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memperbaiki kelas siswa",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedGroup = legacyGroups.find(
    (group) => group.sourceToken === form.watch("sourceToken"),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          form.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={legacyStudents.length === 0}
          className={bulkRepairOutlineButtonClass}
        >
          <Wrench className="mr-2 h-4 w-4" />
          Repair Kelas ({legacyStudents.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Repair Kelas Siswa Legacy</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Perbaiki massal siswa yang kelasnya masih UUID atau{" "}
            <span className="font-medium text-zinc-200">UNASSIGNED</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 text-sm text-orange-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">
                Terdeteksi di roster saat ini: {legacyStudents.length} siswa
              </p>
              <p className="text-orange-100/80">
                Sekarang repair dilakukan per grup sumber legacy agar tidak
                mencampur siswa dari kelas asli yang berbeda.
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="sourceToken"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grup Data Legacy</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={groupsLoading || legacyGroups.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger className="border-zinc-800 bg-zinc-950">
                        <SelectValue
                          placeholder={
                            groupsLoading
                              ? "Memuat grup..."
                              : "Pilih grup data legacy"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                      {legacyGroups.map((group) => (
                        <SelectItem
                          key={group.sourceToken}
                          value={group.sourceToken}
                        >
                          {group.sourceToken === "UNASSIGNED"
                            ? `UNASSIGNED (${group.count} siswa)`
                            : `${group.sourceToken.slice(0, 8)}... (${group.count} siswa)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedGroup ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-sm text-zinc-300">
                <p className="font-medium text-zinc-100">
                  Sampel siswa di grup ini
                </p>
                <div className="mt-2 space-y-1">
                  {selectedGroup.samples.map((sample) => (
                    <p key={sample.id}>
                      {sample.nis} - {sample.fullName}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="className"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kelas Tujuan</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Contoh: XII TSM 1"
                      className="border-zinc-800 bg-zinc-950"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  loading ||
                  legacyStudents.length === 0 ||
                  groupsLoading ||
                  legacyGroups.length === 0
                }
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Proses Repair"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
