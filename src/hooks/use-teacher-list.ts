"use client";

import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { useCallback, useEffect, useState } from "react";
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

export function useTeacherList(refreshToken = 0) {
  // --- URL STATE (nuqs) ---
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ shallow: false }),
  );

  const [roleFilter, setRoleFilter] = useQueryState(
    "role",
    parseAsStringEnum(["super_admin", "admin", "teacher", "staff"]).withOptions(
      {
        shallow: false,
      },
    ),
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
      if (search) params.set("search", search);
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
    if (refreshToken > 0) {
      void fetchTeachers();
    }
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

    // Filters (nuqs)
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
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
