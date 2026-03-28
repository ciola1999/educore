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
  type ClassFormValues,
  type ClassItem,
  classFormSchema,
  type TeacherOption,
} from "./schemas";

const NO_HOMEROOM_VALUE = "__none__";

export function EditClassDialog({
  classData,
  onSuccess,
}: {
  classData: ClassItem;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: classData.name,
      academicYear: classData.academicYear,
      homeroomTeacherId: classData.homeroomTeacherId ?? "",
    },
  });

  useEffect(() => {
    form.reset({
      name: classData.name,
      academicYear: classData.academicYear,
      homeroomTeacherId: classData.homeroomTeacherId ?? "",
    });
  }, [classData, form]);

  useEffect(() => {
    if (!open) return;

    void apiGet<TeacherOption[]>("/api/teachers?view=options")
      .then((data) => {
        setTeachers(data || []);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "Gagal memuat data guru",
        );
      });
  }, [open]);

  async function handleSubmit(values: ClassFormValues) {
    setLoading(true);
    try {
      await apiPatch<{ updated: true }>(`/api/classes/${classData.id}`, {
        name: values.name,
        academicYear: values.academicYear,
        homeroomTeacherId: values.homeroomTeacherId || undefined,
      });
      setOpen(false);
      onSuccess();
      toast.success("Kelas berhasil diperbarui");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memperbarui kelas",
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
        className="h-8 w-8 text-zinc-400 hover:text-blue-400"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update class details and homeroom teacher.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="grid gap-4 py-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. X-RPL-1"
                        className="bg-zinc-950 border-zinc-700"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="academicYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academic Year</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. 2025/2026"
                        className="bg-zinc-950 border-zinc-700"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="homeroomTeacherId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Homeroom Teacher</FormLabel>
                    <Select
                      value={field.value || NO_HOMEROOM_VALUE}
                      onValueChange={(value) =>
                        field.onChange(value === NO_HOMEROOM_VALUE ? "" : value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="bg-zinc-950 border-zinc-700">
                          <SelectValue placeholder="Select teacher" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        <SelectItem value={NO_HOMEROOM_VALUE}>
                          Tanpa wali kelas
                        </SelectItem>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.fullName}
                          </SelectItem>
                        ))}
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
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save Changes"
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
