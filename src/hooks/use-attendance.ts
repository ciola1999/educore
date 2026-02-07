'use client';

import {
    getAttendanceSummary,
    recordBulkAttendance,
    type AttendanceSummary
} from '@/lib/services/attendance';
import { type BulkAttendance } from '@/lib/validations/schemas';
import { useCallback, useEffect, useState } from 'react';

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
        setError(result.error || 'Failed to submit');
        return false;
      }
      return true;
    } catch (e) {
      setError('System error');
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
export function useAttendanceSummary(classId: string, date: string) {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    if (!classId || !date) return;
    setLoading(true);
    try {
      const data = await getAttendanceSummary(classId, date);
      setSummary(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, refetch: fetchSummary };
}
