"use client";

import { motion } from "framer-motion";
import { Download, Loader2, Sparkles, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import * as xlsx from "xlsx";

import { AddStudentDialog } from "@/components/student/add-student-dialog";
import { StudentList } from "@/components/student/student-list";
import { StudentStats } from "@/components/student/student-stats";
import { Button } from "@/components/ui/button";
import { isTauri } from "@/core/env";
import {
  getAllStudentsForExport,
  getStudentStats,
  upsertStudent,
} from "@/core/services/student-service";
import { bulkStudentSchema } from "@/core/validation/schemas";

/**
 * Students Management Page (2026 Elite Version)
 * Implements robust Import/Export and Real-time Stats
 */
export default function StudentsPage() {
  const [stats, setStats] = useState({
    total: 0,
    male: 0,
    female: 0,
    activeGrades: 0,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Referensi untuk elemen input file (tersembunyi)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getStudentStats();
      setStats(data);
    } catch {
      toast.error("Gagal memuat statistik siswa");
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const onStudentChanged = () => {
      void fetchStats();
    };

    window.addEventListener("students:changed", onStudentChanged);
    return () =>
      window.removeEventListener("students:changed", onStudentChanged);
  }, [fetchStats]);

  // ✅ Fungsi untuk EXPORT ke Excel
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // 1. Ambil data dari database
      const studentsData = await getAllStudentsForExport();

      if (studentsData.length === 0) {
        toast.warning("Tidak ada data siswa untuk diekspor");
        return;
      }

      // 2. Rapikan format datanya
      const formattedData = studentsData.map((s) => ({
        NIS: s.nis,
        NISN: s.nisn || "",
        "Nama Lengkap": s.fullName,
        Gender: s.gender === "L" ? "Laki-laki" : "Perempuan",
        Kelas: s.grade,
        "Tempat Lahir": s.tempatLahir || "",
        Alamat: s.alamat || "",
        "Nama Orang Tua": s.parentName || "",
        "No HP Orang Tua": s.parentPhone || "",
      }));

      // 3. Buat file Excel
      const worksheet = xlsx.utils.json_to_sheet(formattedData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Data Siswa");

      // 4. Force Download menggunakan Blob (Aman untuk arsitektur Tauri)
      const excelBuffer = xlsx.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      // --- TAURI NATIVE SAVING ---
      if (isTauri()) {
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const { writeFile } = await import("@tauri-apps/plugin-fs");

          const filePath = await save({
            filters: [{ name: "Excel", extensions: ["xlsx"] }],
            defaultPath: `EduCore_Students_${new Date().toISOString().split("T")[0]}.xlsx`,
          });

          if (filePath) {
            await writeFile(
              filePath,
              new Uint8Array(excelBuffer as ArrayBuffer),
            );
            toast.success("Ekspor data berhasil disimpan!");
            return;
          }
          // If user cancels, just return
          return;
        } catch (_tauriError) {
          // Fallback to browser download if native fails
        }
      }

      // --- BROWSER FALLBACK ---
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `EduCore_Students_${new Date().toISOString().split("T")[0]}.xlsx`,
      );

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success("Ekspor data berhasil!");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      toast.error("Gagal mengekspor data", {
        description: errorMessage,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ✅ Fungsi untuk IMPORT dari Excel (React 19 Pattern)
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file terlalu besar (maksimal 5MB)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    type SheetRow = Record<string, string | number | null | undefined>;

    const reader = new FileReader();
    reader.onload = async (event) => {
      startTransition(async () => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = xlsx.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = xlsx.utils.sheet_to_json<SheetRow>(worksheet, {
            raw: false,
          });

          if (jsonData.length === 0) {
            toast.error("File kosong atau tidak memiliki data valid");
            return;
          }

          // Validasi Skema & Normalisasi Data (Robust 2026 Pattern)
          const normalizedRows = jsonData.map((row) => {
            // Normalisasi Gender (Laki-laki/Perempuan/L/P - Case Insensitive)
            const rawGender = String(row.Gender || "").trim().toLowerCase();
            let gender: "L" | "P" = "L"; // Default L
            if (
              rawGender === "p" ||
              rawGender === "perempuan" ||
              rawGender === "female" ||
              rawGender === "wanita"
            ) {
              gender = "P";
            } else if (
              rawGender === "l" ||
              rawGender === "laki-laki" ||
              rawGender === "male" ||
              rawGender === "pria"
            ) {
              gender = "L";
            }

            return {
              nis: String(row.NIS || "").trim(),
              fullName: String(row["Nama Lengkap"] || "").trim(),
              gender,
              grade: String(row.Kelas || "").trim(),
              parentName: String(row["Nama Orang Tua"] || "").trim() || null,
              parentPhone: String(row["No HP Orang Tua"] || "").trim() || null,
              nisn: String(row.NISN || "").trim() || null,
              tempatLahir: String(row["Tempat Lahir"] || "").trim() || null,
              alamat: String(row.Alamat || "").trim() || null,
            };
          });

          const parseResult = bulkStudentSchema.safeParse(normalizedRows);

          if (!parseResult.success) {
            toast.error("Format data Excel tidak valid", {
              description: parseResult.error.issues[0].message,
            });
            return;
          }

          // Proses Batch Upsert (Sequential for ACID-like behavior on local SQLite)
          let successCount = 0;
          for (const studentInput of parseResult.data) {
            try {
              await upsertStudent(studentInput);
              successCount++;
            } catch (err) {
              console.error(`Gagal mengimpor siswa NIS ${studentInput.nis}:`, err);
            }
          }

          toast.success(`Berhasil mengimpor ${successCount} siswa!`);
          await fetchStats();
          window.dispatchEvent(new Event("students:changed"));
        } catch {
          toast.error("Gagal mengimpor data", {
            description: "Pastikan format file sesuai.",
          });
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      });
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 pb-10"
    >
      {/* 🏛️ PREMIUM HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900/50 p-8 border border-zinc-800 shadow-2xl backdrop-blur-sm">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-indigo-600/10 blur-[100px]" />

        <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 mb-2"
            >
              <div className="h-2 w-8 bg-blue-500 rounded-full" />
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                Core System V4
              </span>
            </motion.div>
            <h2 className="text-4xl font-black tracking-tight bg-gradient-to-br from-white via-white to-zinc-500 bg-clip-text text-transparent sm:text-5xl">
              Students Management
            </h2>
            <p className="text-zinc-400 mt-3 text-lg max-w-2xl leading-relaxed">
              Seamlessly manage academic records, student profiles, and parent
              communications with local-first performance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".xlsx, .xls"
              ref={fileInputRef}
              onChange={handleImport}
              className="hidden"
            />

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
              className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Import Excel
            </Button>

            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
              className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export Excel
            </Button>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <AddStudentDialog />
            </motion.div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Live Insights
          </h3>
        </div>
        <StudentStats
          total={stats.total}
          male={stats.male}
          female={stats.female}
          activeGrades={stats.activeGrades}
        />
      </section>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="relative"
      >
        <StudentList />
      </motion.div>
    </motion.div>
  );
}
