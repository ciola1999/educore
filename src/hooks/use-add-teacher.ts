"use client";

import { addTeacher } from "@/lib/services/teacher";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const addTeacherSchema = z.object({
	fullName: z.string().min(2, "Nama minimal 2 karakter"),
	email: z.string().email("Email tidak valid"),
	role: z.enum(["admin", "teacher", "staff"]),
	password: z
		.string()
		.min(6, "Password minimal 6 karakter")
		.optional()
		.or(z.literal("")),
});

type AddTeacherFormValues = z.infer<typeof addTeacherSchema>;

export function useAddTeacherHook() {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);

	const form = useForm<AddTeacherFormValues>({
		resolver: zodResolver(addTeacherSchema),
		defaultValues: {
			fullName: "",
			email: "",
			role: "teacher",
			password: "",
		},
	});

	const onSubmit = async (values: AddTeacherFormValues) => {
		setLoading(true);

		try {
			// Prepare data for service
			const result = await addTeacher({
				fullName: values.fullName,
				email: values.email,
				role: values.role,
				passwordHash: values.password || undefined, // We'll hash it in the service
			});

			if (result.success) {
				toast.success("Guru berhasil ditambahkan!");
				setOpen(false);
				form.reset();

				// Force refresh to update the list
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			} else {
				if (result.code === "EMAIL_EXISTS") {
					form.setError("email", { message: result.error });
					toast.error("Email sudah terdaftar");
				} else {
					toast.error(result.error);
				}
			}
		} catch (error) {
			console.error("Submit error:", error);
			toast.error("Terjadi kesalahan sistem");
		} finally {
			setLoading(false);
		}
	};

	return {
		open,
		setOpen,
		loading,
		form,
		onSubmit: form.handleSubmit(onSubmit),
	};
}
