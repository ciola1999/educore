"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api/request";

export interface Teacher {
  id: string;
  fullName: string;
  email: string;
  role: "super_admin" | "admin" | "teacher" | "staff";
  nip: string | null;
  jenisKelamin: "L" | "P" | null;
  tempatLahir: string | null;
  tanggalLahir: string | Date | null;
  alamat: string | null;
  noTelepon: string | null;
  isActive: boolean;
  isHomeroomTeacher: boolean;
}

type UseTeacherListOptions = {
  refreshToken?: number;
  search?: string;
  roleFilter?: "super_admin" | "admin" | "teacher" | "staff" | null;
};

export function useTeacherList(options: UseTeacherListOptions = {}) {
  const { refreshToken = 0, search = "", roleFilter = null } = options;
  const lastRefreshTokenRef = useRef(refreshToken);
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dialog States
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTeacher, setDeleteTeacher] = useState<Teacher | null>(null);

  // --- FETCH DATA ---
  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
      });
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter) params.set("role", roleFilter);

      const data = await apiGet<Teacher[]>(
        `/api/teachers?${params.toString()}`,
      );
      setTeachers(data || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal memuat data guru";
      setTeachers([]);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search, sortBy, sortOrder]);

  useEffect(() => {
    void fetchTeachers();
  }, [fetchTeachers]);

  useEffect(() => {
    if (refreshToken === lastRefreshTokenRef.current) {
      return;
    }

    lastRefreshTokenRef.current = refreshToken;
    void fetchTeachers();
  }, [fetchTeachers, refreshToken]);

  // --- HANDLERS ---
  function handleDelete(teacher: Teacher) {
    setDeleteTeacher(teacher);
    setDeleteOpen(true);
  }

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
    errorMessage,

    sortBy,
    sortOrder,
    toggleSort,

    deleteOpen,
    setDeleteOpen,
    deleteTeacher,

    // Handlers
    fetchTeachers,
    handleDelete,
  };
}
