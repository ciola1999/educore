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
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Loader2 } from "lucide-react";
import { useState } from "react";

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
			const db = await getDb();
			await db.delete(users).where(eq(users.id, teacher.id));

			onOpenChange(false);
			onSuccess();
			console.log("✅ Teacher deleted!");
		} catch (error) {
			console.error("❌ Delete failed:", error);
			alert("Failed to delete.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Teacher?</AlertDialogTitle>
					<AlertDialogDescription className="text-zinc-400">
						Are you sure you want to delete{" "}
						<span className="text-white font-semibold">
							{teacher?.fullName}
						</span>
						? This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleDelete}
						disabled={loading}
						className="bg-red-600 hover:bg-red-500 text-white"
					>
						{loading ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							"Delete"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
