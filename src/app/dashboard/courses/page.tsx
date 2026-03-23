"use client";

import { ShieldCheck, ShieldMinus } from "lucide-react";
import { useQueryState } from "nuqs";
import { ClassList } from "@/components/academic/class-list";
import { SubjectList } from "@/components/academic/subject-list";
import { InlineState } from "@/components/common/inline-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { checkPermission } from "@/lib/auth/rbac";

export default function CoursesPage() {
  const { user } = useAuth();
  const canReadAcademic = checkPermission(user, "academic:read");
  const canWriteAcademic = checkPermission(user, "academic:write");
  const [tab, setTab] = useQueryState("tab", {
    defaultValue: "classes",
    parse: (value) => (value === "subjects" ? "subjects" : "classes"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-orange-400 to-amber-200 bg-clip-text text-transparent">
          Data Akademik
        </h2>
        <p className="text-zinc-400 mt-1">
          {canWriteAcademic
            ? "Kelola data kelas dan mata pelajaran."
            : "Lihat data kelas dan mata pelajaran sesuai permission role aktif."}
        </p>
      </div>

      {!canReadAcademic ? (
        <InlineState
          title="Akses akademik tidak tersedia"
          description="Role aktif tidak memiliki permission untuk membaca data akademik."
          variant="warning"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-amber-300" />
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  Akses Baca Aktif
                </p>
                <p className="text-sm text-amber-100/80">
                  Data kelas dan mata pelajaran tersedia untuk role{" "}
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
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => {
          void setTab(value === "subjects" ? "subjects" : "classes");
        }}
        className="space-y-4"
      >
        <TabsList className="bg-zinc-900 border border-zinc-800 text-zinc-400">
          <TabsTrigger
            value="classes"
            className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
          >
            Kelas
          </TabsTrigger>
          <TabsTrigger
            value="subjects"
            className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
          >
            Mata Pelajaran
          </TabsTrigger>
        </TabsList>
        <TabsContent value="classes">
          <ClassList readOnly={!canWriteAcademic} />
        </TabsContent>
        <TabsContent value="subjects">
          <SubjectList readOnly={!canWriteAcademic} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
