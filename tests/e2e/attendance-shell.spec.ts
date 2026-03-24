import { expect, test } from "@playwright/test";
import { AttendancePage } from "../page-objects/attendance-page";
import { LoginPage } from "../page-objects/login-page";

const attendanceIdentifier = process.env.E2E_ATTENDANCE_IDENTIFIER;
const attendancePassword = process.env.E2E_ATTENDANCE_PASSWORD;

test.describe("Attendance shell", () => {
  test.skip(
    !attendanceIdentifier || !attendancePassword,
    "Set E2E_ATTENDANCE_IDENTIFIER dan E2E_ATTENDANCE_PASSWORD untuk menjalankan Attendance E2E.",
  );

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login({
      identifier: attendanceIdentifier ?? "",
      password: attendancePassword ?? "",
    });

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("allows admin to open attendance and switch core sections", async ({
    page,
  }) => {
    const attendancePage = new AttendancePage(page);

    await attendancePage.goto();
    await attendancePage.expectShellReady();

    await attendancePage.expectQrSection();
    await attendancePage.expectTabActive(/QR Attendance/i);

    await attendancePage.switchSection(/Input Manual/i);
    await attendancePage.expectManualSection();
    await attendancePage.expectTabActive(/Input Manual/i);

    await attendancePage.switchSection(/Log Absensi/i);
    await attendancePage.expectHistorySection();
    await attendancePage.expectTabActive(/Log Absensi/i);
  });
});
