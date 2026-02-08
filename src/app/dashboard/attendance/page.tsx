"use client";

import { AttendanceForm } from "@/components/attendance/attendance-form";
import { HolidayManager } from "@/components/attendance/holiday-manager";
import { QRScannerView } from "@/components/attendance/qr-scanner-view";
import { ScheduleSettings } from "@/components/attendance/schedule-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarCheck, CalendarDays, Scan, Settings2 } from "lucide-react";

export default function AttendancePage() {
	return (
		<div className="space-y-8 animate-in fade-in duration-500">
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-4xl font-extrabold tracking-tight bg-linear-to-r from-emerald-400 via-teal-400 to-cyan-500 bg-clip-text text-transparent">
						Attendance Management
					</h1>
					<p className="text-zinc-400 mt-2 text-lg">
						Record presence via QR scanner or manual entry.
					</p>
				</div>
			</div>

			<Tabs defaultValue="scan" className="space-y-8">
				<TabsList className="bg-zinc-900/50 border border-zinc-800 p-1 h-14 rounded-2xl w-full flex overflow-x-auto scrollbar-none justify-start sm:justify-center gap-2">
					<TabsTrigger
						value="scan"
						className="rounded-xl px-6 whitespace-nowrap text-zinc-500 data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all gap-2"
					>
						<Scan className="h-4 w-4" /> QR Scanner
					</TabsTrigger>
					<TabsTrigger
						value="manual"
						className="rounded-xl px-6 whitespace-nowrap text-zinc-500 data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all gap-2"
					>
						<CalendarCheck className="h-4 w-4" /> Manual Entry
					</TabsTrigger>
					<TabsTrigger
						value="settings"
						className="rounded-xl px-6 whitespace-nowrap text-zinc-500 data-[state=active]:bg-zinc-800 data-[state=active]:text-white transition-all gap-2 border border-transparent data-[state=active]:border-zinc-700"
					>
						<Settings2 className="h-4 w-4" /> Schedule Settings
					</TabsTrigger>
					<TabsTrigger
						value="holidays"
						className="rounded-xl px-6 whitespace-nowrap text-zinc-500 data-[state=active]:bg-zinc-800 data-[state=active]:text-white transition-all gap-2 border border-transparent data-[state=active]:border-zinc-700"
					>
						<CalendarDays className="h-4 w-4" /> Holidays
					</TabsTrigger>
				</TabsList>

				<TabsContent
					value="scan"
					className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none"
				>
					<QRScannerView />
				</TabsContent>

				<TabsContent
					value="manual"
					className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none"
				>
					<div className="p-6 rounded-3xl bg-zinc-950/50 border border-zinc-900 border-t-zinc-800 shadow-2xl backdrop-blur-md">
						<AttendanceForm />
					</div>
				</TabsContent>

				<TabsContent
					value="settings"
					className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none"
				>
					<div className="p-8 rounded-3xl bg-zinc-950/50 border border-zinc-900 border-t-zinc-800 shadow-2xl backdrop-blur-md">
						<ScheduleSettings />
					</div>
				</TabsContent>

				<TabsContent
					value="holidays"
					className="animate-in fade-in slide-in-from-bottom-4 duration-500 outline-none"
				>
					<div className="p-8 rounded-3xl bg-zinc-950/50 border border-zinc-900 border-t-zinc-800 shadow-2xl backdrop-blur-md">
						<HolidayManager />
					</div>
				</TabsContent>
			</Tabs>
		</div>
	);
}
