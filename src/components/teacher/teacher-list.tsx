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
import { users } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import {
	GraduationCap,
	Loader2,
	Pencil,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DeleteTeacherDialog } from "./delete-teacher-dialog";
import { EditTeacherDialog } from "./edit-teacher-dialog";

interface Teacher {
	id: string;
	fullName: string;
	email: string;
	role: "admin" | "teacher" | "staff";
}

export function TeacherList() {
	const [data, setData] = useState<Teacher[]>([]);
	const [loading, setLoading] = useState(true);
	const [isMounted, setIsMounted] = useState(false);

	const [editOpen, setEditOpen] = useState(false);
	const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);

	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteTeacher, setDeleteTeacher] = useState<Teacher | null>(null);

	async function fetchTeachers() {
		setLoading(true);
		try {
			const db = await getDb();
			const result = await db
				.select()
				.from(users)
				.where(or(eq(users.role, "teacher"), eq(users.role, "staff")));
			setData(result as Teacher[]);
		} catch (e) {
			console.error("Failed to fetch teachers:", e);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		setIsMounted(true);
		fetchTeachers();
	}, []);

	function handleEdit(teacher: Teacher) {
		setEditTeacher(teacher);
		setEditOpen(true);
	}

	function handleDelete(teacher: Teacher) {
		setDeleteTeacher(teacher);
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
					<GraduationCap className="h-10 w-10 text-zinc-500" />
				</div>
				<div className="space-y-1">
					<h3 className="text-xl font-medium text-white">No teachers found</h3>
					<p className="text-zinc-500 max-w-sm mx-auto">
						Add teachers or staff members using the button above.
					</p>
				</div>
				<Button variant="outline" onClick={fetchTeachers} className="mt-4">
					Refresh Data
				</Button>
			</div>
		);
	}

	const roleColors: Record<string, string> = {
		teacher: "bg-pink-900/30 text-pink-300 ring-pink-800",
		staff: "bg-orange-900/30 text-orange-300 ring-orange-800",
		admin: "bg-violet-900/30 text-violet-300 ring-violet-800",
	};

	return (
		<>
			<div className="space-y-4">
				<div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className="border-zinc-800 hover:bg-zinc-900/50">
								<TableHead className="text-zinc-400">Name</TableHead>
								<TableHead className="text-zinc-400">Email</TableHead>
								<TableHead className="text-zinc-400">Role</TableHead>
								<TableHead className="text-zinc-400 text-right">
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.map((teacher) => (
								<TableRow
									key={teacher.id}
									className="border-zinc-800 hover:bg-zinc-800/50 text-zinc-300"
								>
									<TableCell className="font-medium text-white">
										{teacher.fullName}
									</TableCell>
									<TableCell className="font-mono text-sm">
										{teacher.email}
									</TableCell>
									<TableCell>
										<span
											className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ring-1 capitalize ${roleColors[teacher.role]}`}
										>
											{teacher.role}
										</span>
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-2">
											<Button
												size="icon"
												variant="ghost"
												className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
												onClick={() => handleEdit(teacher)}
											>
												<Pencil className="h-4 w-4" />
											</Button>
											<Button
												size="icon"
												variant="ghost"
												className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-900/20"
												onClick={() => handleDelete(teacher)}
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
						onClick={fetchTeachers}
						className="gap-2 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white"
					>
						<RefreshCw className="h-3 w-3" /> Refresh List
					</Button>
				</div>
			</div>

			<EditTeacherDialog
				teacher={editTeacher}
				open={editOpen}
				onOpenChange={setEditOpen}
				onSuccess={fetchTeachers}
			/>

			<DeleteTeacherDialog
				teacher={deleteTeacher}
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				onSuccess={fetchTeachers}
			/>
		</>
	);
}
