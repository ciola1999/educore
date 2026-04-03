"use client";

import {
  ClipboardList,
  GraduationCap,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useQueryState } from "nuqs";
import { InlineState } from "@/components/common/inline-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isTauri } from "@/core/env";
import { useAuth } from "@/hooks/use-auth";
import { checkPermission } from "@/lib/auth/rbac";

const AcademicYearList = dynamic(
  () =>
    import("@/components/academic/academic-year-list").then(
      (module) => module.AcademicYearList,
    ),
  { ssr: false },
);

const SemesterList = dynamic(
  () =>
    import("@/components/academic/semester-list").then(
      (module) => module.SemesterList,
    ),
  { ssr: false },
);

const ClassList = dynamic(
  () =>
    import("@/components/academic/class-list").then(
      (module) => module.ClassList,
    ),
  { ssr: false },
);

const SubjectList = dynamic(
  () =>
    import("@/components/academic/subject-list").then(
      (module) => module.SubjectList,
    ),
  { ssr: false },
);

const TeachingAssignmentList = dynamic(
  () =>
    import("@/components/academic/teaching-assignment-list").then(
      (module) => module.TeachingAssignmentList,
    ),
  { ssr: false },
);

const ScheduleList = dynamic(
  () =>
    import("@/components/academic/schedule-list").then(
      (module) => module.ScheduleList,
    ),
  { ssr: false },
);

const ScheduleLegacyAuditList = dynamic(
  () =>
    import("@/components/academic/schedule-legacy-audit-list").then(
      (module) => module.ScheduleLegacyAuditList,
    ),
  { ssr: false },
);

export default function CoursesPage() {
  const { user } = useAuth();
  const desktopRuntime = isTauri();
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
    <div className="min-h-full space-y-10 p-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 🚀 Hero Section */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-zinc-800/80 bg-zinc-950/40 p-6 shadow-2xl backdrop-blur-md md:p-10 lg:p-12">
        {/* Animated Background Elements */}
        <div className="absolute inset-y-0 right-0 w-full lg:w-1/2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_65%)]" />
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-orange-500/10 blur-[100px]" />
          <div className="absolute top-1/2 -right-48 h-96 w-96 rounded-full bg-amber-500/5 blur-[120px]" />
        </div>

        <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-orange-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Academic Center</span>
            </div>

            <div className="space-y-4">
              <h1 className="bg-linear-to-r from-white via-orange-200 to-zinc-500 bg-clip-text text-5xl font-black tracking-tighter text-transparent sm:text-6xl lg:text-7xl">
                Master Akademik
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">
                Pusat data konfigurasi pendidikan. Kelola struktur kurikulum,
                penempatan kelas, dan jadwal pengajaran secara akurat untuk
                mendukung operasional sekolah yang efisien.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2.5 rounded-2xl border border-orange-500/20 bg-orange-500/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-orange-300">
                <ShieldCheck className="h-4 w-4" />
                {canWriteAcademic ? "Akses Operator Penuh" : "Mode Lihat Saja"}
              </div>
              <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <Lock className="h-4 w-4" />
                {desktopRuntime ? "Desktop Integration" : "Cloud Active"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:w-[220px]">
            {[
              { label: "Modul", value: "Canonical System", icon: GraduationCap },
              { label: "Status", value: "Ready to Sync", icon: RefreshCw },
              { label: "Audit", value: "Log Active", icon: ClipboardList },
            ].map((item) => (
              <div
                key={item.label}
                className="group relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
              >
                <div className="absolute inset-x-0 bottom-0 h-[2px] w-0 bg-orange-500 transition-all duration-300 group-hover:w-full" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-200">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 🧭 Module Navigation */}
      {!canReadAcademic ? (
        <InlineState
          title="Akses akademik tidak tersedia"
          description="Role aktif tidak memiliki permission untuk membaca data akademik."
          variant="warning"
        />
      ) : (
        <section className="space-y-10">
          <div className="flex items-center gap-4 px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] border border-orange-500/20 bg-orange-500/10 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
              <GraduationCap className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">
                Pilih Konfigurasi
              </p>
              <h2 className="text-xl font-bold tracking-tight text-white capitalize">
                {tab.replace("-", " ")}
              </h2>
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
            className="space-y-8"
          >
            <div className="overflow-x-auto pb-4 pt-2 mt-2">
              <TabsList className="bg-transparent h-auto flex gap-2 border-none p-0">
                {[
                  { id: "academic-years", label: "Tahun Ajaran" },
                  { id: "semesters", label: "Semester" },
                  { id: "classes", label: "Kelas" },
                  { id: "subjects", label: "Mata Pelajaran" },
                  { id: "teaching-assignments", label: "Guru Mapel" },
                  { id: "schedules", label: "Jadwal" },
                  { id: "schedule-legacy-audit", label: "Audit" },
                ].map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="h-11 whitespace-nowrap rounded-xl border border-zinc-800 bg-zinc-950/40 px-6 text-zinc-400 transition-all hover:bg-zinc-900 data-[state=active]:border-orange-500/50 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
                  >
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent
              value={tab}
              className="mt-0 ring-offset-zinc-950 focus-visible:ring-0"
            >
              <div className="rounded-[2rem] border border-zinc-800/60 bg-zinc-950/20 p-6 backdrop-blur-xs">
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
              </div>
            </TabsContent>
          </Tabs>
        </section>
      )}
    </div>
  );
}
