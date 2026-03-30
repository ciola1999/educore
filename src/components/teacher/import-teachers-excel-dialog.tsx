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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isTauri } from "@/core/env";
import { getApiErrorMessage, readApiResponse } from "@/lib/api/client";
import { apiPost } from "@/lib/api/request";
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
    email?: string;
  }>;
};

type ImportTeachersExcelDialogProps = {
  onSuccess: () => void;
};

type DesktopTeacherImportPayload = {
  fileName: string;
  fileDataBase64: string;
  updateExisting: boolean;
  defaultRole: "teacher" | "staff" | "admin";
  defaultPassword: string;
  resetPasswordOnUpdate: boolean;
};

const templateColumns = [
  "Nama Lengkap",
  "Email",
  "Role",
  "Password",
  "NIP",
  "Jenis Kelamin",
  "Tempat Lahir",
  "Tanggal Lahir",
  "Alamat",
  "No Telepon",
  "Aktif",
];

const templateExampleRow = {
  "Nama Lengkap": "Ahmad Fauzi",
  Email: "ahmad.fauzi@school.local",
  Role: "teacher",
  Password: "guru12345",
  NIP: "198812122010011001",
  "Jenis Kelamin": "L",
  "Tempat Lahir": "Jakarta",
  "Tanggal Lahir": "1988-12-12",
  Alamat: "Jl. Pendidikan No. 5",
  "No Telepon": "081298765432",
  Aktif: "ya",
};

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(
        new Error("File Excel user tidak bisa dibaca di desktop runtime."),
      );
    };
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Format file user desktop tidak valid."));
        return;
      }

      const [, base64 = ""] = result.split(",", 2);
      if (!base64) {
        reject(new Error("Isi file user tidak ditemukan."));
        return;
      }

      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export function ImportTeachersExcelDialog({
  onSuccess,
}: ImportTeachersExcelDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [resetPasswordOnUpdate, setResetPasswordOnUpdate] = useState(false);
  const [defaultRole, setDefaultRole] = useState<"teacher" | "staff" | "admin">(
    "teacher",
  );
  const [defaultPassword, setDefaultPassword] = useState("");
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  const canSubmit = useMemo(
    () => Boolean(file) && defaultPassword.length >= 8 && !loading,
    [defaultPassword.length, file, loading],
  );

  async function handleDownloadTemplate() {
    try {
      await exportRowsToXlsx({
        fileName: "template-import-users.xlsx",
        sheetName: "Users",
        rows: [templateExampleRow],
      });
      toast.success("Template user berhasil dibuat.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat template user",
      );
    }
  }

  async function handleImport() {
    if (!file) {
      toast.error("Pilih file Excel terlebih dahulu.");
      return;
    }
    if (defaultPassword.length < 8) {
      toast.error("Password default minimal 8 karakter.");
      return;
    }

    setLoading(true);
    try {
      if (isTauri()) {
        const payload = await apiPost<ImportResult>("/api/teachers/import", {
          fileName: file.name,
          fileDataBase64: await readFileAsBase64(file),
          updateExisting,
          defaultRole,
          defaultPassword,
          resetPasswordOnUpdate,
        } satisfies DesktopTeacherImportPayload);

        setLastResult(payload);
        onSuccess();
        toast.success(
          `Import user selesai: ${payload.created} baru, ${payload.updated} diperbarui, ${payload.skipped} dilewati.`,
        );
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("updateExisting", String(updateExisting));
      formData.append("defaultRole", defaultRole);
      formData.append("defaultPassword", defaultPassword);
      formData.append("resetPasswordOnUpdate", String(resetPasswordOnUpdate));

      const response = await fetch("/api/teachers/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const payload = await readApiResponse<ImportResult>(response);

      if (!response.ok || !payload.success) {
        throw new Error(
          getApiErrorMessage(
            response,
            "Import Excel user gagal diproses",
            payload.success ? undefined : payload,
          ),
        );
      }

      setLastResult(payload.data);
      onSuccess();
      toast.success(
        `Import user selesai: ${payload.data.created} baru, ${payload.data.updated} diperbarui, ${payload.data.skipped} dilewati.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Import Excel user gagal diproses",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetState() {
    setFile(null);
    setUpdateExisting(true);
    setResetPasswordOnUpdate(false);
    setDefaultRole("teacher");
    setDefaultPassword("");
    setLastResult(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-sky-700/60 text-sky-300 hover:bg-sky-900/20"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Import Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import User dari Excel</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Upload data admin, guru, dan staf dalam sekali proses. Di desktop,
            file diproses lewat local runtime yang sama.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-xs text-zinc-400 space-y-2">
            <p className="font-medium text-zinc-200">
              Header kolom yang didukung:
            </p>
            <p>{templateColumns.join(", ")}</p>
            <p>
              Wajib minimal: Nama Lengkap dan Email. Role opsional (ikut default
              role).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teachers-import-file">File Excel</Label>
            <Input
              id="teachers-import-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="bg-zinc-950 border-zinc-800"
            />
            <p className="text-xs text-zinc-500">
              {file ? `File dipilih: ${file.name}` : "Belum ada file dipilih"}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Role</Label>
              <Select
                value={defaultRole}
                onValueChange={(value) =>
                  setDefaultRole(value as "teacher" | "staff" | "admin")
                }
              >
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teachers-import-default-password">
                Default Password
              </Label>
              <Input
                id="teachers-import-default-password"
                type="password"
                value={defaultPassword}
                onChange={(event) => setDefaultPassword(event.target.value)}
                placeholder="Minimal 8 karakter"
                className="bg-zinc-950 border-zinc-800"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(event) => setUpdateExisting(event.target.checked)}
            />
            Update akun yang email-nya sudah ada
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={resetPasswordOnUpdate}
              onChange={(event) =>
                setResetPasswordOnUpdate(event.target.checked)
              }
              disabled={!updateExisting}
            />
            Reset password juga saat update akun existing
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
                      {item.email ? ` (${item.email})` : ""}: {item.message}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
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
