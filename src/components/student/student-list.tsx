"use client";

import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { Loader2, Pencil, RefreshCw, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { DeleteStudentDialog } from "./delete-student-dialog";
import { EditStudentDialog } from "./edit-student-dialog";

interface Student {
	id: string;
	nis: string;
	fullName: string;
	gender: "L" | "P";
	grade: string;
	parentName?: string | null;
	parentPhone?: string | null;
}

export function StudentList() {
	const [data, setData] = useState<Student[]>([]);
	const [loading, setLoading] = useState(true);
	const [isMounted, setIsMounted] = useState(false);

	// Edit state
	const [editOpen, setEditOpen] = useState(false);
	const [editStudent, setEditStudent] = useState<Student | null>(null);

	// Delete state
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);

	async function fetchStudents() {
		setLoading(true);
		try {
			const db = await getDb();
			const result = await db.select().from(students);
			setData(result as Student[]);
		} catch (e) {
			console.error("Failed to fetch students:", e);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		setIsMounted(true);
		fetchStudents();
	}, []);

	function handleEdit(student: Student) {
		setEditStudent(student);
		setEditOpen(true);
	}

	function handleDelete(student: Student) {
		setDeleteStudent(student);
		setDeleteOpen(true);
	}

	if (!isMounted) return null;

	if (loading && data.length === 0) {
		return (
			<div className="flex justify-center items-center py-20 text-zinc-500">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	if (data.length === 0) {
		return (
			<div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]">
				<div className="p-4 rounded-full bg-zinc-800/50 ring-1 ring-zinc-700">
					<Users className="h-10 w-10 text-zinc-500" />
				</div>
				<div className="space-y-1">
					<h3 className="text-xl font-medium text-white">No students found</h3>
					<p className="text-zinc-500 max-w-sm mx-auto">
						Your local database is currently empty. Start by adding a new
						student using the button above.
					</p>
				</div>
				<Button variant="outline" onClick={fetchStudents} className="mt-4">
					Refresh Data
				</Button>
			</div>
		);
	}

	return (
		<>
			<div className="space-y-4">
				<div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className="border-zinc-800 hover:bg-zinc-900/50">
								<TableHead className="text-zinc-400">NIS</TableHead>
								<TableHead className="text-zinc-400">Name</TableHead>
								<TableHead className="text-zinc-400">Grade</TableHead>
								<TableHead className="text-zinc-400">Gender</TableHead>
								<TableHead className="text-zinc-400 text-right">
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.map((student) => (
								<TableRow
									key={student.id}
									className="border-zinc-800 hover:bg-zinc-800/50 text-zinc-300"
								>
									<TableCell className="font-medium font-mono">
										{student.nis}
									</TableCell>
									<TableCell className="font-medium text-white">
										{student.fullName}
									</TableCell>
									<TableCell>
										<span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-900/30 text-blue-300 text-xs font-medium ring-1 ring-blue-800">
											{student.grade}
										</span>
									</TableCell>
									<TableCell>
										{student.gender === "L" ? "Male" : "Female"}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-2">
											<Button
												size="icon"
												variant="ghost"
												className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
												onClick={() => handleEdit(student)}
											>
												<Pencil className="h-4 w-4" />
											</Button>
											<Button
												size="icon"
												variant="ghost"
												className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-900/20"
												onClick={() => handleDelete(student)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
				<div className="flex justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={fetchStudents}
						className="gap-2 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
					>
						<RefreshCw className="h-3 w-3" /> Refresh List
					</Button>
				</div>
			</div>

			{/* Edit Dialog */}
			<EditStudentDialog
				student={editStudent}
				open={editOpen}
				onOpenChange={setEditOpen}
				onSuccess={fetchStudents}
			/>

			{/* Delete Dialog */}
			<DeleteStudentDialog
				student={deleteStudent}
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				onSuccess={fetchStudents}
			/>
		</>
	);
}
