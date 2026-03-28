"use client";

import { AlertTriangle, BellRing } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { apiGet, apiPatch } from "@/lib/api/request";
import { exportRowsToXlsx } from "@/lib/export/xlsx";
import { ensureAppWarmup, scheduleIdleTask } from "@/lib/runtime/app-bootstrap";
import { outlineButtonStyles } from "@/lib/ui/outline-button-styles";

type RiskNotification = {
  id: string;
  judul: string;
  pesan: string;
  link: string | null;
  isRead: boolean;
  createdAt: string | Date;
  className: string | null;
  note: string | null;
  deadline: string | null;
  riskFlags: string[];
};

type RiskStudent = {
  studentId: string;
  studentName: string;
  nis: string;
  className: string;
  attendanceRate: number;
  absent: number;
  late: number;
  riskFlags: string[];
};

type RiskInsightsResponse = {
  settings: {
    alphaThreshold: number;
    lateThreshold: number;
    rateThreshold: number;
  };
  students: RiskStudent[];
  notifications: RiskNotification[];
  notificationSummary: {
    total: number;
    pending: number;
    done: number;
  };
  assignmentSummary: Array<{
    userId: string;
    assigneeName: string;
    total: number;
    pending: number;
    done: number;
    overdue: number;
  }>;
  className: string | null;
  assigneeUserId: string | null;
  period: {
    startDate: string;
    endDate: string;
  };
  meta?: {
    includeStudents?: boolean;
    includeAssignmentSummary?: boolean;
  };
};

type FollowUpAuditItem = {
  id: string;
  judul: string;
  pesan: string;
  createdAt: string | Date;
  link: string | null;
};

type ClassOption = {
  id: string;
  name: string;
};

type AssigneeOption = {
  id: string;
  fullName: string;
  role: "teacher" | "staff" | "admin" | "super_admin";
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toFileNameSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildRiskInsightsExportScopeSuffix({
  periodFilter,
  classFilter,
  assigneeFilter,
  notificationFilter,
}: {
  periodFilter: "7d" | "30d" | "month";
  classFilter: string;
  assigneeFilter: string;
  notificationFilter?: "all" | "pending" | "done" | "overdue" | "dueToday";
}) {
  const parts = [
    `period-${periodFilter}`,
    `class-${toFileNameSegment(classFilter === "all" ? "all" : classFilter) || "all"}`,
    `assignee-${toFileNameSegment(assigneeFilter === "all" ? "all" : assigneeFilter) || "all"}`,
  ];

  if (notificationFilter) {
    parts.push(`status-${notificationFilter}`);
  }

  return parts.join("-");
}

function createPrintTarget() {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (popup) {
    return {
      document: popup.document,
      printWindow: popup,
      cleanup: () => {},
    };
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const printWindow = iframe.contentWindow;
  if (!printWindow) {
    iframe.remove();
    return null;
  }

  return {
    document: printWindow.document,
    printWindow,
    cleanup: () => {
      window.setTimeout(() => {
        iframe.remove();
      }, 1500);
    },
  };
}

function getPeriodLabel(period: "7d" | "30d" | "month") {
  if (period === "7d") {
    return "7 Hari";
  }

  if (period === "30d") {
    return "30 Hari";
  }

  return "Bulan Ini";
}

const dashboardPanelClass =
  "overflow-hidden border-zinc-800 bg-zinc-900 text-white shadow-[0_24px_60px_-48px_rgba(15,23,42,0.85)]";
const dashboardInsetCardClass =
  "rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3";
const dashboardToolbarPanelClass =
  "rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3";
const dashboardOutlineButtonClass = outlineButtonStyles.neutral;
const dashboardSkyOutlineButtonClass = outlineButtonStyles.sky;
const dashboardEmeraldOutlineButtonClass = outlineButtonStyles.emerald;
const dashboardVioletOutlineButtonClass = outlineButtonStyles.violet;
const dashboardAmberOutlineButtonClass = outlineButtonStyles.amber;
const RISK_INSIGHTS_TIMEOUT_MS = 45_000;

export function AttendanceRiskInsights() {
  const { user } = useAuth();
  const storageScope = user?.id?.trim() || "anonymous";
  const dashboardFilterStorageKey = `attendance-risk-dashboard-filters:${storageScope}`;
  const dashboardUiStateStorageKey = `attendance-risk-dashboard-ui:${storageScope}`;
  const overdueBannerStorageKey = `attendance-risk-last-overdue-count:${storageScope}`;
  const [data, setData] = useState<RiskInsightsResponse | null>(null);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [agingFilter, setAgingFilter] = useState<"all" | "0-3" | "4-7" | "8+">(
    "all",
  );
  const [periodFilter, setPeriodFilter] = useState<"7d" | "30d" | "month">(
    "30d",
  );
  const [sortBy, setSortBy] = useState<"latest" | "deadline" | "overdue">(
    "latest",
  );
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [editingDeadline, setEditingDeadline] = useState("");
  const [editingAssigneeId, setEditingAssigneeId] = useState("keep");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [auditLoadingId, setAuditLoadingId] = useState<string | null>(null);
  const [auditOpenId, setAuditOpenId] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<
    Record<string, FollowUpAuditItem[]>
  >({});
  const [classFilter, setClassFilter] = useState("all");
  const [bulkMarkingDone, setBulkMarkingDone] = useState(false);
  const [bulkDeadline, setBulkDeadline] = useState("");
  const [bulkSavingDeadline, setBulkSavingDeadline] = useState(false);
  const [bulkAssigneeId, setBulkAssigneeId] = useState("none");
  const [bulkReassigning, setBulkReassigning] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [exportingAssignmentSummary, setExportingAssignmentSummary] =
    useState(false);
  const [exportingKpi, setExportingKpi] = useState(false);
  const [exportingAnalytics, setExportingAnalytics] = useState(false);
  const [exportingCompare, setExportingCompare] = useState(false);
  const [exportingClassSummary, setExportingClassSummary] = useState(false);
  const [exportingDashboardPack, setExportingDashboardPack] = useState(false);
  const [exportingClassLeaderboard, setExportingClassLeaderboard] =
    useState(false);
  const [printingDashboard, setPrintingDashboard] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<
    "all" | "pending" | "done" | "overdue" | "dueToday"
  >("all");
  const [showOverdueBanner, setShowOverdueBanner] = useState(false);
  const [hideReminderCards, setHideReminderCards] = useState(false);
  const [compareAssigneeA, setCompareAssigneeA] = useState("none");
  const [compareAssigneeB, setCompareAssigneeB] = useState("none");

  const buildRiskInsightsQueryString = useCallback(
    (options?: {
      includeStudents?: boolean;
      includeAssignmentSummary?: boolean;
    }) => {
      const params = new URLSearchParams();
      if (classFilter !== "all") {
        params.set("className", classFilter);
      }
      if (assigneeFilter !== "all") {
        params.set("assigneeUserId", assigneeFilter);
      }

      if (options?.includeStudents === false) {
        params.set("includeStudents", "0");
      }
      if (options?.includeAssignmentSummary === false) {
        params.set("includeAssignmentSummary", "0");
      }

      return params.size > 0 ? `?${params.toString()}` : "";
    },
    [assigneeFilter, classFilter],
  );

  const refreshRiskInsights = useCallback(
    async (options?: {
      includeStudents?: boolean;
      includeAssignmentSummary?: boolean;
    }) => {
      await ensureAppWarmup();
      const queryString = buildRiskInsightsQueryString(options);

      try {
        const nextData = await apiGet<RiskInsightsResponse>(
          `/api/attendance/risk-insights${queryString}`,
          { timeoutMs: RISK_INSIGHTS_TIMEOUT_MS },
        );
        setData(nextData);
        return nextData;
      } catch {
        setData(null);
        return null;
      }
    },
    [buildRiskInsightsQueryString],
  );

  function invalidateAuditTrail(notificationIds: string[]) {
    if (notificationIds.length === 0) {
      return;
    }

    const notificationIdSet = new Set(notificationIds);
    setAuditTrail((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([notificationId]) => !notificationIdSet.has(notificationId),
        ),
      ),
    );
    setAuditLoadingId((current) =>
      current && notificationIdSet.has(current) ? null : current,
    );
    setAuditOpenId((current) =>
      current && notificationIdSet.has(current) ? null : current,
    );
  }

  useEffect(() => {
    const cancel = scheduleIdleTask(() => {
      void refreshRiskInsights({
        includeStudents: false,
        includeAssignmentSummary: false,
      })
        .then((baseData) => {
          setData(baseData);
          setLoading(false);
          setDetailsLoading(true);

          return refreshRiskInsights()
            .then((fullData) => {
              setData(fullData);
            })
            .catch(() => undefined)
            .finally(() => {
              setDetailsLoading(false);
            });
        })
        .catch(() => {
          setData(null);
          setLoading(false);
          setDetailsLoading(false);
        });
    }, 250);

    return cancel;
  }, [refreshRiskInsights]);

  useEffect(() => {
    void apiGet<ClassOption[]>("/api/attendance/classes")
      .then((response) => {
        setClassOptions(response);
      })
      .catch(() => {
        setClassOptions([]);
      });
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(dashboardFilterStorageKey);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as Partial<{
        classFilter: string;
        assigneeFilter: string;
        agingFilter: "all" | "0-3" | "4-7" | "8+";
        periodFilter: "7d" | "30d" | "month";
        notificationFilter: "all" | "pending" | "done" | "overdue" | "dueToday";
        sortBy: "latest" | "deadline" | "overdue";
        compareAssigneeA: string;
        compareAssigneeB: string;
      }>;

      if (parsed.classFilter) setClassFilter(parsed.classFilter);
      if (parsed.assigneeFilter) setAssigneeFilter(parsed.assigneeFilter);
      if (parsed.agingFilter) setAgingFilter(parsed.agingFilter);
      if (parsed.periodFilter) setPeriodFilter(parsed.periodFilter);
      if (parsed.notificationFilter) {
        setNotificationFilter(parsed.notificationFilter);
      }
      if (parsed.sortBy) setSortBy(parsed.sortBy);
      if (parsed.compareAssigneeA) setCompareAssigneeA(parsed.compareAssigneeA);
      if (parsed.compareAssigneeB) setCompareAssigneeB(parsed.compareAssigneeB);
    } catch {
      // Ignore invalid persisted filters.
    }
  }, [dashboardFilterStorageKey]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(dashboardUiStateStorageKey);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as Partial<{
        hideReminderCards: boolean;
        dismissOverdueBannerForCount: number;
        searchQuery: string;
        visibleCount: number;
      }>;

      if (parsed.hideReminderCards) {
        setHideReminderCards(true);
      }
      if (parsed.searchQuery) {
        setSearchQuery(parsed.searchQuery);
      }
      if (
        typeof parsed.visibleCount === "number" &&
        Number.isFinite(parsed.visibleCount) &&
        parsed.visibleCount >= 10
      ) {
        setVisibleCount(parsed.visibleCount);
      }

      const dismissedOverdueCount = parsed.dismissOverdueBannerForCount ?? -1;
      const currentOverdueCount = Number(
        window.localStorage.getItem(overdueBannerStorageKey) || "0",
      );
      if (
        dismissedOverdueCount >= 0 &&
        currentOverdueCount <= dismissedOverdueCount
      ) {
        setShowOverdueBanner(false);
      }
    } catch {
      // Ignore invalid persisted UI state.
    }
  }, [dashboardUiStateStorageKey, overdueBannerStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(
      dashboardFilterStorageKey,
      JSON.stringify({
        classFilter,
        assigneeFilter,
        agingFilter,
        periodFilter,
        notificationFilter,
        sortBy,
        compareAssigneeA,
        compareAssigneeB,
      }),
    );
  }, [
    agingFilter,
    assigneeFilter,
    classFilter,
    compareAssigneeA,
    compareAssigneeB,
    dashboardFilterStorageKey,
    notificationFilter,
    periodFilter,
    sortBy,
  ]);

  useEffect(() => {
    try {
      const current = JSON.parse(
        window.localStorage.getItem(dashboardUiStateStorageKey) || "{}",
      ) as Partial<{
        hideReminderCards: boolean;
        dismissOverdueBannerForCount: number;
        searchQuery: string;
        visibleCount: number;
      }>;

      window.localStorage.setItem(
        dashboardUiStateStorageKey,
        JSON.stringify({
          ...current,
          hideReminderCards,
          searchQuery,
          visibleCount,
        }),
      );
    } catch {
      window.localStorage.setItem(
        dashboardUiStateStorageKey,
        JSON.stringify({
          hideReminderCards,
          searchQuery,
          visibleCount,
        }),
      );
    }
  }, [
    dashboardUiStateStorageKey,
    hideReminderCards,
    searchQuery,
    visibleCount,
  ]);

  useEffect(() => {
    if (data?.assignmentSummary.length === 0) {
      return;
    }

    void apiGet<AssigneeOption[]>("/api/teachers?sortBy=fullName&sortOrder=asc")
      .then((response) => {
        setAssigneeOptions(response);
      })
      .catch(() => {
        setAssigneeOptions([]);
      });
  }, [data?.assignmentSummary.length]);

  useEffect(() => {
    if (!data || data.assignmentSummary.length === 0) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const overdueCount = data.notifications.filter(
      (notification) =>
        !notification.isRead &&
        Boolean(notification.deadline) &&
        (notification.deadline ?? "") < today,
    ).length;

    const previous = Number(
      window.localStorage.getItem(overdueBannerStorageKey) || "0",
    );
    if (overdueCount > previous && overdueCount > 0) {
      setShowOverdueBanner(true);
    }
    window.localStorage.setItem(overdueBannerStorageKey, String(overdueCount));
  }, [data, overdueBannerStorageKey]);

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((item) => (
          <div
            key={item}
            className="overflow-hidden rounded-[1.75rem] border border-zinc-800 bg-zinc-900 p-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.85)]"
          >
            <div className="h-3 w-24 animate-pulse rounded-full bg-zinc-800" />
            <div className="mt-4 h-7 w-48 animate-pulse rounded bg-zinc-800/90" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-zinc-800/70" />
            <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-zinc-800/70" />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((skeleton) => (
                <div
                  key={`${item}-${skeleton}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4"
                >
                  <div className="h-3 w-20 animate-pulse rounded bg-zinc-800" />
                  <div className="mt-4 h-6 w-16 animate-pulse rounded bg-zinc-800/90" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded bg-zinc-800/70" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const stagedDetailsPending =
    detailsLoading ||
    data.meta?.includeStudents === false ||
    data.meta?.includeAssignmentSummary === false;
  const today = new Date().toISOString().slice(0, 10);
  const periodNotifications = data.notifications.filter((notification) => {
    const createdDate = new Date(notification.createdAt);
    const createdKey = createdDate.toISOString().slice(0, 10);
    if (periodFilter === "7d") {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return createdDate >= start;
    }

    if (periodFilter === "30d") {
      const start = new Date();
      start.setDate(start.getDate() - 29);
      return createdDate >= start;
    }

    return createdKey.slice(0, 7) === today.slice(0, 7);
  });
  const filteredNotifications = periodNotifications.filter((notification) => {
    const deadline = notification.deadline ?? "";
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const ageDays = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(notification.createdAt).getTime()) /
          (24 * 60 * 60 * 1000),
      ),
    );

    if (
      normalizedSearch &&
      ![notification.judul, notification.pesan, notification.className || ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    ) {
      return false;
    }

    if (notificationFilter === "pending") {
      return !notification.isRead;
    }

    if (notificationFilter === "done") {
      return notification.isRead;
    }

    if (notificationFilter === "overdue") {
      return !notification.isRead && Boolean(deadline) && deadline < today;
    }

    if (notificationFilter === "dueToday") {
      return !notification.isRead && deadline === today;
    }

    if (agingFilter === "0-3" && (notification.isRead || ageDays > 3)) {
      return false;
    }

    if (
      agingFilter === "4-7" &&
      (notification.isRead || ageDays < 4 || ageDays > 7)
    ) {
      return false;
    }

    if (agingFilter === "8+" && (notification.isRead || ageDays < 8)) {
      return false;
    }

    return true;
  });
  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    const deadlineA = a.deadline || "9999-12-31";
    const deadlineB = b.deadline || "9999-12-31";

    if (sortBy === "deadline") {
      return (
        deadlineA.localeCompare(deadlineB) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    if (sortBy === "overdue") {
      const overdueA = !a.isRead && Boolean(a.deadline) && deadlineA < today;
      const overdueB = !b.isRead && Boolean(b.deadline) && deadlineB < today;
      return (
        Number(overdueB) - Number(overdueA) ||
        deadlineA.localeCompare(deadlineB) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const visibleNotifications = sortedNotifications.slice(0, visibleCount);
  const hasMoreNotifications = filteredNotifications.length > visibleCount;
  const overdueNotifications = filteredNotifications.filter(
    (notification) =>
      !notification.isRead &&
      Boolean(notification.deadline) &&
      (notification.deadline ?? "") < today,
  );
  const visibleNotificationSummary = filteredNotifications.reduce(
    (summary, notification) => {
      summary.total += 1;
      if (notification.isRead) {
        summary.done += 1;
      } else {
        summary.pending += 1;
      }
      return summary;
    },
    { total: 0, pending: 0, done: 0 },
  );
  const topOverdueAssignee =
    data.assignmentSummary.find((item) => item.overdue > 0) ?? null;
  const allNotifications = periodNotifications;
  const weeklyNotifications = allNotifications.filter(
    (notification) =>
      Date.now() - new Date(notification.createdAt).getTime() <=
      7 * 24 * 60 * 60 * 1000,
  );
  const monthlyNotifications = allNotifications.filter(
    (notification) =>
      new Date(notification.createdAt).toISOString().slice(0, 7) ===
      today.slice(0, 7),
  );
  const weeklyCompletionRate =
    weeklyNotifications.length === 0
      ? 0
      : Math.round(
          (weeklyNotifications.filter((item) => item.isRead).length /
            weeklyNotifications.length) *
            100,
        );
  const monthlyCompletionRate =
    monthlyNotifications.length === 0
      ? 0
      : Math.round(
          (monthlyNotifications.filter((item) => item.isRead).length /
            monthlyNotifications.length) *
            100,
        );
  const completedTodayCount = allNotifications.filter(
    (notification) =>
      notification.isRead &&
      new Date(notification.createdAt).toISOString().slice(0, 10) === today,
  ).length;
  const slaBreachCount = allNotifications.filter(
    (notification) =>
      !notification.isRead &&
      Boolean(notification.deadline) &&
      (notification.deadline ?? "") < today,
  ).length;
  const trendBuckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const total = allNotifications.filter(
      (notification) =>
        new Date(notification.createdAt).toISOString().slice(0, 10) === key,
    ).length;
    const completed = allNotifications.filter(
      (notification) =>
        notification.isRead &&
        new Date(notification.createdAt).toISOString().slice(0, 10) === key,
    ).length;

    return {
      date: key,
      label: key.slice(5),
      total,
      completed,
      rate: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  });
  const maxTrendTotal = Math.max(...trendBuckets.map((item) => item.total), 1);
  const topAssigneePerformance = [...data.assignmentSummary]
    .map((item) => ({
      ...item,
      completionRate:
        item.total === 0 ? 0 : Math.round((item.done / item.total) * 100),
    }))
    .sort(
      (a, b) =>
        b.completionRate - a.completionRate ||
        b.done - a.done ||
        a.assigneeName.localeCompare(b.assigneeName),
    )
    .slice(0, 5);
  const recoveryLeaderboard = data.assignmentSummary
    .map((item) => {
      const resolved = item.done;
      const denominator = item.done + item.overdue;
      const recoveryRate =
        denominator === 0 ? 0 : Math.round((resolved / denominator) * 100);

      return {
        ...item,
        recoveryRate,
      };
    })
    .sort(
      (a, b) =>
        b.recoveryRate - a.recoveryRate ||
        b.done - a.done ||
        a.assigneeName.localeCompare(b.assigneeName),
    )
    .slice(0, 5);
  const assignmentSummaryRows = data.assignmentSummary
    .map((item) => ({
      ...item,
      completionRate:
        item.total === 0 ? 0 : Math.round((item.done / item.total) * 100),
    }))
    .sort(
      (a, b) =>
        b.pending - a.pending ||
        b.overdue - a.overdue ||
        a.assigneeName.localeCompare(b.assigneeName),
    );
  const compareAssigneeItemA =
    compareAssigneeA === "none"
      ? null
      : topAssigneePerformance.find(
          (item) => item.userId === compareAssigneeA,
        ) ||
        data.assignmentSummary
          .map((item) => ({
            ...item,
            completionRate:
              item.total === 0 ? 0 : Math.round((item.done / item.total) * 100),
          }))
          .find((item) => item.userId === compareAssigneeA) ||
        null;
  const compareAssigneeItemB =
    compareAssigneeB === "none"
      ? null
      : topAssigneePerformance.find(
          (item) => item.userId === compareAssigneeB,
        ) ||
        data.assignmentSummary
          .map((item) => ({
            ...item,
            completionRate:
              item.total === 0 ? 0 : Math.round((item.done / item.total) * 100),
          }))
          .find((item) => item.userId === compareAssigneeB) ||
        null;
  const agingBuckets = allNotifications.reduce(
    (summary, notification) => {
      if (notification.isRead) {
        return summary;
      }

      const ageDays = Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(notification.createdAt).getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      );

      if (ageDays <= 3) {
        summary.zeroToThree += 1;
      } else if (ageDays <= 7) {
        summary.fourToSeven += 1;
      } else {
        summary.overSeven += 1;
      }

      return summary;
    },
    {
      zeroToThree: 0,
      fourToSeven: 0,
      overSeven: 0,
    },
  );
  const overdueHeatmap = Array.from({ length: 21 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (20 - index));
    const key = date.toISOString().slice(0, 10);
    const total = allNotifications.filter(
      (notification) =>
        !notification.isRead &&
        Boolean(notification.deadline) &&
        (notification.deadline ?? "") < key,
    ).length;

    return {
      date: key,
      label: key.slice(5),
      total,
    };
  });
  const maxOverdueHeat = Math.max(
    ...overdueHeatmap.map((item) => item.total),
    1,
  );
  const classSummary = allNotifications.reduce(
    (summary, notification) => {
      const className = notification.className || "UNASSIGNED";
      const current = summary.get(className) ?? {
        className,
        total: 0,
        pending: 0,
        done: 0,
        overdue: 0,
      };

      current.total += 1;
      if (notification.isRead) {
        current.done += 1;
      } else {
        current.pending += 1;
        if (
          Boolean(notification.deadline) &&
          (notification.deadline ?? "") < today
        ) {
          current.overdue += 1;
        }
      }

      summary.set(className, current);
      return summary;
    },
    new Map<
      string,
      {
        className: string;
        total: number;
        pending: number;
        done: number;
        overdue: number;
      }
    >(),
  );
  const classSummaryRows = [...classSummary.values()].sort(
    (a, b) =>
      b.pending - a.pending ||
      b.overdue - a.overdue ||
      a.className.localeCompare(b.className),
  );
  const classRecoveryLeaderboard = classSummaryRows
    .map((item) => ({
      ...item,
      recoveryRate:
        item.total === 0 ? 0 : Math.round((item.done / item.total) * 100),
    }))
    .sort(
      (a, b) =>
        b.recoveryRate - a.recoveryRate ||
        b.done - a.done ||
        a.className.localeCompare(b.className),
    )
    .slice(0, 5);
  const scheduledReminderSummary = {
    dueToday: allNotifications.filter(
      (notification) =>
        !notification.isRead && (notification.deadline ?? "") === today,
    ).length,
    dueTomorrow: allNotifications.filter((notification) => {
      if (notification.isRead || !notification.deadline) {
        return false;
      }
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return notification.deadline === tomorrow.toISOString().slice(0, 10);
    }).length,
    overdue: slaBreachCount,
  };
  const automaticReminders = [
    overdueNotifications[0]
      ? `Reminder overdue: ${overdueNotifications[0].judul} perlu ditindaklanjuti segera.`
      : null,
    topOverdueAssignee
      ? `Assignee prioritas: ${topOverdueAssignee.assigneeName} memiliki follow-up overdue.`
      : null,
    visibleNotificationSummary.pending >= 5
      ? `Ada ${visibleNotificationSummary.pending} follow-up pending pada filter aktif.`
      : null,
  ].filter(Boolean) as string[];
  const canManageAssignees =
    user?.role === "admin" || user?.role === "super_admin";
  const executiveSnapshot = {
    totalFollowUps: allNotifications.length,
    completionRate:
      allNotifications.length === 0
        ? 0
        : Math.round(
            (allNotifications.filter((item) => item.isRead).length /
              allNotifications.length) *
              100,
          ),
    topClass: classRecoveryLeaderboard[0]?.className || "-",
    topAssignee: topAssigneePerformance[0]?.assigneeName || "-",
    overdue: scheduledReminderSummary.overdue,
    dueToday: scheduledReminderSummary.dueToday,
  };

  async function handleMarkDone(notificationId: string) {
    setMarkingId(notificationId);
    try {
      await apiPatch<{ success: true }>(
        `/api/attendance/risk-followups/${notificationId}`,
      );
      invalidateAuditTrail([notificationId]);
      setData((current) =>
        current
          ? {
              ...current,
              notificationSummary: {
                total: current.notificationSummary.total,
                pending: Math.max(0, current.notificationSummary.pending - 1),
                done: current.notificationSummary.done + 1,
              },
              notifications: current.notifications.map((item) =>
                item.id === notificationId ? { ...item, isRead: true } : item,
              ),
            }
          : current,
      );
    } finally {
      setMarkingId(null);
    }
  }

  async function handleSaveEdit(notificationId: string) {
    setSavingEditId(notificationId);
    try {
      await apiPatch<{ success: true }>(
        `/api/attendance/risk-followups/${notificationId}`,
        {
          note: editingNote.trim() || null,
          deadline: editingDeadline || null,
          assigneeUserId:
            editingAssigneeId !== "keep" ? editingAssigneeId : undefined,
        },
      );

      invalidateAuditTrail([notificationId]);
      setData((current) =>
        current
          ? {
              ...current,
              notifications: current.notifications.map((item) =>
                item.id === notificationId
                  ? {
                      ...item,
                      note: editingNote.trim() || null,
                      deadline: editingDeadline || null,
                      pesan: item.pesan
                        .replace(/\. Deadline: \d{4}-\d{2}-\d{2}/, "")
                        .replace(/\. Catatan: .+$/, "")
                        .concat(
                          editingDeadline
                            ? `. Deadline: ${editingDeadline}`
                            : "",
                        )
                        .concat(
                          editingNote.trim()
                            ? `. Catatan: ${editingNote.trim()}`
                            : "",
                        ),
                    }
                  : item,
              ),
            }
          : current,
      );
      setEditingId(null);
      setEditingNote("");
      setEditingDeadline("");
      setEditingAssigneeId("keep");
    } finally {
      setSavingEditId(null);
    }
  }

  async function handleBulkMarkDone() {
    const pendingIds = filteredNotifications
      .filter((notification) => !notification.isRead)
      .map((notification) => notification.id);

    if (pendingIds.length === 0) {
      return;
    }

    setBulkMarkingDone(true);
    try {
      await Promise.all(
        pendingIds.map((notificationId) =>
          apiPatch<{ success: true }>(
            `/api/attendance/risk-followups/${notificationId}`,
          ),
        ),
      );

      invalidateAuditTrail(pendingIds);
      setData((current) =>
        current
          ? {
              ...current,
              notificationSummary: {
                total: current.notificationSummary.total,
                pending: Math.max(
                  0,
                  current.notificationSummary.pending - pendingIds.length,
                ),
                done: current.notificationSummary.done + pendingIds.length,
              },
              notifications: current.notifications.map((item) =>
                pendingIds.includes(item.id) ? { ...item, isRead: true } : item,
              ),
            }
          : current,
      );
    } finally {
      setBulkMarkingDone(false);
    }
  }

  async function handleExportFollowUpReport() {
    setExportingReport(true);
    try {
      const exportScopeSuffix = buildRiskInsightsExportScopeSuffix({
        periodFilter,
        classFilter,
        assigneeFilter,
        notificationFilter,
      });
      const rows = filteredNotifications.map((notification) => ({
        Judul: notification.judul,
        Kelas: notification.className || "-",
        Status: notification.isRead ? "Selesai" : "Pending",
        Deadline: notification.deadline || "-",
        Overdue:
          !notification.isRead &&
          Boolean(notification.deadline ?? "") &&
          (notification.deadline ?? "") < today
            ? "Ya"
            : "Tidak",
        Catatan: notification.note || "-",
        Risiko:
          notification.riskFlags.length > 0
            ? notification.riskFlags.join(", ")
            : "-",
        Pesan: notification.pesan,
        Dibuat: new Date(notification.createdAt).toLocaleString("id-ID"),
      }));

      if (rows.length === 0) {
        return;
      }

      await exportRowsToXlsx({
        fileName: `attendance-follow-up-report-${exportScopeSuffix}.xlsx`,
        sheetName: "Follow Up",
        rows,
      });
    } finally {
      setExportingReport(false);
    }
  }

  async function handleBulkUpdateDeadline() {
    const pendingIds = filteredNotifications
      .filter((notification) => !notification.isRead)
      .map((notification) => notification.id);

    if (!bulkDeadline || pendingIds.length === 0) {
      return;
    }

    setBulkSavingDeadline(true);
    try {
      await Promise.all(
        pendingIds.map((notificationId) =>
          apiPatch<{ success: true }>(
            `/api/attendance/risk-followups/${notificationId}`,
            { deadline: bulkDeadline },
          ),
        ),
      );

      invalidateAuditTrail(pendingIds);
      setData((current) =>
        current
          ? {
              ...current,
              notifications: current.notifications.map((item) =>
                pendingIds.includes(item.id)
                  ? {
                      ...item,
                      deadline: bulkDeadline,
                      pesan: item.pesan
                        .replace(/\. Deadline: \d{4}-\d{2}-\d{2}/, "")
                        .concat(`. Deadline: ${bulkDeadline}`),
                    }
                  : item,
              ),
            }
          : current,
      );
      setBulkDeadline("");
    } finally {
      setBulkSavingDeadline(false);
    }
  }

  async function handleBulkReassign() {
    const pendingIds = filteredNotifications
      .filter((notification) => !notification.isRead)
      .map((notification) => notification.id);

    if (bulkAssigneeId === "none" || pendingIds.length === 0) {
      return;
    }

    setBulkReassigning(true);
    try {
      await Promise.all(
        pendingIds.map((notificationId) =>
          apiPatch<{ success: true }>(
            `/api/attendance/risk-followups/${notificationId}`,
            { assigneeUserId: bulkAssigneeId },
          ),
        ),
      );
      invalidateAuditTrail(pendingIds);
      setBulkAssigneeId("none");
      await refreshRiskInsights();
    } finally {
      setBulkReassigning(false);
    }
  }

  async function handleExportAssignmentSummary() {
    if (!data?.assignmentSummary.length) {
      return;
    }

    setExportingAssignmentSummary(true);
    try {
      const exportScopeSuffix = buildRiskInsightsExportScopeSuffix({
        periodFilter,
        classFilter,
        assigneeFilter,
      });
      await exportRowsToXlsx({
        fileName: `attendance-follow-up-assignment-summary-${exportScopeSuffix}.xlsx`,
        sheetName: "Assignment Summary",
        rows: data.assignmentSummary.map((item) => ({
          Assignee: item.assigneeName,
          Total: item.total,
          Pending: item.pending,
          Overdue: item.overdue,
          Selesai: item.done,
        })),
      });
    } finally {
      setExportingAssignmentSummary(false);
    }
  }

  async function handleExportKpiDashboard() {
    setExportingKpi(true);
    try {
      const exportScopeSuffix = buildRiskInsightsExportScopeSuffix({
        periodFilter,
        classFilter,
        assigneeFilter,
      });
      await exportRowsToXlsx({
        fileName: `attendance-follow-up-kpi-dashboard-${exportScopeSuffix}.xlsx`,
        sheetName: "Attendance KPI",
        rows: [
          {
            Metric: "Follow-up 7 Hari",
            Value: weeklyNotifications.length,
            Description: "Total follow-up yang dibuat dalam 7 hari terakhir",
          },
          {
            Metric: "Completion Rate 7 Hari",
            Value: `${weeklyCompletionRate}%`,
            Description: "Persentase follow-up 7 hari yang sudah selesai",
          },
          {
            Metric: "Follow-up Bulan Ini",
            Value: monthlyNotifications.length,
            Description: "Total follow-up yang dibuat pada bulan berjalan",
          },
          {
            Metric: "Completion Rate Bulan Ini",
            Value: `${monthlyCompletionRate}%`,
            Description: "Persentase follow-up bulan ini yang sudah selesai",
          },
          {
            Metric: "Completed Today",
            Value: completedTodayCount,
            Description: "Jumlah follow-up yang selesai hari ini",
          },
          {
            Metric: "SLA Breach",
            Value: slaBreachCount,
            Description: "Jumlah follow-up pending yang melewati deadline",
          },
        ],
      });
    } finally {
      setExportingKpi(false);
    }
  }

  async function handleExportAnalytics() {
    setExportingAnalytics(true);
    try {
      const exportScopeSuffix = buildRiskInsightsExportScopeSuffix({
        periodFilter,
        classFilter,
        assigneeFilter,
      });
      const rows = [
        ...trendBuckets.map((item) => ({
          Section: "Trend 7 Hari",
          Label: item.label,
          MetricA: item.total,
          MetricB: item.completed,
          MetricC: `${item.rate}%`,
        })),
        ...topAssigneePerformance.map((item) => ({
          Section: "Top Assignee",
          Label: item.assigneeName,
          MetricA: item.total,
          MetricB: item.done,
          MetricC: `${item.completionRate}%`,
        })),
        {
          Section: "Aging Bucket",
          Label: "0-3 Hari",
          MetricA: agingBuckets.zeroToThree,
          MetricB: "",
          MetricC: "",
        },
        {
          Section: "Aging Bucket",
          Label: "4-7 Hari",
          MetricA: agingBuckets.fourToSeven,
          MetricB: "",
          MetricC: "",
        },
        {
          Section: "Aging Bucket",
          Label: "> 7 Hari",
          MetricA: agingBuckets.overSeven,
          MetricB: "",
          MetricC: "",
        },
      ];

      await exportRowsToXlsx({
        fileName: `attendance-follow-up-analytics-${exportScopeSuffix}.xlsx`,
        sheetName: "Attendance Analytics",
        rows,
      });
    } finally {
      setExportingAnalytics(false);
    }
  }

  async function handleExportCompareAssignee() {
    if (!compareAssigneeItemA || !compareAssigneeItemB) {
      return;
    }

    setExportingCompare(true);
    try {
      const exportScopeSuffix = buildRiskInsightsExportScopeSuffix({
        periodFilter,
        classFilter,
        assigneeFilter,
      });
      await exportRowsToXlsx({
        fileName: `attendance-compare-assignee-${toFileNameSegment(compareAssigneeItemA.assigneeName) || compareAssigneeItemA.userId}-vs-${toFileNameSegment(compareAssigneeItemB.assigneeName) || compareAssigneeItemB.userId}-${exportScopeSuffix}.xlsx`,
        sheetName: "Compare Assignee",
        rows: [compareAssigneeItemA, compareAssigneeItemB].map((item) => ({
          Assignee: item.assigneeName,
          Total: item.total,
          Done: item.done,
          Pending: item.pending,
          Overdue: item.overdue,
          "Completion Rate (%)": item.completionRate,
        })),
      });
    } finally {
      setExportingCompare(false);
    }
  }

  async function handleExportClassSummary() {
    if (classSummaryRows.length === 0) {
      return;
    }

    setExportingClassSummary(true);
    try {
      const exportScopeSuffix = buildRiskInsightsExportScopeSuffix({
        periodFilter,
        classFilter,
        assigneeFilter,
      });
      await exportRowsToXlsx({
        fileName: `attendance-follow-up-class-summary-${exportScopeSuffix}.xlsx`,
        sheetName: "Class Summary",
        rows: classSummaryRows.map((item) => ({
          Kelas: item.className,
          Total: item.total,
          Done: item.done,
          Pending: item.pending,
          Overdue: item.overdue,
          "Recovery Rate (%)":
            item.total === 0 ? 0 : Math.round((item.done / item.total) * 100),
        })),
      });
    } finally {
      setExportingClassSummary(false);
    }
  }

  async function handlePrintDashboardReport() {
    setPrintingDashboard(true);
    try {
      const printTarget = createPrintTarget();
      if (!printTarget) {
        return;
      }

      const safePeriodLabel = escapeHtml(getPeriodLabel(periodFilter));
      const safeClassFilter = escapeHtml(
        classFilter === "all" ? "Semua Kelas" : classFilter,
      );
      const safeAssigneeFilter = escapeHtml(
        assigneeFilter === "all"
          ? "Semua Assignee"
          : assigneeOptions.find((item) => item.id === assigneeFilter)
              ?.fullName || assigneeFilter,
      );
      const assignmentRows = assignmentSummaryRows
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.assigneeName)}</td>
              <td>${item.total}</td>
              <td>${item.pending}</td>
              <td>${item.overdue}</td>
              <td>${item.done}</td>
              <td>${item.completionRate}%</td>
            </tr>
          `,
        )
        .join("");
      const leaderboardRows = classRecoveryLeaderboard
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.className)}</td>
              <td>${item.done}</td>
              <td>${item.pending}</td>
              <td>${item.overdue}</td>
              <td>${item.recoveryRate}%</td>
            </tr>
          `,
        )
        .join("");
      const followUpRows = sortedNotifications
        .map(
          (notification) => `
            <tr>
              <td>${escapeHtml(notification.judul)}</td>
              <td>${escapeHtml(notification.className || "-")}</td>
              <td>${notification.isRead ? "Selesai" : "Pending"}</td>
              <td>${escapeHtml(notification.deadline || "-")}</td>
              <td>${escapeHtml(notification.note || "-")}</td>
              <td>${escapeHtml(
                notification.riskFlags.length > 0
                  ? notification.riskFlags.join(", ")
                  : "-",
              )}</td>
            </tr>
          `,
        )
        .join("");
      const trendRows = trendBuckets
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.label)}</td>
              <td>${item.total}</td>
              <td>${item.completed}</td>
              <td>${item.rate}%</td>
            </tr>
          `,
        )
        .join("");
      const classRows = classSummaryRows
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.className)}</td>
              <td>${item.total}</td>
              <td>${item.done}</td>
              <td>${item.pending}</td>
              <td>${item.overdue}</td>
            </tr>
          `,
        )
        .join("");

      printTarget.document.open();
      printTarget.document.write(`
        <html>
          <head>
            <title>EduCore Attendance Dashboard Report</title>
            <style>
              body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
              h1, h2 { margin: 0 0 8px; }
              .meta { margin-bottom: 16px; color: #4b5563; font-size: 12px; }
              .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
              .card { border: 1px solid #d4d4d8; border-radius: 12px; padding: 12px; }
              table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px; }
              th { background: #f4f4f5; }
            </style>
          </head>
          <body>
            <h1>EduCore Attendance Dashboard Report</h1>
            <div class="meta">
              Periode: ${safePeriodLabel} | Kelas: ${safeClassFilter} | Assignee: ${safeAssigneeFilter}
            </div>
            <div class="meta">
              Filter Notifikasi: ${escapeHtml(notificationFilter)} | Urutan: ${escapeHtml(sortBy)} | Pencarian: ${escapeHtml(searchQuery || "-")}
            </div>
            <div class="grid">
              <div class="card"><strong>Total Follow-up</strong><br/>${executiveSnapshot.totalFollowUps}</div>
              <div class="card"><strong>Completion Rate</strong><br/>${executiveSnapshot.completionRate}%</div>
              <div class="card"><strong>Top Class</strong><br/>${escapeHtml(executiveSnapshot.topClass)}</div>
              <div class="card"><strong>Top Assignee</strong><br/>${escapeHtml(executiveSnapshot.topAssignee)}</div>
              <div class="card"><strong>Overdue</strong><br/>${executiveSnapshot.overdue}</div>
              <div class="card"><strong>Due Today</strong><br/>${executiveSnapshot.dueToday}</div>
            </div>
            <h2>Trend 7 Hari</h2>
            <table>
              <thead>
                <tr><th>Hari</th><th>Total</th><th>Selesai</th><th>Rate</th></tr>
              </thead>
              <tbody>${trendRows}</tbody>
            </table>
            <h2>Summary per Kelas</h2>
            <table>
              <thead>
                <tr><th>Kelas</th><th>Total</th><th>Done</th><th>Pending</th><th>Overdue</th></tr>
              </thead>
              <tbody>${classRows}</tbody>
            </table>
            <h2>Summary per Assignee</h2>
            <table>
              <thead>
                <tr><th>Assignee</th><th>Total</th><th>Pending</th><th>Overdue</th><th>Selesai</th><th>Completion</th></tr>
              </thead>
              <tbody>${assignmentRows}</tbody>
            </table>
            <h2>Leaderboard Recovery per Kelas</h2>
            <table>
              <thead>
                <tr><th>Kelas</th><th>Selesai</th><th>Pending</th><th>Overdue</th><th>Recovery Rate</th></tr>
              </thead>
              <tbody>${leaderboardRows}</tbody>
            </table>
            <h2>Scheduled Reminder Summary</h2>
            <table>
              <thead>
                <tr><th>Due Today</th><th>Due Tomorrow</th><th>Overdue</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>${scheduledReminderSummary.dueToday}</td>
                  <td>${scheduledReminderSummary.dueTomorrow}</td>
                  <td>${scheduledReminderSummary.overdue}</td>
                </tr>
              </tbody>
            </table>
            <h2>Daftar Follow-up Aktif</h2>
            <table>
              <thead>
                <tr><th>Judul</th><th>Kelas</th><th>Status</th><th>Deadline</th><th>Catatan</th><th>Risiko</th></tr>
              </thead>
              <tbody>${followUpRows || '<tr><td colspan="6">Tidak ada follow-up pada filter aktif.</td></tr>'}</tbody>
            </table>
          </body>
        </html>
      `);
      printTarget.document.close();
      printTarget.printWindow.focus();
      printTarget.printWindow.print();
      printTarget.cleanup();
    } finally {
      setPrintingDashboard(false);
    }
  }

  function handleDismissOverdueBanner() {
    setShowOverdueBanner(false);
    try {
      const current = JSON.parse(
        window.localStorage.getItem(dashboardUiStateStorageKey) || "{}",
      ) as Partial<{
        hideReminderCards: boolean;
        dismissOverdueBannerForCount: number;
      }>;

      window.localStorage.setItem(
        dashboardUiStateStorageKey,
        JSON.stringify({
          ...current,
          dismissOverdueBannerForCount: overdueNotifications.length,
        }),
      );
    } catch {
      window.localStorage.setItem(
        dashboardUiStateStorageKey,
        JSON.stringify({
          hideReminderCards,
          dismissOverdueBannerForCount: overdueNotifications.length,
        }),
      );
    }
  }

  function handleToggleReminderCards() {
    setHideReminderCards((current) => !current);
  }

  function handleResetDashboardUiState() {
    setHideReminderCards(false);
    setShowOverdueBanner(false);
    setSearchQuery("");
    setVisibleCount(10);
    setClassFilter("all");
    setAssigneeFilter("all");
    setAgingFilter("all");
    setPeriodFilter("30d");
    setNotificationFilter("all");
    setSortBy("latest");
    setCompareAssigneeA("none");
    setCompareAssigneeB("none");
    window.localStorage.removeItem(dashboardFilterStorageKey);
    window.localStorage.removeItem(dashboardUiStateStorageKey);
    window.localStorage.removeItem(overdueBannerStorageKey);
  }

  async function handleExportClassLeaderboard() {
    if (classRecoveryLeaderboard.length === 0) {
      return;
    }

    setExportingClassLeaderboard(true);
    try {
      const exportScopeSuffix = buildRiskInsightsExportScopeSuffix({
        periodFilter,
        classFilter,
        assigneeFilter,
      });
      await exportRowsToXlsx({
        fileName: `attendance-class-recovery-leaderboard-${exportScopeSuffix}.xlsx`,
        sheetName: "Class Recovery",
        rows: classRecoveryLeaderboard.map((item) => ({
          Kelas: item.className,
          Done: item.done,
          Pending: item.pending,
          Overdue: item.overdue,
          "Recovery Rate (%)": item.recoveryRate,
        })),
      });
    } finally {
      setExportingClassLeaderboard(false);
    }
  }

  async function handleExportDashboardPack() {
    setExportingDashboardPack(true);
    try {
      const exportScopeSuffix = buildRiskInsightsExportScopeSuffix({
        periodFilter,
        classFilter,
        assigneeFilter,
      });
      const rows = [
        {
          Section: "KPI",
          Label: "Completed Today",
          ValueA: completedTodayCount,
          ValueB: "",
          ValueC: "",
        },
        {
          Section: "KPI",
          Label: "SLA Breach",
          ValueA: slaBreachCount,
          ValueB: "",
          ValueC: "",
        },
        {
          Section: "KPI",
          Label: "Completion Rate 7 Hari",
          ValueA: `${weeklyCompletionRate}%`,
          ValueB: weeklyNotifications.length,
          ValueC: "",
        },
        {
          Section: "KPI",
          Label: "Completion Rate Bulan Ini",
          ValueA: `${monthlyCompletionRate}%`,
          ValueB: monthlyNotifications.length,
          ValueC: "",
        },
        ...trendBuckets.map((item) => ({
          Section: "Trend",
          Label: item.label,
          ValueA: item.total,
          ValueB: item.completed,
          ValueC: `${item.rate}%`,
        })),
        ...classSummaryRows.map((item) => ({
          Section: "Class Summary",
          Label: item.className,
          ValueA: item.total,
          ValueB: item.done,
          ValueC: `${item.overdue} overdue`,
        })),
        ...classRecoveryLeaderboard.map((item) => ({
          Section: "Class Recovery",
          Label: item.className,
          ValueA: item.done,
          ValueB: item.pending,
          ValueC: `${item.recoveryRate}%`,
        })),
      ];

      await exportRowsToXlsx({
        fileName: `attendance-dashboard-pack-${exportScopeSuffix}.xlsx`,
        sheetName: "Dashboard Pack",
        rows,
      });
    } finally {
      setExportingDashboardPack(false);
    }
  }

  async function handleExportAuditTrail(
    notification: RiskNotification,
    rows: FollowUpAuditItem[],
  ) {
    if (rows.length === 0) {
      return;
    }

    const exportScopeSuffix = buildRiskInsightsExportScopeSuffix({
      periodFilter,
      classFilter,
      assigneeFilter,
    });
    await exportRowsToXlsx({
      fileName: `attendance-follow-up-audit-${toFileNameSegment(notification.className || "unassigned") || "unassigned"}-${notification.id}-${exportScopeSuffix}.xlsx`,
      sheetName: "Follow Up Audit",
      rows: rows.map((item) => ({
        FollowUp: notification.judul,
        Kelas: notification.className || "-",
        Detail: item.pesan,
        Waktu: new Date(item.createdAt).toLocaleString("id-ID"),
      })),
    });
  }

  async function handleToggleAudit(notificationId: string) {
    if (auditOpenId === notificationId) {
      setAuditOpenId(null);
      return;
    }

    setAuditOpenId(notificationId);
    if (auditTrail[notificationId]) {
      return;
    }

    setAuditLoadingId(notificationId);
    try {
      const rows = await apiGet<FollowUpAuditItem[]>(
        `/api/attendance/risk-followups/${notificationId}/history`,
      );
      setAuditTrail((current) => ({ ...current, [notificationId]: rows }));
    } finally {
      setAuditLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {stagedDetailsPending ? (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-sm text-sky-100">
          Detail ranking siswa dan assignment follow-up sedang dimuat bertahap
          untuk menghindari timeout saat cold-start pertama.
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.2fr]">
        <Card className={dashboardPanelClass}>
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Attendance Risk
            </CardTitle>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 font-semibold uppercase tracking-[0.16em] text-red-200">
                Period Active
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-950/70 px-2.5 py-1 text-zinc-400">
                {data.period.startDate} s/d {data.period.endDate}
              </span>
            </div>
            <p className="text-sm leading-6 text-zinc-400">
              Prioritas siswa berisiko yang perlu ditindaklanjuti berdasarkan
              kelas dan assignee aktif.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={dashboardToolbarPanelClass}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Filter Kelas
                </p>
                <Select
                  value={classFilter}
                  onValueChange={(value) => {
                    setClassFilter(value);
                    setVisibleCount(10);
                  }}
                >
                  <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-200">
                    <SelectValue placeholder="Semua kelas" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                    <SelectItem value="all">Semua Kelas</SelectItem>
                    {classOptions.map((item) => (
                      <SelectItem key={item.id} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={dashboardToolbarPanelClass}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Filter Assignee
                </p>
                <Select
                  value={assigneeFilter}
                  onValueChange={(value) => {
                    setAssigneeFilter(value);
                    setVisibleCount(10);
                  }}
                >
                  <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-200">
                    <SelectValue placeholder="Semua assignee" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                    <SelectItem value="all">Semua Assignee</SelectItem>
                    {data.assignmentSummary.map((item) => (
                      <SelectItem key={item.userId} value={item.userId}>
                        {item.assigneeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {data.students.length > 0 ? (
              <div className="grid gap-3">
                {data.students.map((student) => (
                  <div
                    key={student.studentId}
                    className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-950/80 to-zinc-900/60 px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {student.studentName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {student.nis} • {student.className}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-300">
                          Rate {student.attendanceRate}%
                        </span>
                        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-200">
                          {student.absent} alpha
                        </span>
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
                          {student.late} terlambat
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {student.riskFlags.map((flag) => (
                        <span
                          key={`${student.studentId}-${flag}`}
                          className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-100"
                        >
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-4 py-5">
                <p className="text-sm font-medium text-zinc-300">
                  Tidak ada siswa berisiko pada periode aktif.
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Filter aktif tidak menemukan prioritas attendance risk baru.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={dashboardPanelClass}>
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <BellRing className="h-4 w-4 text-sky-400" />
              Internal Notifications
            </CardTitle>
            <p className="text-sm leading-6 text-zinc-400">
              Follow-up attendance terbaru, KPI penyelesaian, reminder, dan aksi
              operasional dalam satu workspace.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={`${dashboardInsetCardClass} border-sky-500/20`}>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Total
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-100">
                  {visibleNotificationSummary.total}
                </p>
              </div>
              <div className={`${dashboardInsetCardClass} border-amber-500/20`}>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Pending
                </p>
                <p className="mt-1 text-xl font-semibold text-amber-300">
                  {visibleNotificationSummary.pending}
                </p>
              </div>
              <div
                className={`${dashboardInsetCardClass} border-emerald-500/20`}
              >
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Selesai
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-300">
                  {visibleNotificationSummary.done}
                </p>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-4">
              <div
                className={`${dashboardInsetCardClass} border-emerald-500/20`}
              >
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  KPI 7 Hari
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">
                  {weeklyNotifications.length} follow-up
                </p>
                <p className="text-sm text-emerald-300">
                  Completion rate {weeklyCompletionRate}%
                </p>
              </div>
              <div
                className={`${dashboardInsetCardClass} border-emerald-500/20`}
              >
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  KPI Bulan Ini
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">
                  {monthlyNotifications.length} follow-up
                </p>
                <p className="text-sm text-emerald-300">
                  Completion rate {monthlyCompletionRate}%
                </p>
              </div>
              <div className={`${dashboardInsetCardClass} border-sky-500/20`}>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Completed Today
                </p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">
                  {completedTodayCount}
                </p>
                <p className="text-sm text-emerald-300">
                  Follow-up selesai hari ini
                </p>
              </div>
              <div className={`${dashboardInsetCardClass} border-red-500/20`}>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  SLA Breach
                </p>
                <p className="mt-2 text-lg font-semibold text-red-300">
                  {slaBreachCount}
                </p>
                <p className="text-sm text-red-300">
                  Pending melewati deadline
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-sky-200">
                Snapshot Kepala Sekolah
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs text-sky-100/70">Total Follow-up</p>
                  <p className="text-lg font-semibold text-white">
                    {executiveSnapshot.totalFollowUps}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-sky-100/70">Completion Rate</p>
                  <p className="text-lg font-semibold text-white">
                    {executiveSnapshot.completionRate}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-sky-100/70">Top Class</p>
                  <p className="text-lg font-semibold text-white">
                    {executiveSnapshot.topClass}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-sky-100/70">Top Assignee</p>
                  <p className="text-lg font-semibold text-white">
                    {executiveSnapshot.topAssignee}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-sky-100/70">Overdue</p>
                  <p className="text-lg font-semibold text-red-100">
                    {executiveSnapshot.overdue}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-sky-100/70">Due Today</p>
                  <p className="text-lg font-semibold text-amber-100">
                    {executiveSnapshot.dueToday}
                  </p>
                </div>
              </div>
            </div>

            <div className="sticky top-2 z-10 grid gap-3 rounded-[1.5rem] border border-zinc-800/80 bg-zinc-900/85 p-2.5 backdrop-blur md:top-4 md:rounded-[1.75rem] md:p-3 xl:grid-cols-[minmax(0,220px)_1fr]">
              <div className={dashboardToolbarPanelClass}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Periode Dashboard
                </p>
                <Select
                  value={periodFilter}
                  onValueChange={(value) =>
                    setPeriodFilter(value as "7d" | "30d" | "month")
                  }
                >
                  <SelectTrigger className="w-full border-zinc-800 bg-zinc-950 text-zinc-200">
                    <SelectValue placeholder="Periode dashboard" />
                  </SelectTrigger>
                  <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                    <SelectItem value="7d">7 Hari</SelectItem>
                    <SelectItem value="30d">30 Hari</SelectItem>
                    <SelectItem value="month">Bulan Ini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div
                className={`${dashboardToolbarPanelClass} flex flex-wrap gap-2 p-2.5 md:p-3`}
              >
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={printingDashboard}
                  onClick={() => {
                    void handlePrintDashboardReport();
                  }}
                  className={dashboardOutlineButtonClass}
                >
                  {printingDashboard ? "Memproses..." : "Print Dashboard"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleToggleReminderCards}
                  className={dashboardOutlineButtonClass}
                >
                  {hideReminderCards
                    ? "Tampilkan Reminder"
                    : "Sembunyikan Reminder"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleResetDashboardUiState}
                  className={dashboardOutlineButtonClass}
                >
                  Reset Tampilan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={exportingDashboardPack}
                  onClick={() => {
                    void handleExportDashboardPack();
                  }}
                  className={dashboardEmeraldOutlineButtonClass}
                >
                  {exportingDashboardPack
                    ? "Memproses..."
                    : "Export Dashboard Pack"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={exportingAnalytics}
                  onClick={() => {
                    void handleExportAnalytics();
                  }}
                  className={dashboardVioletOutlineButtonClass}
                >
                  {exportingAnalytics ? "Memproses..." : "Export Analytics"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={exportingKpi}
                  onClick={() => {
                    void handleExportKpiDashboard();
                  }}
                  className={dashboardSkyOutlineButtonClass}
                >
                  {exportingKpi ? "Memproses..." : "Export KPI"}
                </Button>
                <div className="hidden min-w-[11rem] items-center rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-[11px] leading-5 text-zinc-500 lg:ml-auto lg:flex">
                  Toolbar tetap terlihat saat scroll supaya filter dan export
                  lebih cepat diakses.
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 xl:col-span-2">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                      Tren Completion 7 Hari
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Total follow-up vs follow-up selesai per hari
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-7 gap-2">
                  {trendBuckets.map((item) => (
                    <div
                      key={item.date}
                      className="rounded-xl border border-zinc-800 bg-linear-to-b from-zinc-900/80 to-zinc-950/70 p-2 shadow-[0_16px_40px_-32px_rgba(59,130,246,0.6)]"
                    >
                      <p className="text-[11px] text-zinc-500">{item.label}</p>
                      <div className="mt-2 flex h-28 items-end gap-1">
                        <div className="flex-1 rounded-t bg-zinc-700/70">
                          <div
                            className="rounded-t bg-zinc-500/70"
                            style={{
                              height: `${Math.max(
                                8,
                                (item.total / maxTrendTotal) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="flex-1 rounded-t bg-emerald-900/50">
                          <div
                            className="rounded-t bg-emerald-400"
                            style={{
                              height: `${Math.max(
                                8,
                                (item.completed / maxTrendTotal) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-zinc-400">
                        {item.completed}/{item.total} selesai
                      </p>
                      <p className="text-[11px] text-emerald-300">
                        Rate {item.rate}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Aging Bucket
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  Umur follow-up pending
                </p>
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAgingFilter("0-3");
                      setVisibleCount(10);
                    }}
                    className="block w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900/70"
                  >
                    <p className="text-sm text-zinc-100">0-3 Hari</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-100">
                      {agingBuckets.zeroToThree}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAgingFilter("4-7");
                      setVisibleCount(10);
                    }}
                    className="block w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900/70"
                  >
                    <p className="text-sm text-zinc-100">4-7 Hari</p>
                    <p className="mt-1 text-lg font-semibold text-amber-300">
                      {agingBuckets.fourToSeven}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAgingFilter("8+");
                      setVisibleCount(10);
                    }}
                    className="block w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900/70"
                  >
                    <p className="text-sm text-zinc-100">&gt; 7 Hari</p>
                    <p className="mt-1 text-lg font-semibold text-red-300">
                      {agingBuckets.overSeven}
                    </p>
                  </button>
                  {agingFilter !== "all" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAgingFilter("all")}
                      className={`w-full ${dashboardOutlineButtonClass}`}
                    >
                      Reset Aging Filter
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 xl:col-span-2">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Heatmap Overdue
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  Snapshot overdue pending per hari dalam 21 hari terakhir
                </p>
                <div className="mt-4 grid grid-cols-7 gap-2">
                  {overdueHeatmap.map((item) => {
                    const intensity = Math.max(
                      0.18,
                      item.total / maxOverdueHeat || 0.18,
                    );

                    return (
                      <button
                        type="button"
                        key={`overdue-heat-${item.date}`}
                        onClick={() => {
                          setNotificationFilter("overdue");
                          setVisibleCount(10);
                        }}
                        className="rounded-xl border border-zinc-800 bg-linear-to-b from-zinc-900/80 to-zinc-950/70 px-2 py-3 text-center transition hover:scale-[1.02] hover:border-red-500/25"
                        style={{
                          backgroundColor: `rgba(239, 68, 68, ${intensity})`,
                        }}
                      >
                        <p className="text-[11px] text-zinc-100">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {item.total}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Scheduled Reminder Summary
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  Ringkasan reminder tindak lanjut
                </p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-3">
                    <p className="text-sm text-zinc-100">Due Today</p>
                    <p className="mt-1 text-lg font-semibold text-sky-300">
                      {scheduledReminderSummary.dueToday}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3">
                    <p className="text-sm text-zinc-100">Due Tomorrow</p>
                    <p className="mt-1 text-lg font-semibold text-amber-300">
                      {scheduledReminderSummary.dueTomorrow}
                    </p>
                  </div>
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3">
                    <p className="text-sm text-zinc-100">Overdue</p>
                    <p className="mt-1 text-lg font-semibold text-red-300">
                      {scheduledReminderSummary.overdue}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Top Assignee Performance
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Ranking berdasarkan completion rate follow-up
                  </p>
                </div>
                <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                  {topAssigneePerformance.length} assignee aktif
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:hidden">
                {topAssigneePerformance.map((item) => (
                  <button
                    key={`performance-mobile-top-${item.userId}`}
                    type="button"
                    onClick={() => {
                      setAssigneeFilter(item.userId);
                      setVisibleCount(10);
                    }}
                    className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-950/90 to-zinc-900/70 p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {item.assigneeName}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Ringkasan follow-up per assignee
                        </p>
                      </div>
                      <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-300">
                        {item.completionRate}% complete
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                          Total
                        </p>
                        <p className="mt-1 font-semibold text-zinc-100">
                          {item.total}
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-amber-200">
                          Pending
                        </p>
                        <p className="mt-1 font-semibold text-amber-100">
                          {item.pending}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-200">
                          Done
                        </p>
                        <p className="mt-1 font-semibold text-emerald-100">
                          {item.done}
                        </p>
                      </div>
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-red-200">
                          Overdue
                        </p>
                        <p className="mt-1 font-semibold text-red-100">
                          {item.overdue}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-zinc-500 md:hidden">
                Geser tabel ke samping untuk melihat semua kolom.
              </p>
              <div className="mt-2 hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/60 md:block">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="pb-2 pr-4 font-medium">Assignee</th>
                      <th className="pb-2 pr-4 font-medium">Total</th>
                      <th className="pb-2 pr-4 font-medium">Done</th>
                      <th className="pb-2 pr-4 font-medium">Pending</th>
                      <th className="pb-2 font-medium">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAssigneePerformance.map((item) => (
                      <tr
                        key={`performance-${item.userId}`}
                        className="border-b border-zinc-900/80 text-zinc-200 transition-colors hover:bg-zinc-900/40"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-100">
                          {item.assigneeName}
                        </td>
                        <td className="py-3 pr-4">{item.total}</td>
                        <td className="py-3 pr-4 text-emerald-300">
                          {item.done}
                        </td>
                        <td className="py-3 pr-4 text-amber-300">
                          {item.pending}
                        </td>
                        <td className="py-3 font-semibold text-zinc-100">
                          {item.completionRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Dashboard Summary per Kelas
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Ringkasan follow-up berdasarkan kelas
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={exportingClassSummary}
                  onClick={() => {
                    void handleExportClassSummary();
                  }}
                  className={dashboardSkyOutlineButtonClass}
                >
                  {exportingClassSummary
                    ? "Memproses..."
                    : "Export Summary Kelas"}
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:hidden">
                {classRecoveryLeaderboard.map((item) => (
                  <div
                    key={`class-recovery-mobile-${item.className}`}
                    className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-950/90 to-zinc-900/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {item.className}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Recovery leaderboard kelas
                        </p>
                      </div>
                      <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200">
                        {item.recoveryRate}%
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-200">
                          Done
                        </p>
                        <p className="mt-1 font-semibold text-emerald-100">
                          {item.done}
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-amber-200">
                          Pending
                        </p>
                        <p className="mt-1 font-semibold text-amber-100">
                          {item.pending}
                        </p>
                      </div>
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-red-200">
                          Overdue
                        </p>
                        <p className="mt-1 font-semibold text-red-100">
                          {item.overdue}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-zinc-500 md:hidden">
                Geser tabel ke samping untuk melihat semua kolom.
              </p>
              <div className="mt-2 hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/60 md:block">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="pb-2 pr-4 font-medium">Kelas</th>
                      <th className="pb-2 pr-4 font-medium">Total</th>
                      <th className="pb-2 pr-4 font-medium">Done</th>
                      <th className="pb-2 pr-4 font-medium">Pending</th>
                      <th className="pb-2 font-medium">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classSummaryRows.map((item) => (
                      <tr
                        key={`class-summary-${item.className}`}
                        className="border-b border-zinc-900/80 text-zinc-200 transition-colors hover:bg-zinc-900/40"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-100">
                          <button
                            type="button"
                            onClick={() => {
                              setClassFilter(item.className);
                              setVisibleCount(10);
                            }}
                            className="text-left underline-offset-4 hover:underline"
                          >
                            {item.className}
                          </button>
                        </td>
                        <td className="py-3 pr-4">{item.total}</td>
                        <td className="py-3 pr-4 text-emerald-300">
                          {item.done}
                        </td>
                        <td className="py-3 pr-4 text-amber-300">
                          {item.pending}
                        </td>
                        <td className="py-3 text-red-300">{item.overdue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Leaderboard Recovery per Kelas
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Ranking kelas dengan recovery follow-up terbaik
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={exportingClassLeaderboard}
                  onClick={() => {
                    void handleExportClassLeaderboard();
                  }}
                  className={dashboardSkyOutlineButtonClass}
                >
                  {exportingClassLeaderboard
                    ? "Memproses..."
                    : "Export Leaderboard"}
                </Button>
              </div>
              <p className="mt-4 text-xs text-zinc-500 md:hidden">
                Geser tabel ke samping untuk melihat semua kolom.
              </p>
              <div className="mt-4 grid gap-3 md:hidden">
                {topAssigneePerformance.map((item) => (
                  <button
                    key={`performance-mobile-${item.userId}`}
                    type="button"
                    onClick={() => {
                      setAssigneeFilter(item.userId);
                      setVisibleCount(10);
                    }}
                    className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-950/90 to-zinc-900/70 p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {item.assigneeName}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Ranking completion rate follow-up
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
                        {item.completionRate}%
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                          Total
                        </p>
                        <p className="mt-1 font-semibold text-zinc-100">
                          {item.total}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-200">
                          Done
                        </p>
                        <p className="mt-1 font-semibold text-emerald-100">
                          {item.done}
                        </p>
                      </div>
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-amber-200">
                          Pending
                        </p>
                        <p className="mt-1 font-semibold text-amber-100">
                          {item.pending}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-zinc-500 md:hidden">
                Geser tabel ke samping untuk melihat semua kolom.
              </p>
              <div className="mt-2 hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/60 md:block">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="pb-2 pr-4 font-medium">Kelas</th>
                      <th className="pb-2 pr-4 font-medium">Done</th>
                      <th className="pb-2 pr-4 font-medium">Pending</th>
                      <th className="pb-2 pr-4 font-medium">Overdue</th>
                      <th className="pb-2 font-medium">Recovery Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classRecoveryLeaderboard.map((item) => (
                      <tr
                        key={`class-recovery-${item.className}`}
                        className="border-b border-zinc-900/80 text-zinc-200 transition-colors hover:bg-zinc-900/40"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-100">
                          {item.className}
                        </td>
                        <td className="py-3 pr-4 text-emerald-300">
                          {item.done}
                        </td>
                        <td className="py-3 pr-4 text-amber-300">
                          {item.pending}
                        </td>
                        <td className="py-3 pr-4 text-red-300">
                          {item.overdue}
                        </td>
                        <td className="py-3 font-semibold text-zinc-100">
                          {item.recoveryRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Leaderboard Recovery Rate
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Ranking assignee yang paling baik menyelesaikan follow-up
                  </p>
                </div>
                <div className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200">
                  Fokus recovery rate
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:hidden">
                {recoveryLeaderboard.map((item) => (
                  <button
                    key={`recovery-mobile-${item.userId}`}
                    type="button"
                    onClick={() => {
                      setAssigneeFilter(item.userId);
                      setVisibleCount(10);
                    }}
                    className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-950/90 to-zinc-900/70 p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {item.assigneeName}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Ranking recovery rate follow-up
                        </p>
                      </div>
                      <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200">
                        {item.recoveryRate}%
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-200">
                          Done
                        </p>
                        <p className="mt-1 font-semibold text-emerald-100">
                          {item.done}
                        </p>
                      </div>
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-red-200">
                          Overdue
                        </p>
                        <p className="mt-1 font-semibold text-red-100">
                          {item.overdue}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-zinc-500 md:hidden">
                Geser tabel ke samping untuk melihat semua kolom.
              </p>
              <div className="mt-2 hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/60 md:block">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="pb-2 pr-4 font-medium">Assignee</th>
                      <th className="pb-2 pr-4 font-medium">Done</th>
                      <th className="pb-2 pr-4 font-medium">Overdue</th>
                      <th className="pb-2 font-medium">Recovery Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recoveryLeaderboard.map((item) => (
                      <tr
                        key={`recovery-${item.userId}`}
                        className="border-b border-zinc-900/80 text-zinc-200 transition-colors hover:bg-zinc-900/40"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-100">
                          {item.assigneeName}
                        </td>
                        <td className="py-3 pr-4 text-emerald-300">
                          {item.done}
                        </td>
                        <td className="py-3 pr-4 text-red-300">
                          {item.overdue}
                        </td>
                        <td className="py-3 font-semibold text-zinc-100">
                          {item.recoveryRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                    Compare Assignee
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Bandingkan performa dua assignee
                  </p>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className={dashboardToolbarPanelClass}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Assignee A
                    </p>
                    <Select
                      value={compareAssigneeA}
                      onValueChange={setCompareAssigneeA}
                    >
                      <SelectTrigger className="w-full min-w-0 border-zinc-800 bg-zinc-900 text-zinc-200">
                        <SelectValue placeholder="Assignee A" />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                        <SelectItem value="none">Pilih Assignee A</SelectItem>
                        {data.assignmentSummary.map((item) => (
                          <SelectItem
                            key={`compare-a-${item.userId}`}
                            value={item.userId}
                          >
                            {item.assigneeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={dashboardToolbarPanelClass}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Assignee B
                    </p>
                    <Select
                      value={compareAssigneeB}
                      onValueChange={setCompareAssigneeB}
                    >
                      <SelectTrigger className="w-full min-w-0 border-zinc-800 bg-zinc-900 text-zinc-200">
                        <SelectValue placeholder="Assignee B" />
                      </SelectTrigger>
                      <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                        <SelectItem value="none">Pilih Assignee B</SelectItem>
                        {data.assignmentSummary.map((item) => (
                          <SelectItem
                            key={`compare-b-${item.userId}`}
                            value={item.userId}
                          >
                            {item.assigneeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {compareAssigneeItemA && compareAssigneeItemB ? (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={exportingCompare}
                      onClick={() => {
                        void handleExportCompareAssignee();
                      }}
                      className={`min-h-9 w-full sm:w-auto ${dashboardSkyOutlineButtonClass}`}
                    >
                      {exportingCompare ? "Memproses..." : "Export Compare"}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[compareAssigneeItemA, compareAssigneeItemB].map(
                      (item) => (
                        <div
                          key={`compare-card-${item.userId}`}
                          className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-950/90 via-zinc-900/75 to-sky-950/20 px-4 py-4 shadow-[0_22px_60px_-44px_rgba(14,165,233,0.7)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-zinc-100">
                              {item.assigneeName}
                            </p>
                            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200">
                              {item.completionRate}% complete
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-zinc-500">Total</p>
                              <p className="font-medium text-zinc-100">
                                {item.total}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Done</p>
                              <p className="font-medium text-emerald-300">
                                {item.done}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Pending</p>
                              <p className="font-medium text-amber-300">
                                {item.pending}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-500">Completion</p>
                              <p className="font-medium text-zinc-100">
                                {item.completionRate}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-4 py-4 text-sm text-zinc-500">
                  Pilih dua assignee untuk membandingkan performanya.
                </p>
              )}
            </div>

            {showOverdueBanner ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-red-200">
                      Ada follow-up overdue baru
                    </p>
                    <p className="mt-1 text-sm text-red-100/90">
                      Saat ini ada {overdueNotifications.length} follow-up
                      overdue pada filter aktif. Prioritaskan tindak lanjut.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDismissOverdueBanner}
                    className="border-red-400/50 bg-red-950/30 text-red-100 hover:border-red-300/60 hover:bg-red-500/15"
                  >
                    Tutup
                  </Button>
                </div>
              </div>
            ) : null}

            {!hideReminderCards && automaticReminders.length > 0 ? (
              <div className="grid gap-2">
                {automaticReminders.map((message) => (
                  <div
                    key={message}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
                  >
                    {message}
                  </div>
                ))}
              </div>
            ) : null}

            <div
              className={`${dashboardToolbarPanelClass} flex flex-wrap gap-2 p-2.5 md:p-3`}
            >
              {[
                ["all", "Semua"],
                ["pending", "Pending"],
                ["done", "Selesai"],
                ["overdue", "Overdue"],
                ["dueToday", "Due Today"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNotificationFilter(
                      value as
                        | "all"
                        | "pending"
                        | "done"
                        | "overdue"
                        | "dueToday",
                    );
                    setVisibleCount(10);
                  }}
                  className={
                    notificationFilter === value
                      ? "min-h-9 border-sky-500 bg-sky-500/10 text-sky-200"
                      : `min-h-9 ${dashboardOutlineButtonClass}`
                  }
                >
                  {label}
                </Button>
              ))}
            </div>

            <div
              className={`${dashboardToolbarPanelClass} flex flex-wrap gap-2 p-2.5 md:p-3`}
            >
              <Select
                value={sortBy}
                onValueChange={(value) => {
                  setSortBy(value as "latest" | "deadline" | "overdue");
                  setVisibleCount(10);
                }}
              >
                <SelectTrigger className="w-full min-w-0 border-zinc-800 bg-zinc-950 text-zinc-200 md:max-w-xs">
                  <SelectValue placeholder="Urutkan notifikasi" />
                </SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                  <SelectItem value="latest">Terbaru</SelectItem>
                  <SelectItem value="deadline">Deadline Terdekat</SelectItem>
                  <SelectItem value="overdue">Overdue Dulu</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setVisibleCount(10);
                }}
                placeholder="Cari siswa, kelas, atau isi follow-up..."
                className="w-full min-w-[240px] border-zinc-800 bg-zinc-950 text-zinc-200 md:max-w-sm"
              />
            </div>

            <div
              className={`${dashboardToolbarPanelClass} flex flex-wrap gap-2 p-2.5 md:p-3`}
            >
              <Input
                type="date"
                value={bulkDeadline}
                onChange={(event) => setBulkDeadline(event.target.value)}
                className="w-full min-w-0 border-zinc-800 bg-zinc-950 text-zinc-200 md:max-w-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  bulkSavingDeadline ||
                  !bulkDeadline ||
                  filteredNotifications.every(
                    (notification) => notification.isRead,
                  )
                }
                onClick={() => {
                  void handleBulkUpdateDeadline();
                }}
                className={`min-h-9 ${dashboardAmberOutlineButtonClass}`}
              >
                {bulkSavingDeadline ? "Memproses..." : "Bulk Set Deadline"}
              </Button>
              {canManageAssignees ? (
                <>
                  <Select
                    value={bulkAssigneeId}
                    onValueChange={setBulkAssigneeId}
                  >
                    <SelectTrigger className="w-full min-w-0 border-zinc-800 bg-zinc-950 text-zinc-200 md:max-w-xs">
                      <SelectValue placeholder="Bulk reassign assignee" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                      <SelectItem value="none">Pilih assignee baru</SelectItem>
                      {assigneeOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.fullName} • {option.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      bulkReassigning ||
                      bulkAssigneeId === "none" ||
                      filteredNotifications.every(
                        (notification) => notification.isRead,
                      )
                    }
                    onClick={() => {
                      void handleBulkReassign();
                    }}
                    className={`min-h-9 ${dashboardVioletOutlineButtonClass}`}
                  >
                    {bulkReassigning ? "Memproses..." : "Bulk Reassign"}
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  bulkMarkingDone ||
                  filteredNotifications.every(
                    (notification) => notification.isRead,
                  )
                }
                onClick={() => {
                  void handleBulkMarkDone();
                }}
                className={`min-h-9 ${dashboardEmeraldOutlineButtonClass}`}
              >
                {bulkMarkingDone ? "Memproses..." : "Bulk Tandai Selesai"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={exportingReport || filteredNotifications.length === 0}
                onClick={() => {
                  void handleExportFollowUpReport();
                }}
                className={`min-h-9 ${dashboardSkyOutlineButtonClass}`}
              >
                {exportingReport ? "Memproses..." : "Export Follow-up"}
              </Button>
            </div>

            {visibleNotifications.length > 0 ? (
              visibleNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-950/80 to-zinc-900/60 px-4 py-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">
                        {notification.judul}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {notification.className || "-"}
                        {notification.deadline
                          ? ` • Deadline ${notification.deadline}`
                          : ""}
                      </p>
                      {!notification.isRead &&
                      notification.deadline &&
                      notification.deadline < today ? (
                        <p className="mt-1 inline-flex rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-red-300">
                          Overdue
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        {notification.pesan}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-300">
                          {notification.isRead ? "Selesai" : "Pending"}
                        </span>
                        {notification.riskFlags.map((flag) => (
                          <span
                            key={`${notification.id}-${flag}`}
                            className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-100"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 xl:w-[12rem] xl:flex-col">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(notification.id);
                          setEditingNote(notification.note || "");
                          setEditingDeadline(notification.deadline || "");
                          setEditingAssigneeId("keep");
                        }}
                        className={dashboardOutlineButtonClass}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void handleToggleAudit(notification.id);
                        }}
                        className={dashboardOutlineButtonClass}
                      >
                        Riwayat
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          notification.isRead || markingId === notification.id
                        }
                        onClick={() => {
                          void handleMarkDone(notification.id);
                        }}
                        className={dashboardOutlineButtonClass}
                      >
                        {notification.isRead ? "Selesai" : "Tandai Selesai"}
                      </Button>
                    </div>
                  </div>

                  {editingId === notification.id ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_auto_auto]">
                      <Input
                        value={editingNote}
                        maxLength={300}
                        onChange={(event) => setEditingNote(event.target.value)}
                        placeholder="Catatan follow-up"
                        className="border-zinc-800 bg-zinc-900 text-zinc-200"
                      />
                      <Input
                        type="date"
                        value={editingDeadline}
                        onChange={(event) =>
                          setEditingDeadline(event.target.value)
                        }
                        className="border-zinc-800 bg-zinc-900 text-zinc-200"
                      />
                      {canManageAssignees ? (
                        <Select
                          value={editingAssigneeId}
                          onValueChange={setEditingAssigneeId}
                        >
                          <SelectTrigger className="border-zinc-800 bg-zinc-900 text-zinc-200">
                            <SelectValue placeholder="Reassign assignee" />
                          </SelectTrigger>
                          <SelectContent className="border-zinc-800 bg-zinc-900 text-white">
                            <SelectItem value="keep">
                              Tetap assignee saat ini
                            </SelectItem>
                            {assigneeOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.fullName} • {option.role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingEditId === notification.id}
                        onClick={() => {
                          void handleSaveEdit(notification.id);
                        }}
                        className="bg-sky-600 text-white hover:bg-sky-500"
                      >
                        Simpan
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditingNote("");
                          setEditingDeadline("");
                          setEditingAssigneeId("keep");
                        }}
                        className={dashboardOutlineButtonClass}
                      >
                        Batal
                      </Button>
                    </div>
                  ) : null}

                  {auditOpenId === notification.id ? (
                    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Riwayat Perubahan
                      </p>
                      {auditLoadingId === notification.id ? (
                        <div className="mt-3 space-y-2">
                          <div className="h-3 w-28 animate-pulse rounded bg-zinc-800" />
                          <div className="h-3 w-full animate-pulse rounded bg-zinc-800/80" />
                          <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-800/70" />
                        </div>
                      ) : auditTrail[notification.id]?.length ? (
                        <div className="mt-3 space-y-2">
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                void handleExportAuditTrail(
                                  notification,
                                  auditTrail[notification.id],
                                );
                              }}
                              className={dashboardSkyOutlineButtonClass}
                            >
                              Export Audit Trail
                            </Button>
                          </div>
                          {auditTrail[notification.id].map((item) => (
                            <div
                              key={item.id}
                              className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                            >
                              <p className="text-xs text-zinc-300">
                                {item.pesan}
                              </p>
                              <p className="mt-1 text-[11px] text-zinc-500">
                                {new Date(item.createdAt).toLocaleString(
                                  "id-ID",
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-500">
                          Belum ada riwayat perubahan.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-4 py-5">
                <p className="text-sm font-medium text-zinc-300">
                  Belum ada notifikasi internal attendance.
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Coba ubah filter periode, status, atau pencarian untuk melihat
                  follow-up lain.
                </p>
              </div>
            )}

            {hasMoreNotifications ? (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVisibleCount((current) => current + 10)}
                  className={dashboardOutlineButtonClass}
                >
                  Load More Follow-up
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className={`${dashboardPanelClass} xl:col-span-2`}>
          <CardHeader className="space-y-2">
            <CardTitle className="text-zinc-100">
              Follow-up per Wali Kelas / Guru
            </CardTitle>
            <p className="text-xs text-zinc-500">
              Rekap assignment follow-up attendance lintas assignee
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  exportingAssignmentSummary ||
                  data.assignmentSummary.length === 0
                }
                onClick={() => {
                  void handleExportAssignmentSummary();
                }}
                className={`min-h-9 w-full sm:w-auto ${dashboardSkyOutlineButtonClass}`}
              >
                {exportingAssignmentSummary
                  ? "Memproses..."
                  : "Export Assignment Summary"}
              </Button>
            </div>
            {data.assignmentSummary.length > 0 ? (
              <>
                <div className="mb-3 grid gap-3 md:hidden">
                  {data.assignmentSummary.map((item) => (
                    <button
                      key={`assignment-mobile-${item.userId}`}
                      type="button"
                      onClick={() => {
                        setAssigneeFilter(item.userId);
                        setVisibleCount(10);
                      }}
                      className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-950/90 to-zinc-900/70 p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">
                            {item.assigneeName}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Rekap assignment follow-up
                          </p>
                        </div>
                        <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-300">
                          Total {item.total}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-amber-200">
                            Pending
                          </p>
                          <p className="mt-1 font-semibold text-amber-100">
                            {item.pending}
                          </p>
                        </div>
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-red-200">
                            Overdue
                          </p>
                          <p className="mt-1 font-semibold text-red-100">
                            {item.overdue}
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-200">
                            Done
                          </p>
                          <p className="mt-1 font-semibold text-emerald-100">
                            {item.done}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="mb-2 text-xs text-zinc-500 md:hidden">
                  Geser tabel ke samping untuk melihat semua kolom.
                </p>
                <div className="hidden overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/60 md:block">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-zinc-500">
                      <tr className="border-b border-zinc-800">
                        <th className="pb-2 pr-4 font-medium">Assignee</th>
                        <th className="pb-2 pr-4 font-medium">Total</th>
                        <th className="pb-2 pr-4 font-medium">Pending</th>
                        <th className="pb-2 pr-4 font-medium">Overdue</th>
                        <th className="pb-2 font-medium">Selesai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.assignmentSummary.map((item) => (
                        <tr
                          key={item.userId}
                          className="border-b border-zinc-900/80 text-zinc-200 transition-colors hover:bg-zinc-900/40"
                        >
                          <td className="py-3 pr-4 font-medium text-zinc-100">
                            <button
                              type="button"
                              onClick={() => {
                                setAssigneeFilter(item.userId);
                                setVisibleCount(10);
                              }}
                              className="text-left underline-offset-4 hover:underline"
                            >
                              {item.assigneeName}
                            </button>
                          </td>
                          <td className="py-3 pr-4">{item.total}</td>
                          <td className="py-3 pr-4 text-amber-300">
                            {item.pending}
                          </td>
                          <td className="py-3 pr-4 text-red-300">
                            {item.overdue}
                          </td>
                          <td className="py-3 text-emerald-300">{item.done}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                Belum ada assignment follow-up attendance.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
