// Project\educore\src\components\dashboard\dashboard-stats.tsx

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type DashboardStats,
	getDashboardStats,
} from "@/lib/services/dashboard";
import { ClipboardCheck, GraduationCap, Users } from "lucide-react";
import { useEffect, useState } from "react";

export function DashboardStatsCards() {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchStats() {
			try {
				const data = await getDashboardStats();
				setStats(data);
			} catch (e) {
				console.error(e);
			} finally {
				setLoading(false);
			}
		}
		fetchStats();
	}, []);

	if (loading) {
		return (
			<div className="flex gap-4">
				{[1, 2, 3].map((i) => (
					<div
						key={i}
						className="h-32 w-full rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse"
					/>
				))}
			</div>
		);
	}

	if (!stats) return null;

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
