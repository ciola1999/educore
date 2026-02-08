"use client";

import { AddTeacherDialog } from "@/components/teacher/add-teacher-dialog";
import { TeacherList } from "@/components/teacher/teacher-list";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";

export default function TeachersPage() {
	const [search, setSearch] = useQueryState(
		"q",
		parseAsString.withDefault("").withOptions({ shallow: false }),
	);

	const [role, setRole] = useQueryState(
		"role",
		parseAsStringEnum(["admin", "teacher", "staff"]).withOptions({
			shallow: false,
		}),
	);

	return (
		<div className="space-y-8 animate-in fade-in duration-500">
			{/* Header Section */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h2 className="text-4xl font-extrabold tracking-tight bg-linear-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
						Teachers
					</h2>
					<p className="text-zinc-400 mt-2 text-lg">
						Manage teacher and staff accounts with ease.
					</p>
				</div>
				<AddTeacherDialog />
			</div>

			{/* Filters Section */}
			<div className="flex flex-col sm:flex-row gap-4 p-1">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
					<Input
						placeholder="Search by name or email..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-10 h-11 bg-zinc-900/50 border-zinc-800 focus:ring-blue-500/20 transition-all rounded-xl"
					/>
				</div>
				<div className="flex gap-2">
					<Select
						value={role || "all"}
						onValueChange={(val) =>
							setRole(
								val === "all" ? null : (val as "admin" | "teacher" | "staff"),
							)
						}
					>
						<SelectTrigger className="h-11 w-[160px] bg-zinc-900/50 border-zinc-800 rounded-xl">
							<Filter className="h-4 w-4 mr-2 text-zinc-500" />
							<SelectValue placeholder="All Roles" />
						</SelectTrigger>
						<SelectContent className="bg-zinc-900 border-zinc-800 text-white rounded-xl">
							<SelectItem value="all">All Roles</SelectItem>
							<SelectItem value="teacher">Teachers</SelectItem>
							<SelectItem value="staff">Staff</SelectItem>
							<SelectItem value="admin">Admins</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<TeacherList />
		</div>
	);
}
