"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, School } from "lucide-react";
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
  type ClassFormValues,
  classFormSchema,
  type TeacherOption,
} from "./schemas";

const NO_HOMEROOM_VALUE = "__none__";

export function AddClassDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  // 2. Setup Form Hook
  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: "",
      academicYear: "",
      homeroomTeacherId: "",
    },
  });

  // 3. Fetch Data saat Dialog dibuka
  useEffect(() => {
    if (open) {
      const fetchTeachers = async () => {
        setLoadingTeachers(true);
        try {
          const data = await apiGet<TeacherOption[]>(
            "/api/teachers?view=options",
          );
          setTeachers(data || []);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Gagal memuat data guru.",
          );
        } finally {
          setLoadingTeachers(false);
        }
      };

      void fetchTeachers();
    }
  }, [open]);

  // 4. Handle Submission
  async function onSubmit(values: ClassFormValues) {
    try {
      await apiPost<{ id: string }>("/api/classes", {
        name: values.name,
        academicYear: values.academicYear,
        homeroomTeacherId: values.homeroomTeacherId || undefined,
      });

      toast.success("Kelas berhasil dibuat", {
        description: `${values.name} - ${values.academicYear}`,
      });

      form.reset();
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error("Gagal membuat kelas", {
        description:
          error instanceof Error ? error.message : "Silakan coba lagi.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Kelas
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <School className="h-5 w-5 text-primary" />
            Tambah Kelas Baru
          </DialogTitle>
          <DialogDescription>
            Buat entitas kelas baru dan tentukan wali kelasnya.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4"
          >
            {/* Field: Nama Kelas */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Kelas</FormLabel>
                  <FormControl>
                    <Input placeholder="Contoh: X-RPL-1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Field: Tahun Ajaran */}
            <FormField
              control={form.control}
              name="academicYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tahun Ajaran</FormLabel>
                  <FormControl>
                    <Input placeholder="2025/2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Field: Wali Kelas */}
            <FormField
              control={form.control}
              name="homeroomTeacherId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Wali Kelas</FormLabel>
                  <Select
                    value={field.value || NO_HOMEROOM_VALUE}
                    onValueChange={(value) =>
                      field.onChange(value === NO_HOMEROOM_VALUE ? "" : value)
                    }
                    disabled={loadingTeachers}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingTeachers
                              ? "Memuat data..."
                              : "Pilih Wali Kelas"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_HOMEROOM_VALUE}>
                        Tanpa wali kelas
                      </SelectItem>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.fullName}
                        </SelectItem>
                      ))}
                      {teachers.length === 0 && !loadingTeachers && (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Tidak ada data guru.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Buat Kelas"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
