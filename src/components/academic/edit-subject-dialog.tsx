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
import { updateSubject } from "@/lib/services/academic";
import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";

export function EditSubjectDialog({
	subjectData,
	onSuccess,
}: {
	subjectData: any;
	onSuccess: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setLoading(true);
		const formData = new FormData(e.currentTarget);

		try {
			await updateSubject(subjectData.id, {
				name: formData.get("name") as string,
				code: formData.get("code") as string,
			});
			setOpen(false);
			onSuccess();
		} catch (error) {
			console.error(error);
			alert("Failed to update subject");
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
					className="h-8 w-8 text-zinc-400 hover:text-emerald-400"
				>
					<Pencil className="h-4 w-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-white">
				<DialogHeader>
					<DialogTitle>Edit Subject</DialogTitle>
					<DialogDescription className="text-zinc-400">
						Update subject name and code.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="name">Subject Name</Label>
						<Input
							id="name"
							name="name"
							defaultValue={subjectData.name}
							placeholder="e.g. Mathematics"
							className="bg-zinc-950 border-zinc-700"
							required
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="code">Subject Code</Label>
						<Input
							id="code"
							name="code"
							defaultValue={subjectData.code}
							placeholder="e.g. MTK-X"
							className="bg-zinc-950 border-zinc-700"
							required
						/>
					</div>
					<DialogFooter>
						<Button
							type="submit"
							disabled={loading}
							className="bg-emerald-600 hover:bg-emerald-500"
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
