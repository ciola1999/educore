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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPatch } from "@/lib/api/request";
import {
  type ClassItem,
  type SemesterItem,
  type SubjectItem,
  type TeacherOption,
  type TeachingAssignmentFormValues,
  type TeachingAssignmentItem,
  teachingAssignmentFormSchema,
} from "./schemas";

export function EditTeachingAssignmentDialog({
  assignment,
  onSuccess,
}: {
  assignment: TeachingAssignmentItem;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [semesters, setSemesters] = useState<SemesterItem[]>([]);
  const form = useForm<TeachingAssignmentFormValues>({
    resolver: zodResolver(teachingAssignmentFormSchema),
    defaultValues: {
      guruId: assignment.guruId,
      mataPelajaranId: assignment.mataPelajaranId,
      kelasId: assignment.kelasId,
      semesterId: assignment.semesterId,
    },
  });

  useEffect(() => {
    form.reset({
      guruId: assignment.guruId,
      mataPelajaranId: assignment.mataPelajaranId,
      kelasId: assignment.kelasId,
      semesterId: assignment.semesterId,
    });
  }, [assignment, form]);

  useEffect(() => {
    if (!open) return;
    void Promise.all([
      apiGet<TeacherOption[]>("/api/teachers?view=options"),
      apiGet<SubjectItem[]>("/api/subjects"),
      apiGet<ClassItem[]>("/api/classes"),
      apiGet<SemesterItem[]>("/api/semesters"),
    ])
      .then(([teacherRows, subjectRows, classRows, semesterRows]) => {
        setTeachers(teacherRows || []);
        setSubjects(subjectRows || []);
        setClasses(classRows || []);
        setSemesters(semesterRows || []);
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memuat opsi assignment",
        );
      });
  }, [open]);

  async function handleSubmit(values: TeachingAssignmentFormValues) {
    setLoading(true);
    try {
      await apiPatch(`/api/teaching-assignments/${assignment.id}`, values);
      toast.success("Assignment guru-mapel berhasil diperbarui");
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memperbarui assignment",
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
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Edit Assignment Guru-Mapel</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Perbarui kombinasi guru, mapel, kelas, dan semester.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-4 py-2"
            >
              <AssignmentSelect
                control={form.control}
                name="guruId"
                label="Guru"
                placeholder="Pilih guru"
                options={teachers.map((item) => ({
                  value: item.id,
                  label: item.fullName,
                }))}
              />
              <AssignmentSelect
                control={form.control}
                name="mataPelajaranId"
                label="Mata Pelajaran"
                placeholder="Pilih mapel"
                options={subjects.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.code})`,
                }))}
              />
              <AssignmentSelect
                control={form.control}
                name="kelasId"
                label="Kelas"
                placeholder="Pilih kelas"
                options={classes.map((item) => ({
                  value: item.id,
                  label: `${item.name} - ${item.academicYear}`,
                }))}
              />
              <AssignmentSelect
                control={form.control}
                name="semesterId"
                label="Semester"
                placeholder="Pilih semester"
                options={semesters.map((item) => ({
                  value: item.id,
                  label: `${item.nama} - ${item.tahunAjaranNama || "-"}`,
                }))}
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

function AssignmentSelect({
  control,
  name,
  label,
  placeholder,
  options,
}: {
  control: Control<TeachingAssignmentFormValues>;
  name: FieldPath<TeachingAssignmentFormValues>;
  label: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selectedOption = options.find(
          (option) => option.value === field.value,
        );

        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="bg-zinc-950 border-zinc-700">
                  {selectedOption ? (
                    <span className="block truncate text-left">
                      {selectedOption.label}
                    </span>
                  ) : (
                    <SelectValue placeholder={placeholder} />
                  )}
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
