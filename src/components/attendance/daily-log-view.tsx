"use client";

import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTodayAttendanceRecords } from "@/lib/services/attendance";

// Mengambil tipe data otomatis dari hasil balikan fungsi
type AttendanceRecord = Awaited<
  ReturnType<typeof getTodayAttendanceRecords>
>[number];

export function DailyLogView() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTodayAttendanceRecords();
      setRecords(data);
    } catch (error) {
      // ✅ Ganti console.error dengan toast sesuai standar CLAUDE.md
      toast.error("Gagal memuat log harian", {
        description: "Terjadi kesalahan saat mengambil data dari database.",
      });
    } finally {
      setLoading(false);
    }
  }, []); // Array kosong karena tidak bergantung pada state/props eksternal

  // ✅ Masukkan loadData ke dalam array dependency
  useEffect(() => {
    loadData();

    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Riwayat Absensi Hari Ini
          </h2>
          <p className="text-sm text-zinc-400">
            {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })}
          </p>
        </div>
        <Button
          onClick={loadData}
          disabled={loading}
          variant="outline"
          size="sm"
          className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300 gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-900/50 border-b border-zinc-800">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-zinc-400">NIS</TableHead>
              <TableHead className="text-zinc-400">Nama Lengkap</TableHead>
              <TableHead className="text-zinc-400">Masuk</TableHead>
              <TableHead className="text-zinc-400">Pulang</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="text-right text-zinc-400">
                Sync Cloud
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-500 mx-auto" />
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-zinc-500"
                >
                  Belum ada data absensi hari ini.
                </TableCell>
              </TableRow>
            ) : (
              records.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-zinc-800 hover:bg-zinc-900/50"
                >
                  {/* DATA NIS */}
                  <TableCell className="font-mono text-xs font-bold text-zinc-300">
                    {row.snapshotStudentNis}
                  </TableCell>
                  <TableCell className="font-medium text-zinc-200">
                    {row.snapshotStudentName}
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {row.checkInTime
                      ? format(new Date(row.checkInTime), "HH:mm")
                      : "--:--"}
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {row.checkOutTime
                      ? format(new Date(row.checkOutTime), "HH:mm")
                      : "--:--"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.status === "LATE"
                          ? "border-red-500/30 text-red-400 bg-red-500/10"
                          : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      }
                    >
                      {row.status === "LATE" ? "TERLAMBAT" : "ON-TIME"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {row.syncStatus === "pending" ? (
                      <div className="flex items-center justify-end gap-1.5 text-amber-500/80">
                        <CloudOff className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase">
                          Pending
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5 text-blue-400">
                        <Cloud className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase">
                          Synced
                        </span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
