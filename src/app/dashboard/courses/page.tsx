"use client";

import { ShieldCheck, ShieldMinus } from "lucide-react";
import { useQueryState } from "nuqs";
import { AcademicYearList } from "@/components/academic/academic-year-list";
import { ClassList } from "@/components/academic/class-list";
import { ScheduleLegacyAuditList } from "@/components/academic/schedule-legacy-audit-list";
import { ScheduleList } from "@/components/academic/schedule-list";
import { SemesterList } from "@/components/academic/semester-list";
import { SubjectList } from "@/components/academic/subject-list";
import { TeachingAssignmentList } from "@/components/academic/teaching-assignment-list";
import { InlineState } from "@/components/common/inline-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { checkPermission } from "@/lib/auth/rbac";

export default function CoursesPage() {
  const { user } = useAuth();
  const canReadAcademic = checkPermission(user, "academic:read");
  const canWriteAcademic = checkPermission(user, "academic:write");
  const [tab, setTab] = useQueryState("tab", {
    defaultValue: "academic-years",
    parse: (value) =>
      [
        "academic-years",
        "semesters",
        "classes",
        "subjects",
        "teaching-assignments",
        "schedules",
        "schedule-legacy-audit",
      ].includes(value)
        ? value
        : "academic-years",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-orange-400 to-amber-200 bg-clip-text text-transparent">
          Data Akademik
        </h2>
        <p className="text-zinc-400 mt-1">
          {canWriteAcademic
            ? "Kelola tahun ajaran, semester, kelas, mata pelajaran, assignment guru-mapel, dan jadwal canonical."
            : "Lihat master data akademik sesuai permission role aktif."}
        </p>
      </div>

      {!canReadAcademic ? (
        <InlineState
          title="Akses akademik tidak tersedia"
          description="Role aktif tidak memiliki permission untuk membaca data akademik."
          variant="warning"
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-amber-300" />
                <div>
                  <p className="text-sm font-semibold text-amber-200">
                    Akses Baca Aktif
                  </p>
                  <p className="text-sm text-amber-100/80">
                    Master data akademik tersedia untuk role{" "}
                    <span className="font-semibold">{user?.role || "-"}</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
              <div className="flex items-center gap-3">
                {canWriteAcademic ? (
                  <ShieldCheck className="h-5 w-5 text-sky-300" />
                ) : (
                  <ShieldMinus className="h-5 w-5 text-sky-300" />
                )}
                <div>
                  <p className="text-sm font-semibold text-sky-200">
                    {canWriteAcademic ? "Akses Tulis Aktif" : "Mode Read Only"}
                  </p>
                  <p className="text-sm text-sky-100/80">
                    {canWriteAcademic
                      ? "Form tambah, edit, dan hapus tetap tersedia untuk operator akademik."
                      : "Aksi tambah, edit, dan hapus disembunyikan karena role ini hanya memiliki permission academic:read."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => {
              void setTab(
                [
                  "academic-years",
                  "semesters",
                  "classes",
                  "subjects",
                  "teaching-assignments",
                  "schedules",
                  "schedule-legacy-audit",
                ].includes(value)
                  ? value
                  : "academic-years",
              );
            }}
            className="space-y-4"
          >
            <TabsList className="h-auto flex-wrap gap-2 border border-zinc-800 bg-zinc-950/80 p-2 text-zinc-300">
              <TabsTrigger
                value="academic-years"
                className="border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white data-[state=active]:border-zinc-700 data-[state=active]:bg-amber-500 data-[state=active]:text-zinc-950"
              >
                Tahun Ajaran
              </TabsTrigger>
              <TabsTrigger
                value="semesters"
                className="border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white data-[state=active]:border-zinc-700 data-[state=active]:bg-amber-500 data-[state=active]:text-zinc-950"
              >
                Semester
              </TabsTrigger>
              <TabsTrigger
                value="classes"
                className="border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white data-[state=active]:border-zinc-700 data-[state=active]:bg-amber-500 data-[state=active]:text-zinc-950"
              >
                Kelas
              </TabsTrigger>
              <TabsTrigger
                value="subjects"
                className="border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white data-[state=active]:border-zinc-700 data-[state=active]:bg-amber-500 data-[state=active]:text-zinc-950"
              >
                Mata Pelajaran
              </TabsTrigger>
              <TabsTrigger
                value="teaching-assignments"
                className="border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white data-[state=active]:border-zinc-700 data-[state=active]:bg-amber-500 data-[state=active]:text-zinc-950"
              >
                Guru Mapel
              </TabsTrigger>
              <TabsTrigger
                value="schedules"
                className="border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white data-[state=active]:border-zinc-700 data-[state=active]:bg-amber-500 data-[state=active]:text-zinc-950"
              >
                Jadwal
              </TabsTrigger>
              <TabsTrigger
                value="schedule-legacy-audit"
                className="border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white data-[state=active]:border-zinc-700 data-[state=active]:bg-amber-500 data-[state=active]:text-zinc-950"
              >
                Audit Jadwal
              </TabsTrigger>
            </TabsList>
            <TabsContent value={tab}>
              {tab === "academic-years" ? (
                <AcademicYearList readOnly={!canWriteAcademic} />
              ) : tab === "semesters" ? (
                <SemesterList readOnly={!canWriteAcademic} />
              ) : tab === "subjects" ? (
                <SubjectList readOnly={!canWriteAcademic} />
              ) : tab === "teaching-assignments" ? (
                <TeachingAssignmentList readOnly={!canWriteAcademic} />
              ) : tab === "schedules" ? (
                <ScheduleList readOnly={!canWriteAcademic} />
              ) : tab === "schedule-legacy-audit" ? (
                <ScheduleLegacyAuditList readOnly={!canWriteAcademic} />
              ) : (
                <ClassList readOnly={!canWriteAcademic} />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
