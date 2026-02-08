"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { eq, or } from "drizzle-orm";
import { Loader2, Plus, School } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { addClass } from "@/lib/services/academic";

// 1. Definisikan Schema Validasi (Zod)
const formSchema = z.object({
	name: z.string().min(2, {
		message: "Nama kelas minimal 2 karakter (contoh: X-RPL-1).",
	}),
	academicYear: z.string().regex(/^\d{4}\/\d{4}$/, {
		message: "Format harus YYYY/YYYY (contoh: 2025/2026).",
	}),
	homeroomTeacherId: z.string().uuid({
		message: "Pilih wali kelas yang valid.",
	}),
});

type FormValues = z.infer<typeof formSchema>;

interface TeacherOption {
	id: string;
	fullName: string;
}

export function AddClassDialog({ onSuccess }: { onSuccess: () => void }) {
	const [open, setOpen] = useState(false);
	const [loadingTeachers, setLoadingTeachers] = useState(false);
	const [teachers, setTeachers] = useState<TeacherOption[]>([]);

	// 2. Setup Form Hook
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			academicYear: "",
			homeroomTeacherId: "",
		},
	});

	// 3. Fetch Data saat Dialog dibuka
	useEffect(() => {
		if (open) {
			const fetchTeachers = async () => {
				setLoadingTeachers(true);
				try {
					const db = await getDb();
					// Select hanya field yang dibutuhkan untuk performa
					const result = await db
						.select({ id: users.id, fullName: users.fullName })
						.from(users)
						.where(or(eq(users.role, "teacher"), eq(users.role, "staff")));

					setTeachers(result as TeacherOption[]);
				} catch (error) {
					console.error("Failed to load teachers", error);
					toast.error("Gagal memuat data guru.");
				} finally {
					setLoadingTeachers(false);
				}
			};

			fetchTeachers();
		}
	}, [open]);

	// 4. Handle Submission
	async function onSubmit(values: FormValues) {
		try {
			await addClass({
				name: values.name,
				academicYear: values.academicYear,
				homeroomTeacherId: values.homeroomTeacherId,
			});

			toast.success("Kelas berhasil dibuat", {
				description: `${values.name} - ${values.academicYear}`,
			});

			form.reset();
			setOpen(false);
			onSuccess();
		} catch (error) {
			console.error(error);
			toast.error("Gagal membuat kelas", {
				description: "Silakan coba lagi atau cek log error.",
			});
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm" className="gap-2">
					<Plus className="h-4 w-4" />
					Tambah Kelas
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<School className="h-5 w-5 text-primary" />
						Tambah Kelas Baru
					</DialogTitle>
					<DialogDescription>
						Buat entitas kelas baru dan tentukan wali kelasnya.
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4 py-4"
					>
						{/* Field: Nama Kelas */}
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Nama Kelas</FormLabel>
									<FormControl>
										<Input placeholder="Contoh: X-RPL-1" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Field: Tahun Ajaran */}
						<FormField
							control={form.control}
							name="academicYear"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Tahun Ajaran</FormLabel>
									<FormControl>
										<Input placeholder="2025/2026" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Field: Wali Kelas */}
						<FormField
							control={form.control}
							name="homeroomTeacherId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Wali Kelas</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
										disabled={loadingTeachers}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue
													placeholder={
														loadingTeachers
															? "Memuat data..."
															: "Pilih Wali Kelas"
													}
												/>
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{teachers.map((teacher) => (
												<SelectItem key={teacher.id} value={teacher.id}>
													{teacher.fullName}
												</SelectItem>
											))}
											{teachers.length === 0 && !loadingTeachers && (
												<div className="p-2 text-sm text-muted-foreground text-center">
													Tidak ada data guru.
												</div>
											)}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button type="submit" disabled={form.formState.isSubmitting}>
								{form.formState.isSubmitting ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Menyimpan...
									</>
								) : (
									"Buat Kelas"
								)}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
