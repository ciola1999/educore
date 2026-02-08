"use client";

import { getStudents, type Student } from "@/lib/services/student";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function useStudentList() {
	// --- STATE ---
	const [data, setData] = useState<Student[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 10;

	// Sorting State
	const [sortConfig, setSortConfig] = useState<{
		key: keyof Student;
		direction: "asc" | "desc";
	} | null>({ key: "createdAt", direction: "desc" });

	// Dialog States
	const [editOpen, setEditOpen] = useState(false);
	const [editStudent, setEditStudent] = useState<Student | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);

	// --- FETCH DATA ---
	const fetchStudents = useCallback(async () => {
		setLoading(true);
		try {
			const result = await getStudents();
			setData(result);
		} catch (e) {
			console.error("Failed to fetch students:", e);
			toast.error("Gagal memuat data siswa");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchStudents();
	}, [fetchStudents]);

	// --- FILTER & SORTING LOGIC ---
	const filteredData = useMemo(() => {
		// 1. Search Filter
		const result = data.filter((student) => {
			const search = searchQuery.toLowerCase();
			return (
				student.fullName.toLowerCase().includes(search) ||
				student.nis.includes(search) ||
				student.grade.toLowerCase().includes(search)
			);
		});

		// 2. Sorting
		if (sortConfig) {
			result.sort((a, b) => {
				const aVal = a[sortConfig.key];
				const bVal = b[sortConfig.key];

				if (aVal === bVal) return 0;

				if (aVal === null || aVal === undefined) return 1;
				if (bVal === null || bVal === undefined) return -1;

				const comparison = aVal < bVal ? -1 : 1;
				return sortConfig.direction === "asc" ? comparison : -comparison;
			});
		}

		return result;
	}, [data, searchQuery, sortConfig]);

	const totalPages = Math.ceil(filteredData.length / itemsPerPage);
	const paginatedData = filteredData.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage,
	);

	// --- HANDLERS ---
	const handleEdit = useCallback((student: Student) => {
		setEditStudent(student);
		setEditOpen(true);
	}, []);

	const handleDelete = useCallback((student: Student) => {
		setDeleteStudent(student);
		setDeleteOpen(true);
	}, []);

	const handleSearchChange = useCallback((value: string) => {
		setSearchQuery(value);
		setCurrentPage(1);
	}, []);

	const handleSort = useCallback((key: keyof Student) => {
		setSortConfig((current) => {
			if (current?.key === key) {
				if (current.direction === "asc") {
					return { key, direction: "desc" };
				}
				return null; // Reset sort
			}
			return { key, direction: "asc" };
		});
	}, []);

	return {
		// State
		loading,
		searchQuery,
		currentPage,
		totalPages,
		paginatedData,
		totalCount: filteredData.length,
		sortConfig,

		// Dialog State
		editOpen,
		setEditOpen,
		editStudent,
		deleteOpen,
		setDeleteOpen,
		deleteStudent,

		// Handlers
		fetchStudents,
		handleEdit,
		handleDelete,
		handleSearchChange,
		handleSort,
		setCurrentPage,
	};
}
