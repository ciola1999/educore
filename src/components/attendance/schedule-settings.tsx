"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { AttendanceSettings } from "@/lib/db/schema";
import {
	deleteAttendanceSetting,
	getAttendanceSettings,
	upsertAttendanceSetting,
} from "@/lib/services/attendance-v2";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function ScheduleSettings() {
	const [settings, setSettings] = useState<AttendanceSettings[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState<string | null>(null);

	const days = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	];

	const loadSettings = useCallback(async () => {
		try {
			const data = await getAttendanceSettings();
			setSettings(data);
		} catch {
			toast.error("Failed to load settings");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadSettings();
	}, [loadSettings]);

	async function handleAdd() {
		const newSetting = {
			id: "temp-" + Date.now(),
			dayOfWeek: 1,
			startTime: "07:00",
			endTime: "15:00",
			lateThreshold: "07:15",
			entityType: "student" as const,
			isActive: true,
			createdAt: new Date(),
			updatedAt: new Date(),
			syncStatus: "pending" as const,
			deletedAt: null,
		} as AttendanceSettings;
		setSettings((prev) => [...prev, newSetting]);
	}

	async function handleDelete(id: string) {
		console.log("Delete triggered for ID:", id);
		try {
			if (id.startsWith("temp-")) {
				setSettings((prev) => prev.filter((s) => s.id !== id));
				return;
			}
			setSaving(id);
			await deleteAttendanceSetting(id);
			toast.success("Setting deleted");
			await loadSettings();
		} catch (error) {
			console.error("Delete error:", error);
			toast.error("Failed to delete setting");
		} finally {
			setSaving(null);
		}
	}

	async function handleSave(setting: any) {
		console.log("Save triggered for setting:", setting);
		setSaving(setting.id);
		try {
			await upsertAttendanceSetting(setting);
			toast.success("Setting saved");
			await loadSettings();
		} catch (error: any) {
			console.error("Save error:", error);
			toast.error(error.message || "Failed to save setting");
		} finally {
			setSaving(null);
		}
	}

	if (loading)
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="animate-spin" />
			</div>
		);

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h3 className="text-xl font-bold text-white">Weekly Schedule</h3>
				<Button onClick={handleAdd} size="sm" className="bg-blue-600">
					<Plus className="h-4 w-4 mr-2" /> Add Schedule
				</Button>
			</div>

			<div className="grid gap-4">
				{settings.map((s, idx) => (
					<div
						key={s.id}
						className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 grid grid-cols-1 md:grid-cols-6 gap-4 items-end animate-in fade-in slide-in-from-top-2 duration-300"
					>
						<div className="space-y-2">
							<Label className="text-zinc-400 text-xs uppercase tracking-wider">
								Day
							</Label>
							<Select
								value={s.dayOfWeek.toString()}
								onValueChange={(val) => {
									const newSettings = [...settings];
									newSettings[idx].dayOfWeek = parseInt(val);
									setSettings(newSettings);
								}}
							>
								<SelectTrigger className="bg-zinc-950 border-zinc-700 h-10">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="bg-zinc-900 border-zinc-800 text-white">
									{days.map((day, i) => (
										<SelectItem key={day} value={i.toString()}>
											{day}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label className="text-zinc-400 text-xs uppercase tracking-wider text-green-400">
								Start Time
							</Label>
							<Input
								type="time"
								value={s.startTime}
								onChange={(e) => {
									const newSettings = [...settings];
									newSettings[idx].startTime = e.target.value;
									setSettings(newSettings);
								}}
								className="bg-zinc-950 border-zinc-700 h-10"
							/>
						</div>

						<div className="space-y-2">
							<Label className="text-zinc-400 text-xs uppercase tracking-wider text-red-500">
								Late Limit
							</Label>
							<Input
								type="time"
								value={s.lateThreshold}
								onChange={(e) => {
									const newSettings = [...settings];
									newSettings[idx].lateThreshold = e.target.value;
									setSettings(newSettings);
								}}
								className="bg-zinc-950 border-zinc-700 h-10"
							/>
						</div>

						<div className="space-y-2">
							<Label className="text-zinc-400 text-xs uppercase tracking-wider">
								End Time
							</Label>
							<Input
								type="time"
								value={s.endTime}
								onChange={(e) => {
									const newSettings = [...settings];
									newSettings[idx].endTime = e.target.value;
									setSettings(newSettings);
								}}
								className="bg-zinc-950 border-zinc-700 h-10"
							/>
						</div>

						<div className="space-y-2">
							<Label className="text-zinc-400 text-xs uppercase tracking-wider">
								Type
							</Label>
							<Select
								value={s.entityType}
								onValueChange={(val) => {
									const newSettings = [...settings];
									newSettings[idx].entityType = val as "student" | "employee";
									setSettings(newSettings);
								}}
							>
								<SelectTrigger className="bg-zinc-950 border-zinc-700 h-10">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="bg-zinc-900 border-zinc-800 text-white">
									<SelectItem value="student">Student</SelectItem>
									<SelectItem value="employee">Employee</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex gap-2">
							<Button
								variant="default"
								size="icon"
								onClick={() => handleSave(s)}
								disabled={saving === s.id}
								className="bg-blue-600 hover:bg-blue-500"
							>
								{saving === s.id ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Save className="h-4 w-4" />
								)}
							</Button>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => handleDelete(s.id)}
								disabled={saving === s.id}
								className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
							>
								{saving === s.id ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Trash2 className="h-4 w-4" />
								)}
							</Button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
