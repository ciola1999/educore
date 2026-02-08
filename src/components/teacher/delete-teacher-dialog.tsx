"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteTeacher as deleteTeacherService } from "@/lib/services/teacher";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DeleteTeacherDialogProps {
	teacher: { id: string; fullName: string } | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

export function DeleteTeacherDialog({
	teacher,
	open,
	onOpenChange,
	onSuccess,
}: DeleteTeacherDialogProps) {
	const [loading, setLoading] = useState(false);

	async function handleDelete() {
		if (!teacher) return;

		setLoading(true);
		try {
			const success = await deleteTeacherService(teacher.id);
			if (success) {
				toast.success("Guru berhasil dihapus");
				onOpenChange(false);
				onSuccess();
			} else {
				toast.error("Gagal menghapus guru");
			}
		} catch (error) {
			console.error("❌ Delete failed:", error);
			toast.error("Terjadi kesalahan sistem");
		} finally {
			setLoading(false);
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white rounded-2xl shadow-2xl">
				<AlertDialogHeader>
					<div className="flex items-center gap-3 text-red-500 mb-2">
						<div className="p-2 rounded-full bg-red-500/10 ring-1 ring-red-500/20">
							<Trash2 className="h-5 w-5" />
						</div>
						<AlertDialogTitle className="text-xl font-bold">
							Delete Teacher?
						</AlertDialogTitle>
					</div>
					<AlertDialogDescription className="text-zinc-400 text-base leading-relaxed">
						Are you sure you want to delete{" "}
						<span className="text-white font-semibold underline decoration-red-500/50 decoration-2 underline-offset-4">
							{teacher?.fullName}
						</span>
						? This action is irreversible and will remove all associated account
						data.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
					<AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 rounded-xl h-11 px-6">
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={(e) => {
							e.preventDefault(); // Prevent closing before async finishes
							handleDelete();
						}}
						disabled={loading}
						className="bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl h-11 px-8 shadow-lg shadow-red-900/20 transition-all border-0"
					>
						{loading ? (
							<Loader2 className="mr-2 h-5 w-5 animate-spin" />
						) : (
							"Delete Permanently"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
