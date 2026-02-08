"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addHoliday, getHolidays } from "@/lib/services/attendance-v2";
import { CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export function HolidayManager() {
	const [holidays, setHolidays] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [adding, setAdding] = useState(false);
	const [newHoliday, setNewHoliday] = useState({ date: "", name: "" });

	const loadHolidays = useCallback(async () => {
		try {
			const data = await getHolidays();
			setHolidays(data);
		} catch {
			toast.error("Failed to load holidays");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadHolidays();
	}, [loadHolidays]);

	async function handleAdd(e: React.FormEvent) {
		e.preventDefault();
		if (!newHoliday.date || !newHoliday.name) return;
		setAdding(true);
		try {
			await addHoliday(newHoliday.date, newHoliday.name);
			toast.success("Holiday added");
			setNewHoliday({ date: "", name: "" });
			loadHolidays();
		} catch {
			toast.error("Failed to add holiday");
		} finally {
			setAdding(false);
		}
	}

	if (loading)
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="animate-spin" />
			</div>
		);

	return (
		<div className="space-y-8 animate-in fade-in duration-500">
			<div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl">
				<h3 className="text-xl font-bold text-white mb-6">Add New Holiday</h3>
				<form
					onSubmit={handleAdd}
					className="flex flex-col md:flex-row gap-6 items-end"
				>
					<div className="flex-1 space-y-3">
						<Label className="text-zinc-400 text-xs uppercase tracking-widest font-bold">
							Holiday Name
						</Label>
						<Input
							placeholder="e.g. Independence Day"
							value={newHoliday.name}
							onChange={(e) =>
								setNewHoliday({ ...newHoliday, name: e.target.value })
							}
							className="bg-zinc-950 border-zinc-800 h-12 rounded-xl focus:ring-blue-500/20 transition-all font-medium"
						/>
					</div>
					<div className="w-full md:w-64 space-y-3">
						<Label className="text-zinc-400 text-xs uppercase tracking-widest font-bold">
							Date
						</Label>
						<Input
							type="date"
							value={newHoliday.date}
							onChange={(e) =>
								setNewHoliday({ ...newHoliday, date: e.target.value })
							}
							className="bg-zinc-950 border-zinc-800 h-12 rounded-xl focus:ring-blue-500/20 transition-all font-medium"
						/>
					</div>
					<Button
						type="submit"
						disabled={adding}
						className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold h-12 px-10 rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
					>
						{adding ? (
							<Loader2 className="animate-spin" />
						) : (
							<Plus className="h-5 w-5 mr-2" />
						)}
						Assign Holiday
					</Button>
				</form>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{holidays.length === 0 ? (
					<div className="col-span-full py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
						No holidays scheduled yet.
					</div>
				) : (
					holidays.map((h) => (
						<div
							key={h.id}
							className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all group relative"
						>
							<div className="flex items-start justify-between">
								<div className="flex gap-4 items-center">
									<div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
										<CalendarIcon className="h-6 w-6" />
									</div>
									<div>
										<h4 className="font-bold text-white text-lg">{h.name}</h4>
										<p className="text-zinc-500 font-mono text-sm">
											{new Date(h.date).toLocaleDateString()}
										</p>
									</div>
								</div>
								<Button
									variant="ghost"
									size="icon"
									className="text-zinc-600 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
