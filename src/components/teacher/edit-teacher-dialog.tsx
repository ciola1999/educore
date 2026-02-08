"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface EditTeacherDialogProps {
	teacher: {
		id: string;
		fullName: string;
		email: string;
		role: "admin" | "teacher" | "staff";
	} | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

export function EditTeacherDialog({
	teacher,
	open,
	onOpenChange,
	onSuccess,
}: EditTeacherDialogProps) {
	const [loading, setLoading] = useState(false);

	const [formData, setFormData] = useState({
		fullName: "",
		email: "",
		role: "teacher" as "admin" | "teacher" | "staff",
	});

	useEffect(() => {
		if (teacher) {
			setFormData({
				fullName: teacher.fullName,
				email: teacher.email,
				role: teacher.role,
			});
		}
	}, [teacher]);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!teacher) return;

		setLoading(true);
		try {
			const db = await getDb();
			await db
				.update(users)
				.set({
					fullName: formData.fullName,
					email: formData.email,
					role: formData.role,
					updatedAt: new Date(),
				})
				.where(eq(users.id, teacher.id));

			onOpenChange(false);
			onSuccess();
			toast.success("Guru berhasil diperbarui");
		} catch (error: unknown) {
			console.error("❌ Update failed:", error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			if (errorMessage.includes("UNIQUE constraint failed")) {
				toast.error("Email sudah digunakan");
			} else {
				toast.error("Gagal memperbarui data");
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800 text-white rounded-2xl shadow-2xl">
				<DialogHeader>
					<DialogTitle className="text-2xl font-bold">Edit Teacher</DialogTitle>
					<DialogDescription className="text-zinc-400">
						Update teacher information below. Changes are saved instantly.
					</DialogDescription>
				</DialogHeader>

				<form
					onSubmit={handleSubmit}
					className="grid gap-6 py-6 border-y border-zinc-800 my-2"
				>
					<div className="grid gap-2">
						<Label htmlFor="edit-fullName" className="text-zinc-300">
							Full Name
						</Label>
						<Input
							id="edit-fullName"
							value={formData.fullName}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, fullName: e.target.value }))
							}
							className="bg-zinc-950 border-zinc-800 h-11 rounded-xl focus:ring-blue-500/20"
							placeholder="e.g. John Doe"
							required
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="edit-email" className="text-zinc-300">
							Email Address
						</Label>
						<Input
							id="edit-email"
							type="email"
							value={formData.email}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, email: e.target.value }))
							}
							className="bg-zinc-950 border-zinc-800 h-11 rounded-xl focus:ring-blue-500/20"
							placeholder="name@school.com"
							required
						/>
					</div>

					<div className="grid gap-2">
						<Label className="text-zinc-300">Role</Label>
						<Select
							value={formData.role}
							onValueChange={(value: "admin" | "teacher" | "staff") =>
								setFormData((prev) => ({ ...prev, role: value }))
							}
						>
							<SelectTrigger className="bg-zinc-950 border-zinc-800 h-11 rounded-xl">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="bg-zinc-900 border-zinc-800 text-white rounded-xl">
								<SelectItem value="teacher">Teacher</SelectItem>
								<SelectItem value="staff">Staff</SelectItem>
								<SelectItem value="admin">Admin</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<DialogFooter className="pt-2">
						<Button
							type="submit"
							disabled={loading}
							className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20"
						>
							{loading ? (
								<Loader2 className="mr-2 h-5 w-5 animate-spin" />
							) : (
								"Save Changes"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
