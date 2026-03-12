"use client";

import { useCallback, useEffect, useState } from "react";
import { recordBulkAttendance } from "@/lib/services/attendance";
import type { BulkAttendance } from "@/lib/validations/schemas";

// Temporary stub since these are missing in attendance.ts
type AttendanceSummary = {
  present: number;
  sick: number;
  permission: number;
  alpha: number;
};

/**
 * Hook to record bulk attendance
 */
export function useRecordAttendance() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (data: BulkAttendance) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await recordBulkAttendance(data);
      if (!result.success) {
        setError(result.message || "Failed to submit");
        return false;
      }
      return true;
    } catch {
      setError("System error");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submit, isSubmitting, error };
}

/**
 * Hook to fetch attendance summary
 */
export function useAttendanceSummary(_classId: string, _date: string) {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, _setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    // Stub implementation
    setSummary({ present: 0, sick: 0, permission: 0, alpha: 0 });
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, refetch: fetchSummary };
}
