import { isTauri } from "@/core/env";

type ExportRowsToXlsxInput = {
  fileName: string;
  sheetName: string;
  rows: Record<string, unknown>[];
};

export async function exportRowsToXlsx({
  fileName,
  sheetName,
  rows,
}: ExportRowsToXlsxInput) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const filePath = await save({
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
      defaultPath: fileName,
    });

    if (filePath) {
      await writeFile(filePath, new Uint8Array(excelBuffer as ArrayBuffer));
    }
    return;
  }

  XLSX.writeFile(workbook, fileName);
}
