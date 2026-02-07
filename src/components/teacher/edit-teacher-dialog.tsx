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
		role: "teacher" as "teacher" | "staff",
	});

	useEffect(() => {
		if (teacher) {
			setFormData({
				fullName: teacher.fullName,
				email: teacher.email,
				role: teacher.role as "teacher" | "staff",
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
				})
				.where(eq(users.id, teacher.id));

			onOpenChange(false);
			onSuccess();
			console.log("✅ Teacher updated!");
		} catch (error: any) {
			console.error("❌ Update failed:", error);
			const errorMessage = error?.message || String(error);
			if (errorMessage.includes("UNIQUE constraint failed")) {
				alert("Email already used!");
			} else {
				alert("Failed to update. Check console.");
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800 text-white">
				<DialogHeader>
					<DialogTitle>Edit Teacher</DialogTitle>
					<DialogDescription className="text-zinc-400">
						Update teacher information below.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="edit-fullName">Full Name</Label>
						<Input
							id="edit-fullName"
							value={formData.fullName}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, fullName: e.target.value }))
							}
							className="bg-zinc-950 border-zinc-700"
							required
						/>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="edit-email">Email</Label>
						<Input
							id="edit-email"
							type="email"
							value={formData.email}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, email: e.target.value }))
							}
							className="bg-zinc-950 border-zinc-700"
							required
						/>
					</div>

					<div className="grid gap-2">
						<Label>Role</Label>
						<Select
							value={formData.role}
							onValueChange={(value: "teacher" | "staff") =>
								setFormData((prev) => ({ ...prev, role: value }))
							}
						>
							<SelectTrigger className="bg-zinc-950 border-zinc-700">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="bg-zinc-900 border-zinc-800 text-white">
								<SelectItem value="teacher">Teacher</SelectItem>
								<SelectItem value="staff">Staff</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<DialogFooter className="mt-4">
						<Button
							type="submit"
							disabled={loading}
							className="w-full bg-blue-600 hover:bg-blue-700"
						>
							{loading ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
