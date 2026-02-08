"use client";

import {
	deleteTeacher as deleteTeacherService,
	getTeachers,
} from "@/lib/services/teacher";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface Teacher {
	id: string;
	fullName: string;
	email: string;
	role: "admin" | "teacher" | "staff";
}

export function useTeacherList() {
	// --- URL STATE (nuqs) ---
	const [search, setSearch] = useQueryState(
		"q",
		parseAsString.withDefault("").withOptions({ shallow: false }),
	);

	const [roleFilter, setRoleFilter] = useQueryState(
		"role",
		parseAsStringEnum(["admin", "teacher", "staff"]).withOptions({
			shallow: false,
		}),
	);

	const [sortBy, setSortBy] = useQueryState(
		"sortBy",
		parseAsStringEnum(["fullName", "email", "createdAt"])
			.withDefault("fullName")
			.withOptions({ shallow: false }),
	);

	const [sortOrder, setSortOrder] = useQueryState(
		"sortOrder",
		parseAsStringEnum(["asc", "desc"])
			.withDefault("asc")
			.withOptions({ shallow: false }),
	);

	// --- LOCAL STATE ---
	const [teachers, setTeachers] = useState<Teacher[]>([]);
	const [loading, setLoading] = useState(true);

	// Dialog States
	const [editOpen, setEditOpen] = useState(false);
	const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);

	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteTeacher, setDeleteTeacher] = useState<Teacher | null>(null);

	// --- FETCH DATA ---
	const fetchTeachers = useCallback(async () => {
		setLoading(true);
		try {
			const data = await getTeachers({
				search: search || undefined,
				role: roleFilter || undefined,
				sortBy: sortBy as "fullName" | "email" | "createdAt",
				sortOrder: sortOrder as "asc" | "desc",
			});
			setTeachers(data as Teacher[]);
		} catch (error) {
			console.error("Failed to fetch teachers:", error);
			toast.error("Gagal memuat data guru");
		} finally {
			setLoading(false);
		}
	}, [search, roleFilter, sortBy, sortOrder]);

	useEffect(() => {
		fetchTeachers();
	}, [fetchTeachers]);

	// --- HANDLERS ---
	const handleEdit = useCallback((teacher: Teacher) => {
		setEditTeacher(teacher);
		setEditOpen(true);
	}, []);

	const handleDelete = useCallback((teacher: Teacher) => {
		setDeleteTeacher(teacher);
		setDeleteOpen(true);
	}, []);

	const confirmDelete = async () => {
		if (!deleteTeacher) return;

		const success = await deleteTeacherService(deleteTeacher.id);
		if (success) {
			toast.success("Guru berhasil dihapus");
			setDeleteOpen(false);
			fetchTeachers();
		} else {
			toast.error("Gagal menghapus guru");
		}
	};

	const toggleSort = (key: "fullName" | "email" | "createdAt") => {
		if (sortBy === key) {
			setSortOrder(sortOrder === "asc" ? "desc" : "asc");
		} else {
			setSortBy(key);
			setSortOrder("asc");
		}
	};

	return {
		// Data & Loading
		teachers,
		loading,

		// Filters (nuqs)
		search,
		setSearch,
		roleFilter,
		setRoleFilter,
		sortBy,
		sortOrder,
		toggleSort,

		// Dialog state
		editOpen,
		setEditOpen,
		editTeacher,
		deleteOpen,
		setDeleteOpen,
		deleteTeacher,

		// Handlers
		fetchTeachers,
		handleEdit,
		handleDelete,
		confirmDelete,
	};
}
