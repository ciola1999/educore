import {
  addAcademicYear,
  addClass,
  addSchedule,
  addSemester,
  addSubject,
  addTeachingAssignment,
  deleteAcademicYear,
  deleteClass,
  deleteSchedule,
  deleteSemester,
  deleteSubject,
  deleteTeachingAssignment,
  getAcademicYears,
  getClasses,
  getSchedules,
  getSemesters,
  getSubjects,
  getTeachingAssignmentScheduleOptions,
  getTeachingAssignments,
  updateAcademicYear,
  updateClass,
  updateSchedule,
  updateSemester,
  updateSubject,
  updateTeachingAssignment,
} from "@/lib/services/academic";
import { getLegacyScheduleAuditReport } from "@/lib/services/legacy-schedule-audit";
import {
  bulkArchiveAlreadyCanonicalLegacySchedules,
  bulkRepairReadyLegacySchedules,
  repairLegacySchedule,
} from "@/lib/services/legacy-schedule-repair";
import {
  apiError,
  apiOk,
  type DesktopApiResponse,
} from "./desktop-route-response";

type DesktopAcademicRouteDeps = {
  ensurePermission: (
    permission: "academic:read" | "academic:write",
  ) => DesktopApiResponse;
};

export async function handleDesktopAcademicRoute(
  url: URL,
  method: string,
  pathSegments: string[],
  body: unknown,
  deps: DesktopAcademicRouteDeps,
): Promise<DesktopApiResponse> {
  if (pathSegments[1] === "classes") {
    if (pathSegments.length === 2) {
      if (method === "GET") {
        const guard = deps.ensurePermission("academic:read");
        if (guard) return guard;
        return apiOk(await getClasses());
      }

      if (method === "POST") {
        const guard = deps.ensurePermission("academic:write");
        if (guard) return guard;
        const result = await addClass(
          body as {
            name: string;
            academicYear: string;
            homeroomTeacherId?: string | null;
          },
        );

        if (!result.success) {
          return apiError(
            result.error,
            result.code === "CLASS_EXISTS"
              ? 409
              : result.code === "VALIDATION_ERROR" ||
                  result.code === "INVALID_HOMEROOM_TEACHER"
                ? 400
                : 500,
            result.code,
          );
        }

        return apiOk({ id: result.id }, 201);
      }
    }

    if (pathSegments.length === 3) {
      const guard = deps.ensurePermission("academic:write");
      if (guard) return guard;
      const id = pathSegments[2];

      if (method === "PATCH") {
        const result = await updateClass(
          id,
          body as {
            name: string;
            academicYear: string;
            homeroomTeacherId?: string | null;
          },
        );

        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "CLASS_EXISTS"
                ? 409
                : result.code === "VALIDATION_ERROR" ||
                    result.code === "INVALID_HOMEROOM_TEACHER"
                  ? 400
                  : 500,
            result.code,
          );
        }

        return apiOk({ updated: true });
      }

      if (method === "DELETE") {
        const result = await deleteClass(id);

        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "CLASS_IN_USE"
                ? 409
                : 500,
            result.code,
          );
        }

        return apiOk({ deleted: true });
      }
    }

    return null;
  }

  if (pathSegments[1] === "academic-years") {
    if (pathSegments.length === 2) {
      if (method === "GET") {
        const guard = deps.ensurePermission("academic:read");
        if (guard) return guard;
        return apiOk(await getAcademicYears());
      }

      if (method === "POST") {
        const guard = deps.ensurePermission("academic:write");
        if (guard) return guard;
        const result = await addAcademicYear(body as never);
        if (!result.success) {
          return apiError(
            result.error,
            result.code === "ACADEMIC_YEAR_EXISTS"
              ? 409
              : result.code === "VALIDATION_ERROR"
                ? 400
                : 500,
            result.code,
          );
        }

        return apiOk({ id: result.id }, 201);
      }
    }

    if (pathSegments.length === 3) {
      const guard = deps.ensurePermission("academic:write");
      if (guard) return guard;
      const id = pathSegments[2];

      if (method === "PATCH") {
        const result = await updateAcademicYear(id, body as never);
        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "ACADEMIC_YEAR_EXISTS"
                ? 409
                : result.code === "ACTIVE_ACADEMIC_YEAR_REQUIRED"
                  ? 409
                  : result.code === "VALIDATION_ERROR"
                    ? 400
                    : 500,
            result.code,
          );
        }

        return apiOk({ updated: true });
      }

      if (method === "DELETE") {
        const result = await deleteAcademicYear(id);
        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "ACADEMIC_YEAR_IN_USE"
                ? 409
                : result.code === "ACTIVE_ACADEMIC_YEAR_REQUIRED"
                  ? 409
                  : 500,
            result.code,
          );
        }

        return apiOk({ deleted: true });
      }
    }

    return null;
  }

  if (pathSegments[1] === "semesters") {
    if (pathSegments.length === 2) {
      if (method === "GET") {
        const guard = deps.ensurePermission("academic:read");
        if (guard) return guard;
        return apiOk(await getSemesters());
      }

      if (method === "POST") {
        const guard = deps.ensurePermission("academic:write");
        if (guard) return guard;
        const result = await addSemester(body as never);
        if (!result.success) {
          return apiError(
            result.error,
            result.code === "SEMESTER_EXISTS"
              ? 409
              : result.code === "VALIDATION_ERROR" ||
                  result.code === "ACADEMIC_YEAR_NOT_FOUND"
                ? 400
                : 500,
            result.code,
          );
        }

        return apiOk({ id: result.id }, 201);
      }
    }

    if (pathSegments.length === 3) {
      const guard = deps.ensurePermission("academic:write");
      if (guard) return guard;
      const id = pathSegments[2];

      if (method === "PATCH") {
        const result = await updateSemester(id, body as never);
        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "SEMESTER_EXISTS"
                ? 409
                : result.code === "ACTIVE_SEMESTER_REQUIRED"
                  ? 409
                  : result.code === "VALIDATION_ERROR" ||
                      result.code === "ACADEMIC_YEAR_NOT_FOUND"
                    ? 400
                    : 500,
            result.code,
          );
        }

        return apiOk({ updated: true });
      }

      if (method === "DELETE") {
        const result = await deleteSemester(id);
        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "SEMESTER_IN_USE"
                ? 409
                : result.code === "ACTIVE_SEMESTER_REQUIRED"
                  ? 409
                  : 500,
            result.code,
          );
        }

        return apiOk({ deleted: true });
      }
    }

    return null;
  }

  if (pathSegments[1] === "subjects") {
    if (pathSegments.length === 2) {
      if (method === "GET") {
        const guard = deps.ensurePermission("academic:read");
        if (guard) return guard;
        return apiOk(await getSubjects());
      }

      if (method === "POST") {
        const guard = deps.ensurePermission("academic:write");
        if (guard) return guard;
        const result = await addSubject(body as { name: string; code: string });

        if (!result.success) {
          return apiError(
            result.error,
            result.code === "SUBJECT_CODE_EXISTS"
              ? 409
              : result.code === "VALIDATION_ERROR"
                ? 400
                : 500,
            result.code,
          );
        }

        return apiOk({ created: true }, 201);
      }
    }

    if (pathSegments.length === 3) {
      const guard = deps.ensurePermission("academic:write");
      if (guard) return guard;
      const id = pathSegments[2];

      if (method === "PATCH") {
        const result = await updateSubject(
          id,
          body as { name: string; code: string },
        );

        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "SUBJECT_CODE_EXISTS"
                ? 409
                : result.code === "VALIDATION_ERROR"
                  ? 400
                  : 500,
            result.code,
          );
        }

        return apiOk({ updated: true });
      }

      if (method === "DELETE") {
        const result = await deleteSubject(id);

        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "SUBJECT_IN_USE"
                ? 409
                : 500,
            result.code,
          );
        }

        return apiOk({ deleted: true });
      }
    }

    return null;
  }

  if (pathSegments[1] === "teaching-assignments") {
    if (
      pathSegments.length === 3 &&
      pathSegments[2] === "schedule-legacy-repair" &&
      method === "POST"
    ) {
      const guard = deps.ensurePermission("academic:write");
      if (guard) return guard;

      const payload = body as {
        mode?: string;
        legacyScheduleId?: string;
        guruMapelId?: string;
        limit?: number;
      };

      if (payload.mode === "ready_to_backfill") {
        return apiOk(
          await bulkRepairReadyLegacySchedules({ limit: payload.limit }),
        );
      }

      if (payload.mode === "already_canonical") {
        return apiOk(
          await bulkArchiveAlreadyCanonicalLegacySchedules({
            limit: payload.limit,
          }),
        );
      }

      const result = await repairLegacySchedule(
        payload as {
          legacyScheduleId: string;
          guruMapelId?: string;
        },
      );

      if (!result.success) {
        return apiError(
          result.error,
          result.code === "NOT_FOUND"
            ? 404
            : result.code === "LEGACY_TABLE_RETIRED"
              ? 410
              : result.code === "AMBIGUOUS_ASSIGNMENT"
                ? 409
                : result.code === "MISSING_ASSIGNMENT" ||
                    result.code === "INVALID_ASSIGNMENT_SELECTION"
                  ? 400
                  : 500,
          result.code,
        );
      }

      return apiOk(result);
    }

    if (
      pathSegments.length === 3 &&
      pathSegments[2] === "schedule-legacy-audit" &&
      method === "GET"
    ) {
      const guard = deps.ensurePermission("academic:write");
      if (guard) return guard;

      const status = url.searchParams.get("status") || undefined;
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

      return apiOk(
        await getLegacyScheduleAuditReport({
          status:
            status === "already_canonical" ||
            status === "ready_to_backfill" ||
            status === "ambiguous_assignment" ||
            status === "missing_assignment"
              ? status
              : undefined,
          limit: Number.isFinite(limit) ? limit : undefined,
        }),
      );
    }

    if (pathSegments.length === 2) {
      if (method === "GET") {
        const guard = deps.ensurePermission("academic:read");
        if (guard) return guard;
        if (url.searchParams.get("view") === "schedule-options") {
          return apiOk(await getTeachingAssignmentScheduleOptions());
        }
        return apiOk(await getTeachingAssignments());
      }

      if (method === "POST") {
        const guard = deps.ensurePermission("academic:write");
        if (guard) return guard;
        const result = await addTeachingAssignment(body as never);

        if (!result.success) {
          return apiError(
            result.error,
            result.code === "TEACHING_ASSIGNMENT_EXISTS"
              ? 409
              : result.code === "VALIDATION_ERROR" ||
                  result.code === "INVALID_TEACHER" ||
                  result.code === "SUBJECT_NOT_FOUND" ||
                  result.code === "CLASS_NOT_FOUND" ||
                  result.code === "SEMESTER_NOT_FOUND"
                ? 400
                : 500,
            result.code,
          );
        }

        return apiOk({ id: result.id }, 201);
      }
    }

    if (pathSegments.length === 3) {
      const guard = deps.ensurePermission("academic:write");
      if (guard) return guard;
      const id = pathSegments[2];

      if (method === "PATCH") {
        const result = await updateTeachingAssignment(id, body as never);
        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "TEACHING_ASSIGNMENT_EXISTS"
                ? 409
                : result.code === "VALIDATION_ERROR" ||
                    result.code === "INVALID_TEACHER" ||
                    result.code === "SUBJECT_NOT_FOUND" ||
                    result.code === "CLASS_NOT_FOUND" ||
                    result.code === "SEMESTER_NOT_FOUND"
                  ? 400
                  : 500,
            result.code,
          );
        }

        return apiOk({ updated: true });
      }

      if (method === "DELETE") {
        const result = await deleteTeachingAssignment(id);
        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "TEACHING_ASSIGNMENT_IN_USE"
                ? 409
                : 500,
            result.code,
          );
        }

        return apiOk({ deleted: true });
      }
    }

    return null;
  }

  if (pathSegments[1] === "schedules") {
    if (pathSegments.length === 2) {
      if (method === "GET") {
        const guard = deps.ensurePermission("academic:read");
        if (guard) return guard;
        const hariParam = url.searchParams.get("hari");
        const parsedHari =
          hariParam === null
            ? undefined
            : Number.parseInt(hariParam.trim(), 10);

        if (
          hariParam !== null &&
          (parsedHari === undefined ||
            !Number.isInteger(parsedHari) ||
            parsedHari < 0 ||
            parsedHari > 6)
        ) {
          return apiError("Filter hari tidak valid.", 400, "VALIDATION_ERROR");
        }

        return apiOk(
          await getSchedules({
            hari: parsedHari,
            search: url.searchParams.get("search") || undefined,
          }),
        );
      }

      if (method === "POST") {
        const guard = deps.ensurePermission("academic:write");
        if (guard) return guard;
        const result = await addSchedule(body as never);

        if (!result.success) {
          return apiError(
            result.error,
            result.code === "SCHEDULE_EXISTS" ||
              result.code === "TEACHER_SCHEDULE_CONFLICT" ||
              result.code === "CLASS_SCHEDULE_CONFLICT" ||
              result.code === "ROOM_SCHEDULE_CONFLICT"
              ? 409
              : result.code === "VALIDATION_ERROR" ||
                  result.code === "TEACHING_ASSIGNMENT_NOT_FOUND"
                ? 400
                : 500,
            result.code,
          );
        }

        return apiOk({ id: result.id }, 201);
      }
    }

    if (pathSegments.length === 3) {
      const guard = deps.ensurePermission("academic:write");
      if (guard) return guard;
      const id = pathSegments[2];

      if (method === "PATCH") {
        const result = await updateSchedule(id, body as never);

        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND"
              ? 404
              : result.code === "SCHEDULE_EXISTS" ||
                  result.code === "TEACHER_SCHEDULE_CONFLICT" ||
                  result.code === "CLASS_SCHEDULE_CONFLICT" ||
                  result.code === "ROOM_SCHEDULE_CONFLICT"
                ? 409
                : result.code === "VALIDATION_ERROR" ||
                    result.code === "TEACHING_ASSIGNMENT_NOT_FOUND"
                  ? 400
                  : 500,
            result.code,
          );
        }

        return apiOk({ updated: true });
      }

      if (method === "DELETE") {
        const result = await deleteSchedule(id);

        if (!result.success) {
          return apiError(
            result.error,
            result.code === "NOT_FOUND" ? 404 : 500,
            result.code,
          );
        }

        return apiOk({ deleted: true });
      }
    }

    return null;
  }

  return null;
}
