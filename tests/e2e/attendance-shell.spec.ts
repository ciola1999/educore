import { expect, test } from "@playwright/test";
import { AttendancePage } from "../page-objects/attendance-page";
import { LoginPage } from "../page-objects/login-page";

const attendanceIdentifier = process.env.E2E_ATTENDANCE_IDENTIFIER;
const attendancePassword = process.env.E2E_ATTENDANCE_PASSWORD;

test.describe("Attendance shell @smoke", () => {
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

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 45_000 });
  });

  test("allows admin to open attendance and switch core sections", async ({
    page,
  }) => {
    test.setTimeout(300_000);

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

  test("persists schedule save and holiday create-delete flow", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    const attendancePage = new AttendancePage(page);
    const holidayName = `E2E Holiday ${Date.now()}`;
    const holidayDate = "2026-12-31";

    await attendancePage.goto();
    await attendancePage.expectShellReady();

    await attendancePage.switchSection(/Pengaturan Jadwal/i);
    await attendancePage.expectScheduleSection();
    await attendancePage.expectTabActive(/Pengaturan Jadwal/i);

    await page
      .getByRole("button", { name: /Simpan pengaturan absensi/i })
      .first()
      .click();
    await expect(
      page.getByText(/Pengaturan absensi berhasil disimpan/i),
    ).toBeVisible({ timeout: 30_000 });

    await attendancePage.switchSection(/Kelola Hari Libur/i);
    await attendancePage.expectHolidaySection();
    await attendancePage.expectTabActive(/Kelola Hari Libur/i);

    await page.getByLabel(/Nama Hari Libur/i).fill(holidayName);
    await page.getByLabel(/Tanggal/i).fill(holidayDate);
    await page.getByRole("button", { name: /^Simpan$/i }).click();

    await expect(page.getByText(/Hari libur berhasil disimpan/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(holidayName)).toBeVisible({ timeout: 30_000 });

    await page
      .getByRole("button", { name: `Hapus hari libur ${holidayName}` })
      .click();

    await expect(page.getByText(/Hari libur berhasil dihapus/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(holidayName)).not.toBeVisible({
      timeout: 30_000,
    });
  });
});
