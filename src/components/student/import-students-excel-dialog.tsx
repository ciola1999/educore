"use client";

import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage, readApiResponse } from "@/lib/api/client";
import { exportRowsToXlsx } from "@/lib/export/xlsx";

type ImportResult = {
  totalRows: number;
  validRows: number;
  created: number;
  updated: number;
  skipped: number;
  errorCount: number;
  errors: Array<{
    row: number;
    message: string;
    nis?: string;
  }>;
};

type ImportStudentsExcelDialogProps = {
  onSuccess: () => void;
};

const importStudentsSkyOutlineButtonClass =
  "rounded-2xl border-sky-700/70 bg-sky-950/40 text-sky-100 hover:border-sky-500 hover:bg-sky-900/60 hover:text-white";
const importStudentsNeutralOutlineButtonClass =
  "rounded-2xl border-zinc-700 bg-zinc-950/85 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white";

const templateColumns = [
  "NIS",
  "NISN",
  "Nama Lengkap",
  "Jenis Kelamin (L/P)",
  "Kelas",
  "Nama Wali",
  "No HP Wali",
  "Tempat Lahir",
  "Tanggal Lahir",
  "Alamat",
];

const templateExampleRow = {
  NIS: "2026001",
  NISN: "1234567890",
  "Nama Lengkap": "Budi Santoso",
  "Jenis Kelamin (L/P)": "L",
  Kelas: "X-A",
  "Nama Wali": "Slamet",
  "No HP Wali": "081234567890",
  "Tempat Lahir": "Bandung",
  "Tanggal Lahir": "2010-05-12",
  Alamat: "Jl. Merdeka No. 10",
};

export function ImportStudentsExcelDialog({
  onSuccess,
}: ImportStudentsExcelDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(file) && !loading, [file, loading]);

  async function handleDownloadTemplate() {
    try {
      await exportRowsToXlsx({
        fileName: "template-import-students.xlsx",
        sheetName: "Students",
        rows: [templateExampleRow],
      });
      toast.success("Template students berhasil dibuat.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal membuat template students",
      );
    }
  }

  async function handleImport() {
    if (!file) {
      toast.error("Pilih file Excel terlebih dahulu.");
      return;
    }

    setLoading(true);
    setLastError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("updateExisting", String(updateExisting));

      const response = await fetch("/api/students/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const payload = await readApiResponse<ImportResult>(response);

      if (!response.ok || !payload.success) {
        const importErrors = response.headers.get("x-import-errors");
        const headerRow = response.headers.get("x-import-header-row");
        let detail = "";
        if (importErrors) {
          try {
            const parsedErrors = JSON.parse(importErrors) as Array<{
              row: number;
              message: string;
            }>;
            if (parsedErrors.length > 0) {
              detail = ` Contoh error: baris ${parsedErrors[0]?.row} - ${parsedErrors[0]?.message}`;
            }
          } catch {
            detail = "";
          }
        }
        throw new Error(
          `${getApiErrorMessage(
            response,
            "Import Excel gagal diproses",
            payload.success ? undefined : payload,
          )}${headerRow ? ` (header terdeteksi di baris ${headerRow})` : ""}${detail}`,
        );
      }

      setLastResult(payload.data);
      onSuccess();
      toast.success(
        `Import selesai: ${payload.data.created} baru, ${payload.data.updated} diperbarui, ${payload.data.skipped} dilewati.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Import Excel gagal diproses";
      setLastError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function resetState() {
    setFile(null);
    setUpdateExisting(true);
    setLastResult(null);
    setLastError(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          resetState();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={importStudentsSkyOutlineButtonClass}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Import Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Data Siswa dari Excel</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Upload file `.xlsx`, `.xls`, atau `.csv` untuk insert/update data
            siswa massal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-xs text-zinc-400 space-y-2">
            <p className="font-medium text-zinc-200">
              Header kolom yang didukung:
            </p>
            <p>{templateColumns.join(", ")}</p>
            <p>
              Catatan: NIS, Nama Lengkap, Jenis Kelamin, dan Kelas wajib diisi.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="students-import-file">File Excel</Label>
            <Input
              id="students-import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
              }}
              className="bg-zinc-950 border-zinc-800"
            />
            <p className="text-xs text-zinc-500">
              {file ? `File dipilih: ${file.name}` : "Belum ada file dipilih"}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(event) => setUpdateExisting(event.target.checked)}
            />
            Update data siswa yang NIS-nya sudah ada
          </label>

          {lastResult ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-2 text-sm">
              <p className="font-medium text-zinc-200">Ringkasan Import</p>
              <p className="text-zinc-400">
                Total baris: {lastResult.totalRows} | Valid:{" "}
                {lastResult.validRows}
              </p>
              <p className="text-zinc-400">
                Dibuat: {lastResult.created} | Diperbarui: {lastResult.updated}{" "}
                | Dilewati: {lastResult.skipped}
              </p>
              <p className="text-zinc-400">
                Error validasi: {lastResult.errorCount}
              </p>
              {lastResult.errors.length > 0 ? (
                <div className="max-h-40 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-400">
                  {lastResult.errors.map((item) => (
                    <p key={`${item.row}-${item.message}`}>
                      Baris {item.row}
                      {item.nis ? ` (NIS ${item.nis})` : ""}: {item.message}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {lastError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              {lastError}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className={importStudentsNeutralOutlineButtonClass}
            onClick={() => {
              void handleDownloadTemplate();
            }}
          >
            Download Template
          </Button>
          <Button type="button" onClick={handleImport} disabled={!canSubmit}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Proses Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
