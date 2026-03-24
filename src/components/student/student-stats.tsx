"use client";

import { motion } from "framer-motion";
import { GraduationCap, UserCheck, UserMinus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StudentStatsProps {
  total: number;
  male: number;
  female: number;
  activeGrades: number;
}

export function StudentStats({
  total,
  male,
  female,
  activeGrades,
}: StudentStatsProps) {
  const stats = [
    {
      label: "Total Siswa",
      description: "Semua siswa aktif di roster",
      value: total,
      icon: Users,
      color: "text-sky-300",
      bg: "bg-sky-400/10",
      border: "border-sky-400/20",
    },
    {
      label: "Laki-laki",
      description: "Siswa gender L",
      value: male,
      icon: UserCheck,
      color: "text-cyan-300",
      bg: "bg-cyan-400/10",
      border: "border-cyan-400/20",
    },
    {
      label: "Perempuan",
      description: "Siswa gender P",
      value: female,
      icon: UserMinus,
      color: "text-rose-300",
      bg: "bg-rose-400/10",
      border: "border-rose-400/20",
    },
    {
      label: "Kelas Aktif",
      description: "Jumlah kelas terisi",
      value: activeGrades,
      icon: GraduationCap,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
        >
          <Card
            className={`group relative overflow-hidden border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl ${stat.border}`}
          >
            <div
              className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${stat.bg}`}
            />
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative flex items-start justify-between gap-4 p-5">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {stat.label}
                </p>
                <h3 className="text-3xl font-black tracking-tight text-white">
                  {stat.value}
                </h3>
                <p className="text-sm text-zinc-400">{stat.description}</p>
              </div>

              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 ${stat.bg} ${stat.color}`}
              >
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
