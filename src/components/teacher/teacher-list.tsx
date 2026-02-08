"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useTeacherList } from "@/hooks/use-teacher-list";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
	ChevronDown,
	ChevronUp,
	GraduationCap,
	IdCard,
	Loader2,
	Pencil,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { IDCardView } from "../id-card/id-card-view";
import { DeleteTeacherDialog } from "./delete-teacher-dialog";
import { EditTeacherDialog } from "./edit-teacher-dialog";

export function TeacherList() {
	const {
		teachers,
		loading,
		sortBy,
		sortOrder,
		toggleSort,
		editOpen,
		setEditOpen,
		editTeacher,
		deleteOpen,
		setDeleteOpen,
		deleteTeacher,
		handleEdit,
		handleDelete,
		fetchTeachers,
	} = useTeacherList();

	const [idCardOpen, setIdCardOpen] = useState(false);
	const [selectedTeacherForCard, setSelectedTeacherForCard] =
		useState<any>(null);

	if (loading && teachers.length === 0) {
		return (
			<div className="flex justify-center items-center py-24 text-zinc-500">
				<Loader2 className="h-10 w-10 animate-spin text-blue-500" />
			</div>
		);
	}

	if (teachers.length === 0) {
		return (
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-16 flex flex-col items-center justify-center text-center space-y-6"
			>
				<div className="p-6 rounded-full bg-linear-to-b from-zinc-800 to-zinc-900 ring-1 ring-zinc-700 shadow-xl">
					<GraduationCap className="h-12 w-12 text-zinc-500" />
				</div>
				<div className="space-y-2">
					<h3 className="text-2xl font-semibold text-white">
						No teachers found
					</h3>
					<p className="text-zinc-500 max-w-sm mx-auto">
						Add teachers or adjust your search/filters to see results.
					</p>
				</div>
				<Button
					variant="secondary"
					onClick={() => fetchTeachers()}
					className="mt-4 px-8"
				>
					Refresh Data
				</Button>
			</motion.div>
		);
	}

	const roleColors: Record<string, string> = {
		teacher: "bg-pink-500/10 text-pink-400 ring-pink-500/20",
		staff: "bg-orange-500/10 text-orange-400 ring-orange-500/20",
		admin: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
	};

	const SortIcon = ({ column }: { column: string }) => {
		if (sortBy !== column) return null;
		return sortOrder === "asc" ? (
			<ChevronUp className="h-4 w-4 ml-1" />
		) : (
			<ChevronDown className="h-4 w-4 ml-1" />
		);
	};

	return (
		<>
			<div className="space-y-6">
				<div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 backdrop-blur-md overflow-hidden shadow-2xl">
					<Table>
						<TableHeader className="bg-zinc-900/50">
							<TableRow className="border-zinc-800 hover:bg-transparent">
								<TableHead
									className="text-zinc-400 font-medium cursor-pointer hover:text-white transition-colors"
									onClick={() => toggleSort("fullName")}
								>
									<div className="flex items-center">
										Name <SortIcon column="fullName" />
									</div>
								</TableHead>
								<TableHead
									className="text-zinc-400 font-medium cursor-pointer hover:text-white transition-colors"
									onClick={() => toggleSort("email")}
								>
									<div className="flex items-center">
										Email <SortIcon column="email" />
									</div>
								</TableHead>
								<TableHead className="text-zinc-400 font-medium">
									Role
								</TableHead>
								<TableHead className="text-zinc-400 font-medium text-right">
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<AnimatePresence mode="popLayout">
								{teachers.map((teacher, index) => (
									<motion.tr
										key={teacher.id}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, scale: 0.95 }}
										transition={{ delay: index * 0.05 }}
										className="border-zinc-800 hover:bg-white/5 transition-colors group border-b"
									>
										<TableCell className="font-semibold text-white py-4">
											{teacher.fullName}
										</TableCell>
										<TableCell className="text-zinc-400 font-mono text-sm">
											{teacher.email}
										</TableCell>
										<TableCell>
											<span
												className={cn(
													"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 capitalize shadow-xs",
													roleColors[teacher.role] ||
														"bg-zinc-800 text-zinc-400 ring-zinc-700",
												)}
											>
												{teacher.role}
											</span>
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												<Button
													size="icon"
													variant="ghost"
													className="h-9 w-9 text-zinc-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg"
													onClick={() => {
														setSelectedTeacherForCard(teacher);
														setIdCardOpen(true);
													}}
												>
													<IdCard className="h-4 w-4" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg"
													onClick={() => handleEdit(teacher)}
												>
													<Pencil className="h-4 w-4" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													className="h-9 w-9 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg"
													onClick={() => handleDelete(teacher)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</motion.tr>
								))}
							</AnimatePresence>
						</TableBody>
					</Table>
				</div>

				<div className="flex justify-between items-center text-sm text-zinc-500 px-2">
					<p>Showing {teachers.length} entries</p>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => fetchTeachers()}
						className="gap-2 text-zinc-400 hover:text-white"
					>
						<RefreshCw
							className={cn("h-4 w-4", loading && "animate-spin text-blue-500")}
						/>
						Refresh List
					</Button>
				</div>
			</div>

			<Dialog open={idCardOpen} onOpenChange={setIdCardOpen}>
				<DialogContent className="bg-zinc-950 border-zinc-900 text-white max-w-lg">
					<DialogHeader>
						<DialogTitle>Preview ID Card</DialogTitle>
					</DialogHeader>
					<div className="py-6 flex justify-center">
						{selectedTeacherForCard && (
							<IDCardView
								name={selectedTeacherForCard.fullName}
								id={selectedTeacherForCard.id}
								role={selectedTeacherForCard.role}
							/>
						)}
					</div>
				</DialogContent>
			</Dialog>

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
