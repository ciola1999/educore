"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useStudentList } from "@/hooks/use-student-list";
import { AnimatePresence, motion } from "framer-motion";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
	Filter,
	Loader2,
	Pencil,
	RefreshCw,
	Search,
	Trash2,
} from "lucide-react";
import { Badge } from "../ui/badge";

// Dialogs
import { DeleteStudentDialog } from "./delete-student-dialog";
import { EditStudentDialog } from "./edit-student-dialog";

function SortIcon({
	active,
	direction,
}: {
	active: boolean;
	direction?: "asc" | "desc";
}) {
	if (!active)
		return (
			<ArrowUpDown className="h-3 w-3 opacity-0 group-hover/head:opacity-50 transition-opacity" />
		);
	if (direction === "asc") return <ArrowUp className="h-3 w-3 text-blue-400" />;
	return <ArrowDown className="h-3 w-3 text-blue-400" />;
}

export function StudentList() {
	const {
		loading,
		searchQuery,
		currentPage,
		totalPages,
		paginatedData,
		totalCount,
		sortConfig,
		editOpen,
		setEditOpen,
		editStudent,
		deleteOpen,
		setDeleteOpen,
		deleteStudent,
		fetchStudents,
		handleEdit,
		handleDelete,
		handleSearchChange,
		handleSort,
		setCurrentPage,
	} = useStudentList();

	// --- RENDER ---
	if (loading && totalCount === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-20 space-y-4">
				<Loader2 className="h-10 w-10 animate-spin text-blue-500" />
				<p className="text-sm text-zinc-500 animate-pulse">
					Memuat data siswa...
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* 1. TOOLBAR (Search & Stats) */}
			<div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-zinc-900/40 backdrop-blur-md p-4 rounded-2xl border border-zinc-800 shadow-xl">
				<div className="relative w-full md:w-80">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
					<Input
						placeholder="Search Name, NIS, or Grade..."
						className="pl-10 bg-zinc-950/50 border-zinc-800 focus-visible:ring-blue-500/50 h-11 rounded-xl"
						value={searchQuery}
						onChange={(e) => handleSearchChange(e.target.value)}
					/>
				</div>

				<div className="flex items-center gap-3 text-sm">
					<Badge
						variant="secondary"
						className="bg-zinc-800/80 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700/50"
					>
						Total:{" "}
						<span className="text-white ml-1 font-bold">{totalCount}</span>{" "}
						Siswa
					</Badge>
					<Button
						variant="ghost"
						size="icon"
						onClick={fetchStudents}
						title="Refresh Data"
						className="hover:bg-blue-500/10 hover:text-blue-400 rounded-xl transition-all duration-300"
					>
						<RefreshCw className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* 2. TABLE CONTENT */}
			<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-md overflow-hidden shadow-2xl">
				<Table>
					<TableHeader className="bg-zinc-900/80">
						<TableRow className="border-zinc-800 hover:bg-transparent">
							<TableHead
								className="w-[120px] text-zinc-500 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:text-white transition-colors group/head"
								onClick={() => handleSort("nis")}
							>
								<div className="flex items-center gap-2">
									NIS
									<SortIcon
										active={sortConfig?.key === "nis"}
										direction={sortConfig?.direction}
									/>
								</div>
							</TableHead>
							<TableHead
								className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:text-white transition-colors group/head"
								onClick={() => handleSort("fullName")}
							>
								<div className="flex items-center gap-2">
									Nama Lengkap
									<SortIcon
										active={sortConfig?.key === "fullName"}
										direction={sortConfig?.direction}
									/>
								</div>
							</TableHead>
							<TableHead
								className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:text-white transition-colors group/head"
								onClick={() => handleSort("grade")}
							>
								<div className="flex items-center gap-2">
									Kelas
									<SortIcon
										active={sortConfig?.key === "grade"}
										direction={sortConfig?.direction}
									/>
								</div>
							</TableHead>
							<TableHead className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
								L/P
							</TableHead>
							<TableHead className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">
								Wali Murid
							</TableHead>
							<TableHead className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] text-right">
								Aksi
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{paginatedData.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="h-[300px] text-center">
									<div className="flex flex-col items-center justify-center space-y-4 text-zinc-500">
										<div className="p-4 bg-zinc-800/50 rounded-full border border-zinc-700/50">
											<Filter className="h-8 w-8" />
										</div>
										<p className="font-medium text-zinc-400">
											Data tidak ditemukan.
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							<AnimatePresence mode="popLayout">
								{paginatedData.map((student, index) => (
									<motion.tr
										layout
										initial={{ opacity: 0, x: -10 }}
										animate={{ opacity: 1, x: 0 }}
										exit={{ opacity: 0, scale: 0.95 }}
										transition={{ duration: 0.2, delay: index * 0.05 }}
										key={student.id}
										className="border-zinc-800 hover:bg-zinc-800/40 transition-colors group cursor-default"
									>
										<TableCell className="font-mono text-zinc-500 group-hover:text-blue-400 transition-colors">
											{student.nis}
										</TableCell>
										<TableCell className="font-semibold text-white">
											{student.fullName}
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className="border-zinc-700 group-hover:border-zinc-500 text-zinc-400 transition-all rounded-md"
											>
												{student.grade}
											</Badge>
										</TableCell>
										<TableCell>
											{student.gender === "L" ? (
												<div className="flex items-center gap-1.5">
													<div className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
													<span className="text-blue-400 text-xs font-bold font-mono">
														L
													</span>
												</div>
											) : (
												<div className="flex items-center gap-1.5">
													<div className="h-1.5 w-1.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]" />
													<span className="text-pink-400 text-xs font-bold font-mono">
														P
													</span>
												</div>
											)}
										</TableCell>
										<TableCell className="text-zinc-500 hidden md:table-cell text-sm italic">
											{student.parentName || "-"}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
												<Button
													size="icon"
													variant="ghost"
													className="h-9 w-9 text-zinc-400 hover:text-yellow-400 hover:bg-yellow-400/10 rounded-xl"
													onClick={() => handleEdit(student)}
													title="Edit Data"
												>
													<Pencil className="h-4 w-4" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													className="h-9 w-9 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl"
													onClick={() => handleDelete(student)}
													title="Hapus Siswa"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</motion.tr>
								))}
							</AnimatePresence>
						)}
					</TableBody>
				</Table>
			</div>

			{/* 3. PAGINATION FOOTER */}
			{totalPages > 1 && (
				<div className="flex items-center justify-end gap-3 py-4">
					<span className="text-[10px] uppercase font-bold tracking-widest text-zinc-600 mr-4">
						Halaman {currentPage} <span className="text-zinc-800 mx-1">/</span>{" "}
						{totalPages}
					</span>
					<Button
						variant="outline"
						size="icon"
						className="h-9 w-9 border-zinc-800 bg-zinc-900/50 rounded-xl hover:bg-zinc-800 transition-all"
						onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
						disabled={currentPage === 1}
					>
						<ChevronLeft className="h-5 w-5" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="h-9 w-9 border-zinc-800 bg-zinc-900/50 rounded-xl hover:bg-zinc-800 transition-all"
						onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
						disabled={currentPage === totalPages}
					>
						<ChevronRight className="h-5 w-5" />
					</Button>
				</div>
			)}

			{/* DIALOGS */}
			<EditStudentDialog
				student={editStudent}
				open={editOpen}
				onOpenChange={setEditOpen}
				onSuccess={fetchStudents}
			/>

			<DeleteStudentDialog
				student={deleteStudent}
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				onSuccess={fetchStudents}
			/>
		</div>
	);
}
