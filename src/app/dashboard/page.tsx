"use client";

import { DashboardStatsCards } from "@/components/dashboard/dashboard-stats";

export default function DashboardPage() {
	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-3xl font-bold bg-linear-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
					Dashboard
				</h1>
				<p className="text-zinc-400 mt-2">
					Welcome back, Administrator. Here's what's happening today.
				</p>
			</div>

			<DashboardStatsCards />

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 opacity-50 pointer-events-none grayscale">
				<div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 h-64 flex items-center justify-center">
					<span className="text-zinc-500">Attendance Chart (Coming Soon)</span>
				</div>
				<div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 h-64 flex items-center justify-center">
					<span className="text-zinc-500">Recent Activity (Coming Soon)</span>
				</div>
			</div>
		</div>
	);
}
