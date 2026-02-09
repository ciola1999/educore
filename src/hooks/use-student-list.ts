"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
// ✅ FIX 1: Sort Imports A-Z (Biome Compliance)
// ✅ FIX 2: Rename 'deleteStudent' -> 'deleteStudentService' (Collision Fix)
import {
	deleteStudent as deleteStudentService,
	getStudents,
	type Student,
} from "@/lib/services/student";

// Helper: Custom Debounce Hook
function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);
	useEffect(() => {
		const handler = setTimeout(() => setDebouncedValue(value), delay);
		return () => clearTimeout(handler);
	}, [value, delay]);
	return debouncedValue;
}

export function useStudentList() {
	// --- STATE ---
	const [data, setData] = useState<Student[]>([]);
	const [loading, setLoading] = useState(true);

	// Pagination & Filter State
	const [searchQuery, setSearchQuery] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [totalCount, setTotalCount] = useState(0);
	const [totalPages, setTotalPages] = useState(1);
	const itemsPerPage = 10;

	// Sorting State
	const [sortConfig, setSortConfig] = useState<{
		key: keyof Student;
		direction: "asc" | "desc";
	}>({ key: "updatedAt", direction: "desc" });

	const debouncedSearch = useDebounce(searchQuery, 500);

	// Dialog States
	const [editOpen, setEditOpen] = useState(false);
	const [editStudent, setEditStudent] = useState<Student | null>(null);
	const [deleteOpen, setDeleteOpen] = useState(false);
	// State ini namanya 'deleteStudent' (Objek), bukan fungsi
	const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);

	// --- FETCH DATA ---
	const fetchStudents = useCallback(async () => {
		setLoading(true);
		try {
			const result = await getStudents({
				page: currentPage,
				limit: itemsPerPage,
				search: debouncedSearch,
				sortBy: sortConfig.key,
				sortDir: sortConfig.direction,
			});

			setData(result.data);
			setTotalCount(result.total);
			setTotalPages(result.totalPages);
		} catch (e) {
			console.error("Failed to fetch students:", e);
			toast.error("Gagal memuat data siswa");
		} finally {
			setLoading(false);
		}
	}, [currentPage, debouncedSearch, sortConfig]);

	// Trigger fetch saat dependencies berubah
	useEffect(() => {
		fetchStudents();
	}, [fetchStudents]);

	// --- HANDLERS ---

	// ✅ FIX 3: Pindahkan reset page ke sini (Hapus useEffect berlebih)
	const handleSearchChange = useCallback((value: string) => {
		setSearchQuery(value);
		setCurrentPage(1); // Reset ke halaman 1 saat mengetik
	}, []);

	const handleEdit = useCallback((student: Student) => {
		setEditStudent(student);
		setEditOpen(true);
	}, []);

	const handleDelete = useCallback((student: Student) => {
		setDeleteStudent(student);
		setDeleteOpen(true);
	}, []);

	const onEditSuccess = useCallback(() => {
		setEditOpen(false);
		toast.success("Data siswa berhasil diperbarui");
		fetchStudents();
	}, [fetchStudents]);

	const onDeleteSuccess = useCallback(async () => {
		// deleteStudent di sini adalah STATE (Objek Student)
		if (deleteStudent) {
			try {
				// ✅ FIX 4: Panggil 'deleteStudentService' (Fungsi API)
				await deleteStudentService(deleteStudent.id);

				setDeleteOpen(false);
				setDeleteStudent(null); // Cleanup state
				toast.success("Siswa berhasil dihapus");

				// Cek jika halaman kosong setelah delete, mundur 1 halaman
				if (data.length === 1 && currentPage > 1) {
					setCurrentPage((p) => p - 1);
				} else {
					fetchStudents();
				}
			} catch (e) {
				console.error(e);
				toast.error("Gagal menghapus siswa");
			}
		}
	}, [deleteStudent, fetchStudents, currentPage, data.length]);

	const handleSort = useCallback((key: keyof Student) => {
		setSortConfig((current) => ({
			key,
			direction:
				current.key === key && current.direction === "asc" ? "desc" : "asc",
		}));
	}, []);

	const [idCardOpen, setIdCardOpen] = useState(false);
	const [selectedStudentForCard, setSelectedStudentForCard] =
		useState<Student | null>(null);

	// Tambahkan Handler
	const handleShowIdCard = useCallback((student: Student) => {
		setSelectedStudentForCard(student);
		setIdCardOpen(true);
	}, []);

	return {
		loading,
		searchQuery,
		currentPage,
		totalPages,
		paginatedData: data,
		totalCount,
		sortConfig,
		editOpen,
		setEditOpen,
		editStudent,
		deleteOpen,
		setDeleteOpen,
		deleteStudent,
		fetchStudents,
		handleEdit,
		onEditSuccess,
		handleDelete,
		onDeleteSuccess,
		handleSearchChange,
		handleSort,
		setCurrentPage,
		idCardOpen,
		setIdCardOpen,
		selectedStudentForCard,
		handleShowIdCard,
	};
}
