"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import { updateClass } from "@/lib/services/academic";
import { eq, or } from "drizzle-orm";
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

export function EditClassDialog({
	classData,
	onSuccess,
}: {
	classData: any;
	onSuccess: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [teachers, setTeachers] = useState<{ id: string; fullName: string }[]>(
		[],
	);

	useEffect(() => {
		if (open) {
			fetchTeachers();
		}
	}, [open]);

	async function fetchTeachers() {
		const db = await getDb();
		const result = await db
			.select({ id: users.id, fullName: users.fullName })
			.from(users)
			.where(or(eq(users.role, "teacher"), eq(users.role, "staff")));
		setTeachers(result);
	}

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setLoading(true);
		const formData = new FormData(e.currentTarget);

		try {
			await updateClass(classData.id, {
				name: formData.get("name") as string,
				academicYear: formData.get("academicYear") as string,
				homeroomTeacherId: formData.get("homeroomTeacherId") as string,
			});
			setOpen(false);
			onSuccess();
		} catch (error) {
			console.error(error);
			alert("Failed to update class");
		} finally {
			setLoading(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					size="icon"
					variant="ghost"
					className="h-8 w-8 text-zinc-400 hover:text-blue-400"
				>
					<Pencil className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-white">
				<DialogHeader>
					<DialogTitle>Edit Class</DialogTitle>
					<DialogDescription className="text-zinc-400">
						Update class details and homeroom teacher.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="name">Class Name</Label>
						<Input
							id="name"
							name="name"
							defaultValue={classData.name}
							placeholder="e.g. X-RPL-1"
							className="bg-zinc-950 border-zinc-700"
							required
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="academicYear">Academic Year</Label>
						<Input
							id="academicYear"
							name="academicYear"
							defaultValue={classData.academicYear}
							placeholder="e.g. 2025/2026"
							className="bg-zinc-950 border-zinc-700"
							required
						/>
					</div>
					<div className="grid gap-2">
						<Label>Homeroom Teacher</Label>
						<Select
							name="homeroomTeacherId"
							defaultValue={classData.homeroomTeacherId || undefined}
						>
							<SelectTrigger className="bg-zinc-950 border-zinc-700">
								<SelectValue placeholder="Select teacher" />
							</SelectTrigger>
							<SelectContent className="bg-zinc-900 border-zinc-800 text-white">
								{teachers.map((t) => (
									<SelectItem key={t.id} value={t.id}>
										{t.fullName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<DialogFooter>
						<Button
							type="submit"
							disabled={loading}
							className="bg-blue-600 hover:bg-blue-500"
						>
							{loading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
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
