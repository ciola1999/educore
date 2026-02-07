"use client";

import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { classes, students } from "@/lib/db/schema";
import { recordBulkAttendance } from "@/lib/services/attendance";
import { eq } from "drizzle-orm";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type AttendanceStatus = "present" | "sick" | "permission" | "alpha";

interface StudentRecord {
	id: string;
	nis: string;
	fullName: string;
	status: AttendanceStatus;
	notes: string;
}

interface ClassOption {
	id: string;
	name: string;
}

export function AttendanceForm() {
	const [isMounted, setIsMounted] = useState(false);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [studentList, setStudentList] = useState<StudentRecord[]>([]);
	const [selectedDate, setSelectedDate] = useState(
		() => new Date().toISOString().split("T")[0],
	);
	const [selectedClass, setSelectedClass] = useState("");
	const [classList, setClassList] = useState<ClassOption[]>([]);

	useEffect(() => {
		setIsMounted(true);
		fetchClasses();
	}, []);

	// Fetch students when class changes
	useEffect(() => {
		if (selectedClass) {
			fetchStudentsByClass(selectedClass);
		}
	}, [selectedClass]);

	async function fetchClasses() {
		try {
			const db = await getDb();
			const result = await db
				.select({ id: classes.id, name: classes.name })
				.from(classes);
			setClassList(result);
			if (result.length > 0) {
				setSelectedClass(result[0].id);
			}
		} catch (e) {
			console.error("Failed to fetch classes:", e);
		} finally {
			setLoading(false);
		}
	}

	async function fetchStudentsByClass(classId: string) {
		setLoading(true);
		try {
			const db = await getDb();
			// Find the class name first
			const classData = classList.find((c) => c.id === classId);
			if (!classData) {
				setStudentList([]);
				setLoading(false);
				return;
			}
			// Get students by grade (class name)
			const result = await db
				.select()
				.from(students)
				.where(eq(students.grade, classData.name));
			const records: StudentRecord[] = result.map((s: any) => ({
				id: s.id,
				nis: s.nis,
				fullName: s.fullName,
				status: "present" as AttendanceStatus,
				notes: "",
			}));
			setStudentList(records);
		} catch (e) {
			console.error("Failed to fetch students:", e);
		} finally {
			setLoading(false);
		}
	}

	function updateStatus(studentId: string, status: AttendanceStatus) {
		setStudentList((prev) =>
			prev.map((s) => (s.id === studentId ? { ...s, status } : s)),
		);
	}

	async function handleSubmit() {
		setSubmitting(true);
		try {
			const result = await recordBulkAttendance({
				classId: selectedClass,
				date: selectedDate,
				recordedBy: "admin-001", // TODO: Get from auth context
				records: studentList.map((s) => ({
					studentId: s.id,
					status: s.status,
					notes: s.notes,
				})),
			});

			if (result.success) {
				alert(`✅ Attendance saved for ${result.count} students!`);
			} else {
				alert(`❌ Failed: ${result.error}`);
			}
		} catch (e) {
			console.error("Submit error:", e);
			alert("Failed to save attendance");
		} finally {
			setSubmitting(false);
		}
	}

	if (!isMounted) return null;

	if (loading && classList.length === 0) {
		return (
			<div className="flex justify-center items-center py-20 text-zinc-500">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	const statusColors: Record<AttendanceStatus, string> = {
		present: "bg-emerald-600 hover:bg-emerald-500",
		sick: "bg-yellow-600 hover:bg-yellow-500",
		permission: "bg-blue-600 hover:bg-blue-500",
		alpha: "bg-red-600 hover:bg-red-500",
	};

	const statusLabels: Record<AttendanceStatus, string> = {
		present: "P",
		sick: "S",
		permission: "I",
		alpha: "A",
	};

	return (
		<div className="space-y-6">
			{/* Controls */}
			<div className="flex items-center gap-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800">
				<div className="flex items-center gap-2">
					<CalendarDays className="h-5 w-5 text-zinc-400" />
					<input
						type="date"
						value={selectedDate}
						onChange={(e) => setSelectedDate(e.target.value)}
						className="bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-zinc-400 text-sm">Class:</span>
					<select
						value={selectedClass}
						onChange={(e) => setSelectedClass(e.target.value)}
						className="bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-blue-500"
					>
						{classList.length === 0 ? (
							<option value="">No classes available</option>
						) : (
							classList.map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							))
						)}
					</select>
				</div>
				<div className="ml-auto flex gap-2">
					<Button
						onClick={() =>
							setStudentList((prev) =>
								prev.map((s) => ({ ...s, status: "present" })),
							)
						}
						variant="outline"
						size="sm"
						className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
					>
						<Check className="h-4 w-4 mr-1" /> All Present
					</Button>
				</div>
			</div>

			{classList.length === 0 && (
				<div className="text-center py-12 text-zinc-500 bg-zinc-900/50 rounded-lg border border-dashed border-zinc-800">
					No classes found. Please add classes first in{" "}
					<span className="text-blue-400">Courses</span> menu.
				</div>
			)}

			{classList.length > 0 && (
				<>
					{/* Legend */}
					<div className="flex gap-4 text-sm">
						<span className="flex items-center gap-1">
							<span className="w-4 h-4 rounded bg-emerald-600"></span> Present
						</span>
						<span className="flex items-center gap-1">
							<span className="w-4 h-4 rounded bg-yellow-600"></span> Sick
						</span>
						<span className="flex items-center gap-1">
							<span className="w-4 h-4 rounded bg-blue-600"></span> Permission
						</span>
						<span className="flex items-center gap-1">
							<span className="w-4 h-4 rounded bg-red-600"></span> Alpha
						</span>
					</div>

					{/* Student List */}
					{loading ? (
						<div className="flex justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
						</div>
					) : (
						<div className="space-y-2">
							{studentList.map((student, idx) => (
								<div
									key={student.id}
									className="flex items-center gap-4 p-3 rounded-lg bg-zinc-900 border border-zinc-800"
								>
									<span className="w-8 text-zinc-500 text-sm font-mono">
										{idx + 1}.
									</span>
									<span className="font-mono text-zinc-400 text-sm w-20">
										{student.nis}
									</span>
									<span className="flex-1 text-white font-medium">
										{student.fullName}
									</span>
									<div className="flex gap-1">
										{(
											[
												"present",
												"sick",
												"permission",
												"alpha",
											] as AttendanceStatus[]
										).map((status) => (
											<button
												key={status}
												type="button"
												onClick={() => updateStatus(student.id, status)}
												className={`w-8 h-8 rounded-md text-xs font-bold transition-all ${
													student.status === status
														? statusColors[status] +
															" text-white ring-2 ring-offset-2 ring-offset-zinc-900"
														: "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
												}`}
											>
												{statusLabels[status]}
											</button>
										))}
									</div>
								</div>
							))}
						</div>
					)}

					{studentList.length === 0 && !loading && (
						<div className="text-center py-12 text-zinc-500">
							No students found in this class. Make sure student's Grade matches
							the class name.
						</div>
					)}

					{/* Submit Button */}
					{studentList.length > 0 && (
						<div className="flex justify-end pt-4 border-t border-zinc-800">
							<Button
								onClick={handleSubmit}
								disabled={submitting}
								className="bg-blue-600 hover:bg-blue-500 gap-2"
							>
								{submitting ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Check className="h-4 w-4" />
								)}
								Save Attendance
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
