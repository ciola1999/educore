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
import { addSubject } from "@/lib/services/academic";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";

export function AddSubjectDialog({ onSuccess }: { onSuccess: () => void }) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setLoading(true);
		const formData = new FormData(e.currentTarget);

		try {
			await addSubject({
				name: formData.get("name") as string,
				code: formData.get("code") as string,
			});
			setOpen(false);
			onSuccess();
		} catch (error) {
			console.error(error);
			alert("Failed to add subject");
		} finally {
			setLoading(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button className="bg-emerald-600 hover:bg-emerald-500 gap-2">
					<Plus className="h-4 w-4" /> Add Subject
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-white">
				<DialogHeader>
					<DialogTitle>Add New Subject</DialogTitle>
					<DialogDescription className="text-zinc-400">
						Create a new subject (Mata Pelajaran).
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="name">Subject Name</Label>
						<Input
							id="name"
							name="name"
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
								"Create Subject"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
