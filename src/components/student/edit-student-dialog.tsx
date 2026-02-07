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
import { students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface EditStudentDialogProps {
	student: {
		id: string;
		nis: string;
		fullName: string;
		gender: "L" | "P";
		grade: string;
		parentName?: string | null;
		parentPhone?: string | null;
	} | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

export function EditStudentDialog({
	student,
	open,
	onOpenChange,
	onSuccess,
}: EditStudentDialogProps) {
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const [formData, setFormData] = useState({
		nis: "",
		fullName: "",
		gender: "L" as "L" | "P",
		grade: "",
		parentName: "",
		parentPhone: "",
	});

	useEffect(() => {
		if (student) {
			setFormData({
				nis: student.nis,
				fullName: student.fullName,
				gender: student.gender,
				grade: student.grade,
				parentName: student.parentName || "",
				parentPhone: student.parentPhone || "",
			});
		}
	}, [student]);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!student) return;

		setLoading(true);
		try {
			const db = await getDb();
			await db
				.update(students)
				.set({
					nis: formData.nis,
					fullName: formData.fullName,
					gender: formData.gender,
					grade: formData.grade,
					parentName: formData.parentName || null,
					parentPhone: formData.parentPhone || null,
				})
				.where(eq(students.id, student.id));

			onOpenChange(false);
			onSuccess();
			console.log("✅ Student updated!");
		} catch (error: any) {
			console.error("❌ Update failed:", error);
			const errorMessage = error?.message || String(error);
			if (errorMessage.includes("UNIQUE constraint failed")) {
				alert("NIS sudah digunakan siswa lain!");
			} else {
				alert("Gagal update data. Cek console.");
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800 text-white">
				<DialogHeader>
					<DialogTitle>Edit Student</DialogTitle>
					<DialogDescription className="text-zinc-400">
						Update student information below.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="grid gap-4 py-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label htmlFor="edit-nis">NIS</Label>
							<Input
								id="edit-nis"
								value={formData.nis}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, nis: e.target.value }))
								}
								className="bg-zinc-950 border-zinc-700"
								required
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-grade">Grade</Label>
							<Input
								id="edit-grade"
								value={formData.grade}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, grade: e.target.value }))
								}
								className="bg-zinc-950 border-zinc-700"
								required
							/>
						</div>
					</div>

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
						<Label>Gender</Label>
						<Select
							value={formData.gender}
							onValueChange={(value: "L" | "P") =>
								setFormData((prev) => ({ ...prev, gender: value }))
							}
						>
							<SelectTrigger className="bg-zinc-950 border-zinc-700">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="bg-zinc-900 border-zinc-800 text-white">
								<SelectItem value="L">Male (Laki-laki)</SelectItem>
								<SelectItem value="P">Female (Perempuan)</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="my-2 border-t border-zinc-800"></div>
					<p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
						Parent Information
					</p>

					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label htmlFor="edit-parentName">Parent Name</Label>
							<Input
								id="edit-parentName"
								value={formData.parentName}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										parentName: e.target.value,
									}))
								}
								className="bg-zinc-950 border-zinc-700"
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-parentPhone">Phone</Label>
							<Input
								id="edit-parentPhone"
								value={formData.parentPhone}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										parentPhone: e.target.value,
									}))
								}
								className="bg-zinc-950 border-zinc-700"
							/>
						</div>
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
