"use client";

import { Loader2, RefreshCcw, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AddTeachingAssignmentDialog } from "@/components/academic/add-teaching-assignment-dialog";
import { InlineState } from "@/components/common/inline-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet, apiPost } from "@/lib/api/request";
import type {
  BulkArchiveCanonicalLegacyScheduleResponse,
  BulkLegacyScheduleRepairResponse,
  LegacyScheduleAuditItem,
  LegacyScheduleAuditReport,
  LegacyScheduleAuditStatus,
  LegacyScheduleRepairResponse,
} from "./schemas";

const STATUS_OPTIONS: Array<{
  value: "all" | LegacyScheduleAuditStatus;
  label: string;
}> = [
  { value: "all", label: "Semua status" },
  { value: "ready_to_backfill", label: "Siap dipromosikan" },
  { value: "ambiguous_assignment", label: "Assignment ambigu" },
  { value: "missing_assignment", label: "Assignment belum ada" },
  { value: "already_canonical", label: "Sudah canonical" },
];

const DAY_LABELS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

function getStatusBadgeVariant(status: LegacyScheduleAuditStatus) {
  if (status === "missing_assignment") return "destructive" as const;
  if (status === "ambiguous_assignment") return "secondary" as const;
  return "outline" as const;
}

function getStatusLabel(status: LegacyScheduleAuditStatus) {
  switch (status) {
    case "already_canonical":
      return "Sudah canonical";
    case "ready_to_backfill":
      return "Siap dipromosikan";
    case "ambiguous_assignment":
      return "Assignment ambigu";
    case "missing_assignment":
      return "Assignment belum ada";
  }
}

function formatAssignmentLabel(
  item: LegacyScheduleAuditItem["matchingAssignments"][number],
) {
  return [
    item.guruName || "Guru tidak diketahui",
    item.mataPelajaranName || "Mapel tidak diketahui",
    item.kelasName || "Kelas tidak diketahui",
    item.semesterName
      ? `${item.semesterName}${item.tahunAjaranNama ? ` • ${item.tahunAjaranNama}` : ""}`
      : item.tahunAjaranNama || "Semester tidak diketahui",
  ].join(" | ");
}

export function ScheduleLegacyAuditList({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const [report, setReport] = useState<LegacyScheduleAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | LegacyScheduleAuditStatus
  >("all");
  const [limit, setLimit] = useState("100");
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [bulkRepairing, setBulkRepairing] = useState(false);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [selectedGuruMapelIds, setSelectedGuruMapelIds] = useState<
    Record<string, string>
  >({});

  const effectiveLimit = useMemo(() => {
    const parsed = Number.parseInt(limit, 10);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 100;
  }, [limit]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const query = new URLSearchParams();
      if (statusFilter !== "all") {
        query.set("status", statusFilter);
      }
      query.set("limit", String(effectiveLimit));

      const nextReport = await apiGet<LegacyScheduleAuditReport>(
        `/api/teaching-assignments/schedule-legacy-audit?${query.toString()}`,
      );
      setReport(nextReport);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal memuat audit schedule legacy";
      setReport(null);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [effectiveLimit, statusFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleRepair(item: LegacyScheduleAuditItem) {
    setRepairingId(item.legacyScheduleId);
    try {
      const payload =
        item.status === "ambiguous_assignment"
          ? {
              legacyScheduleId: item.legacyScheduleId,
              guruMapelId: selectedGuruMapelIds[item.legacyScheduleId],
            }
          : { legacyScheduleId: item.legacyScheduleId };

      const result = await apiPost<LegacyScheduleRepairResponse>(
        "/api/teaching-assignments/schedule-legacy-repair",
        payload,
      );
      toast.success(
        result.action === "created"
          ? "Schedule legacy berhasil dipromosikan ke jadwal canonical"
          : "Schedule legacy berhasil dipautkan ke jadwal canonical yang sudah ada",
      );
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memperbaiki schedule legacy",
      );
    } finally {
      setRepairingId(null);
    }
  }

  async function handleBulkRepair() {
    setBulkRepairing(true);
    try {
      const result = await apiPost<BulkLegacyScheduleRepairResponse>(
        "/api/teaching-assignments/schedule-legacy-repair",
        {
          mode: "ready_to_backfill",
          limit: effectiveLimit,
        },
      );
      toast.success(
        `Bulk repair selesai. Diproses ${result.processed}, dibuat ${result.created}, reuse ${result.reused}, skip ${result.skipped}.`,
      );
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menjalankan bulk repair schedule legacy",
      );
    } finally {
      setBulkRepairing(false);
    }
  }

  async function handleBulkArchiveCanonical() {
    setBulkArchiving(true);
    try {
      const result = await apiPost<BulkArchiveCanonicalLegacyScheduleResponse>(
        "/api/teaching-assignments/schedule-legacy-repair",
        {
          mode: "already_canonical",
          limit: effectiveLimit,
        },
      );
      toast.success(
        `Cleanup canonical selesai. Diarsipkan ${result.archived}, skip ${result.skipped}.`,
      );
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengarsipkan schedule legacy yang sudah canonical",
      );
    } finally {
      setBulkArchiving(false);
    }
  }

  if (loading && !report) {
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-zinc-500" />;
  }

  if (errorMessage && !report) {
    return (
      <InlineState
        title="Audit jadwal legacy belum tersedia"
        description={errorMessage}
        actionLabel="Muat ulang"
        onAction={() => {
          void fetchData();
        }}
        variant="error"
      />
    );
  }

  if (report && !report.legacyTableAvailable) {
    return (
      <div className="space-y-4">
        {readOnly ? (
          <InlineState
            title="Mode read only"
            description="Audit legacy tetap terlihat, tetapi aksi repair disembunyikan."
            variant="info"
            className="text-sm"
          />
        ) : null}

        <InlineState
          title="Tabel schedule legacy sudah retired"
          description="Cleanup legacy schedule sudah selesai di level storage. Audit ini dipertahankan hanya sebagai fallback compatibility."
          actionLabel="Muat ulang"
          onAction={() => {
            void fetchData();
          }}
          variant="info"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {readOnly ? (
        <InlineState
          title="Mode read only"
          description="Audit legacy tetap terlihat, tetapi aksi repair disembunyikan."
          variant="info"
          className="text-sm"
        />
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 md:grid-cols-[1.2fr_180px_auto]">
        <div className="space-y-2">
          <p className="text-sm font-medium text-white">Filter status</p>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as "all" | LegacyScheduleAuditStatus)
            }
          >
            <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-white">Limit baris</p>
          <Input
            inputMode="numeric"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            className="border-zinc-800 bg-zinc-950 text-zinc-100"
          />
        </div>

        <div className="flex items-end">
          <div className="flex w-full gap-2 md:w-auto">
            {!readOnly ? (
              <>
                <Button
                  type="button"
                  disabled={bulkRepairing}
                  onClick={() => {
                    void handleBulkRepair();
                  }}
                  className="flex-1 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 md:flex-none"
                >
                  {bulkRepairing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wrench className="mr-2 h-4 w-4" />
                  )}
                  Bulk Ready
                </Button>
                <Button
                  type="button"
                  disabled={bulkArchiving}
                  onClick={() => {
                    void handleBulkArchiveCanonical();
                  }}
                  className="flex-1 bg-amber-500 text-zinc-950 hover:bg-amber-400 md:flex-none"
                >
                  {bulkArchiving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="mr-2 h-4 w-4" />
                  )}
                  Cleanup Canonical
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              onClick={() => {
                void fetchData();
              }}
              className="flex-1 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 md:flex-none"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Muat Audit
            </Button>
          </div>
        </div>
      </div>

      {report ? (
        <div className="grid gap-3 md:grid-cols-4">
          {(
            [
              ["ready_to_backfill", "Siap dipromosikan"],
              ["ambiguous_assignment", "Assignment ambigu"],
              ["missing_assignment", "Belum ada assignment"],
              ["already_canonical", "Sudah canonical"],
            ] as const
          ).map(([status, label]) => (
            <div
              key={status}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
            >
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {report.summary[status]}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {report && report.items.length === 0 ? (
        <InlineState
          title="Tidak ada schedule legacy untuk filter ini"
          description="Semua baris untuk filter aktif sudah canonical, atau belum ada data legacy yang perlu ditinjau."
          variant="info"
        />
      ) : null}

      {report && report.items.length > 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="hidden xl:block">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-zinc-900">
                  <TableHead className="text-zinc-400">Legacy</TableHead>
                  <TableHead className="text-zinc-400">Relasi</TableHead>
                  <TableHead className="text-zinc-400">Waktu</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                  <TableHead className="text-zinc-400">Repair</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.items.map((item) => {
                  const needsSelection = item.status === "ambiguous_assignment";
                  const canRepair =
                    !readOnly &&
                    (item.status === "ready_to_backfill" ||
                      (needsSelection &&
                        Boolean(selectedGuruMapelIds[item.legacyScheduleId])));

                  return (
                    <TableRow
                      key={item.legacyScheduleId}
                      className="border-zinc-800 text-zinc-300 hover:bg-zinc-800/40"
                    >
                      <TableCell className="align-top">
                        <p className="font-medium text-white">
                          {item.legacyScheduleId}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Ruang: {item.room || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        <p>{item.className || item.classId}</p>
                        <p>{item.subjectName || item.subjectId}</p>
                        <p>{item.teacherName || item.teacherId}</p>
                      </TableCell>
                      <TableCell className="align-top">
                        {DAY_LABELS[item.dayOfWeek] || `Hari ${item.dayOfWeek}`}{" "}
                        | {item.startTime} - {item.endTime}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant={getStatusBadgeVariant(item.status)}
                          className="border-zinc-700 text-white"
                        >
                          {getStatusLabel(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        {item.status === "ambiguous_assignment" ? (
                          <div className="space-y-2">
                            <Select
                              value={
                                selectedGuruMapelIds[item.legacyScheduleId] ||
                                ""
                              }
                              onValueChange={(value) =>
                                setSelectedGuruMapelIds((current) => ({
                                  ...current,
                                  [item.legacyScheduleId]: value,
                                }))
                              }
                            >
                              <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-100">
                                <SelectValue placeholder="Pilih guru-mapel" />
                              </SelectTrigger>
                              <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                                {item.matchingAssignments.map((assignment) => (
                                  <SelectItem
                                    key={assignment.id}
                                    value={assignment.id}
                                  >
                                    {formatAssignmentLabel(assignment)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!readOnly ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={
                                  !canRepair ||
                                  repairingId === item.legacyScheduleId
                                }
                                onClick={() => {
                                  void handleRepair(item);
                                }}
                                className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
                              >
                                {repairingId === item.legacyScheduleId ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Wrench className="mr-2 h-4 w-4" />
                                )}
                                Repair
                              </Button>
                            ) : null}
                          </div>
                        ) : item.status === "ready_to_backfill" && !readOnly ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={repairingId === item.legacyScheduleId}
                            onClick={() => {
                              void handleRepair(item);
                            }}
                            className="bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                          >
                            {repairingId === item.legacyScheduleId ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Wrench className="mr-2 h-4 w-4" />
                            )}
                            Promote
                          </Button>
                        ) : (
                          <span className="text-sm text-zinc-500">
                            {item.status === "already_canonical"
                              ? "Tidak perlu aksi"
                              : "Pilih assignment"}
                          </span>
                        )}
                        {item.status === "missing_assignment" && !readOnly ? (
                          <div className="mt-2">
                            <AddTeachingAssignmentDialog
                              onSuccess={() => {
                                void fetchData();
                              }}
                              initialValues={{
                                guruId: item.teacherId,
                                mataPelajaranId: item.subjectId,
                                kelasId: item.classId,
                              }}
                              trigger={
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-sky-500 text-zinc-950 hover:bg-sky-400"
                                >
                                  Buat Assignment
                                </Button>
                              }
                            />
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 p-3 xl:hidden">
            {report.items.map((item) => {
              const needsSelection = item.status === "ambiguous_assignment";
              const canRepair =
                !readOnly &&
                (item.status === "ready_to_backfill" ||
                  (needsSelection &&
                    Boolean(selectedGuruMapelIds[item.legacyScheduleId])));

              return (
                <article
                  key={item.legacyScheduleId}
                  className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {item.className || item.classId}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {item.subjectName || item.subjectId} |{" "}
                        {item.teacherName || item.teacherId}
                      </p>
                    </div>
                    <Badge
                      variant={getStatusBadgeVariant(item.status)}
                      className="border-zinc-700 text-white"
                    >
                      {getStatusLabel(item.status)}
                    </Badge>
                  </div>

                  <p className="text-sm text-zinc-300">
                    {DAY_LABELS[item.dayOfWeek] || `Hari ${item.dayOfWeek}`} |{" "}
                    {item.startTime} - {item.endTime} | Ruang:{" "}
                    {item.room || "-"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Legacy ID: {item.legacyScheduleId}
                  </p>

                  {item.status === "ambiguous_assignment" ? (
                    <Select
                      value={selectedGuruMapelIds[item.legacyScheduleId] || ""}
                      onValueChange={(value) =>
                        setSelectedGuruMapelIds((current) => ({
                          ...current,
                          [item.legacyScheduleId]: value,
                        }))
                      }
                    >
                      <SelectTrigger className="border-zinc-800 bg-zinc-900 text-zinc-100">
                        <SelectValue placeholder="Pilih guru-mapel" />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                        {item.matchingAssignments.map((assignment) => (
                          <SelectItem key={assignment.id} value={assignment.id}>
                            {formatAssignmentLabel(assignment)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  {!readOnly ? (
                    item.status === "missing_assignment" ? (
                      <AddTeachingAssignmentDialog
                        onSuccess={() => {
                          void fetchData();
                        }}
                        initialValues={{
                          guruId: item.teacherId,
                          mataPelajaranId: item.subjectId,
                          kelasId: item.classId,
                        }}
                        trigger={
                          <Button
                            type="button"
                            className="w-full bg-sky-500 text-zinc-950 hover:bg-sky-400"
                          >
                            Buat Assignment
                          </Button>
                        }
                      />
                    ) : (
                      <Button
                        type="button"
                        disabled={
                          !canRepair || repairingId === item.legacyScheduleId
                        }
                        onClick={() => {
                          void handleRepair(item);
                        }}
                        className="w-full bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500"
                      >
                        {repairingId === item.legacyScheduleId ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Wrench className="mr-2 h-4 w-4" />
                        )}
                        {item.status === "ready_to_backfill"
                          ? "Promote ke Canonical"
                          : "Repair Schedule Legacy"}
                      </Button>
                    )
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
