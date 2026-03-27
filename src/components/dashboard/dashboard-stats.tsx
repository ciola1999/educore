"use client";

import {
  AlertTriangle,
  ClipboardCheck,
  GraduationCap,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api/request";
import { ensureAppWarmup } from "@/lib/runtime/app-bootstrap";
import type { DashboardStats } from "@/lib/services/dashboard";

const emptyStats: DashboardStats = {
  totalStudents: 0,
  totalTeachers: 0,
  attendanceToday: {
    present: 0,
    sick: 0,
    permission: 0,
    alpha: 0,
    late: 0,
    totalRecorded: 0,
  },
};

export function DashboardStatsCards() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void ensureAppWarmup()
      .then(() =>
        apiGet<DashboardStats>("/api/dashboard/stats", {
          timeoutMs: 20_000,
        }),
      )
      .then((response) => {
        if (active) {
          setStats(response);
        }
      })
      .catch(() => {
        if (active) {
          setStats(emptyStats);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const presenceRate =
    stats.attendanceToday.totalRecorded > 0
      ? Math.round(
          ((stats.attendanceToday.present + stats.attendanceToday.late) /
            stats.attendanceToday.totalRecorded) *
            100,
        )
      : 0;

  const cards = [
    {
      title: "Total Siswa",
      value: stats.totalStudents,
      description: "Roster siswa aktif yang tersinkron",
      detail: "Projection siswa yang siap dipakai lintas modul.",
      icon: Users,
      iconClass: "text-sky-300",
      accentClass: "from-sky-500/12 to-cyan-500/8",
      badgeClass: "border-sky-500/20 bg-sky-500/10 text-sky-200",
    },
    {
      title: "Total Guru & Staf",
      value: stats.totalTeachers,
      description: "Akun operator yang masih aktif",
      detail: "Hanya akun aktif yang ikut dihitung di dashboard.",
      icon: GraduationCap,
      iconClass: "text-violet-300",
      accentClass: "from-violet-500/12 to-fuchsia-500/8",
      badgeClass: "border-violet-500/20 bg-violet-500/10 text-violet-200",
    },
    {
      title: "Attendance Tercatat",
      value: stats.attendanceToday.totalRecorded,
      description: `${stats.attendanceToday.present + stats.attendanceToday.late} hadir, ${stats.attendanceToday.permission + stats.attendanceToday.sick + stats.attendanceToday.alpha} tidak hadir`,
      detail: "Menggabungkan attendance manual dan QR hari ini.",
      icon: ClipboardCheck,
      iconClass: "text-emerald-500",
      accentClass: "from-emerald-500/12 to-teal-500/8",
      badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    },
    {
      title: "Risiko Hari Ini",
      value: stats.attendanceToday.alpha + stats.attendanceToday.late,
      description: `${stats.attendanceToday.alpha} alpha, ${stats.attendanceToday.late} terlambat, rate ${presenceRate}%`,
      detail: "Prioritas follow-up untuk keterlambatan dan alpha.",
      icon: AlertTriangle,
      iconClass:
        stats.attendanceToday.alpha + stats.attendanceToday.late > 0
          ? "text-amber-400"
          : "text-emerald-500",
      accentClass:
        stats.attendanceToday.alpha + stats.attendanceToday.late > 0
          ? "from-amber-500/12 to-red-500/8"
          : "from-emerald-500/12 to-teal-500/8",
      badgeClass:
        stats.attendanceToday.alpha + stats.attendanceToday.late > 0
          ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className="group overflow-hidden border-zinc-800 bg-zinc-900 text-white shadow-[0_24px_60px_-48px_rgba(15,23,42,0.85)] motion-safe:transition motion-safe:duration-300 motion-safe:hover:-translate-y-1 hover:border-zinc-700 hover:shadow-[0_28px_70px_-46px_rgba(56,189,248,0.3)]"
        >
          <div
            className={`absolute inset-x-0 top-0 h-px bg-linear-to-r ${card.accentClass}`}
          />
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2.5 md:pb-3">
            <div className="space-y-2">
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${card.badgeClass}`}
              >
                Dashboard
              </span>
              <CardTitle className="text-sm font-medium text-zinc-400">
                {card.title}
              </CardTitle>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/80 motion-safe:transition motion-safe:duration-300 group-hover:border-zinc-700 md:h-10 md:w-10">
              <card.icon className={`h-4 w-4 ${card.iconClass}`} />
            </span>
          </CardHeader>
          <CardContent className="space-y-2.5 md:space-y-3">
            <div className="text-[1.85rem] font-black tracking-tight md:text-3xl">
              {loading ? (
                <div className="space-y-2">
                  <span className="inline-block h-8 w-20 animate-pulse rounded bg-zinc-800" />
                  <span className="block h-2 w-24 animate-pulse rounded bg-zinc-800/80" />
                </div>
              ) : (
                card.value
              )}
            </div>
            <div className="space-y-1.5">
              {loading ? (
                <div className="space-y-2 pt-1">
                  <span className="block h-3 w-4/5 animate-pulse rounded bg-zinc-800" />
                  <span className="block h-3 w-3/5 animate-pulse rounded bg-zinc-800/80" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-zinc-300">{card.description}</p>
                  <p className="text-xs leading-5 text-zinc-500">
                    {card.detail}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
