import { ClipboardCheck, GraduationCap, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type DashboardStats,
  getDashboardStats,
} from "@/lib/services/dashboard";

const emptyStats: DashboardStats = {
  totalStudents: 0,
  totalTeachers: 0,
  attendanceToday: {
    present: 0,
    sick: 0,
    permission: 0,
    alpha: 0,
    totalRecorded: 0,
  },
};

export async function DashboardStatsCards() {
  const stats = await getDashboardStats().catch(() => emptyStats);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-zinc-900 border-zinc-800 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">
            Total Students
          </CardTitle>
          <Users className="h-4 w-4 text-zinc-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalStudents}</div>
          <p className="text-xs text-zinc-500">Active students enrolled</p>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">
            Total Teachers
          </CardTitle>
          <GraduationCap className="h-4 w-4 text-zinc-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalTeachers}</div>
          <p className="text-xs text-zinc-500">Teachers & staff members</p>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">
            Recorded Attendance
          </CardTitle>
          <ClipboardCheck className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.attendanceToday.totalRecorded}
          </div>
          <p className="text-xs text-zinc-500">Students marked today</p>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800 text-white">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">
            Presence Rate
          </CardTitle>
          <div className="text-xs font-mono text-emerald-500 bg-emerald-950 px-1.5 py-0.5 rounded">
            Today
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.attendanceToday.totalRecorded > 0
              ? Math.round(
                  (stats.attendanceToday.present /
                    stats.attendanceToday.totalRecorded) *
                    100,
                )
              : 0}
            %
          </div>
          <p className="text-xs text-zinc-500">
            {stats.attendanceToday.present} Present /{" "}
            {stats.attendanceToday.sick + stats.attendanceToday.permission}{" "}
            Absent
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
