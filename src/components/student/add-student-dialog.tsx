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
import { students } from "@/lib/db/schema";
import { Loader2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AddStudentDialog() {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) return null;

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setLoading(true);

		const formData = new FormData(e.currentTarget);

		try {
			const db = await getDb();

			// Insert Data sesuai Schema Anda
			await db.insert(students).values({
				id: crypto.randomUUID(), // Generate ID unik
				nis: formData.get("nis") as string,
				fullName: formData.get("fullName") as string,
				gender: formData.get("gender") as "L" | "P", // Casting type
				grade: formData.get("grade") as string,

				// Data Tambahan (Sesuai Schema baru)
				parentName: (formData.get("parentName") as string) || null,
				parentPhone: (formData.get("parentPhone") as string) || null,

				// created_at & updated_at akan otomatis diisi oleh SQLite (default value)
			});

			setOpen(false); // Tutup modal
			router.refresh(); // Refresh data (kalau sudah ada tabel nanti)
			console.log("✅ Siswa berhasil ditambahkan!");
		} catch (error: any) {
			console.error("❌ Gagal simpan:", error);

			const errorMessage = error?.message || String(error);
			if (errorMessage.includes("UNIQUE constraint failed: students.nis")) {
				alert("Gagal: NIS sudah terdaftar!");
			} else {
				alert("Gagal menyimpan data. Cek console.");
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button className="bg-blue-600 hover:bg-blue-500 gap-2 shadow-lg shadow-blue-900/20">
					<UserPlus className="h-4 w-4" /> Add Student
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-800 text-white">
				<DialogHeader>
					<DialogTitle>Add New Student</DialogTitle>
					<DialogDescription className="text-zinc-400">
						Fill in the student's academic and personal details.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="grid gap-4 py-4">
					{/* Section: Academic Info */}
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label htmlFor="nis">NIS (Nomor Induk)</Label>
							<Input
								id="nis"
								name="nis"
								placeholder="e.g. 2024001"
								className="bg-zinc-950 border-zinc-700"
								required
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="grade">Grade / Class</Label>
							<Input
								id="grade"
								name="grade"
								placeholder="e.g. X-RPL-1"
								className="bg-zinc-950 border-zinc-700"
								required
							/>
						</div>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="fullName">Full Name</Label>
						<Input
							id="fullName"
							name="fullName"
							placeholder="Student Full Name"
							className="bg-zinc-950 border-zinc-700"
							required
						/>
					</div>

					<div className="grid gap-2">
						<Label>Gender</Label>
						<Select name="gender" required>
							<SelectTrigger className="bg-zinc-950 border-zinc-700">
								<SelectValue placeholder="Select Gender" />
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

					{/* Section: Parent Info */}
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label htmlFor="parentName">Parent Name</Label>
							<Input
								id="parentName"
								name="parentName"
								placeholder="Father/Mother"
								className="bg-zinc-950 border-zinc-700"
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="parentPhone">Phone Number</Label>
							<Input
								id="parentPhone"
								name="parentPhone"
								type="tel"
								placeholder="0812..."
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
								"Save Record"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
