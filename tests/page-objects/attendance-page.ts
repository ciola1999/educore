import { expect, type Locator, type Page } from "@playwright/test";

export class AttendancePage {
  readonly sectionTabs: Locator;

  constructor(private readonly page: Page) {
    this.sectionTabs = page.getByRole("tablist", {
      name: /Attendance sections/i,
    });
  }

  async goto() {
    await this.page.goto("/dashboard/attendance");
    await expect(
      this.page.getByRole("heading", { name: /Manajemen Absensi/i }),
    ).toBeVisible();
  }

  async expectShellReady() {
    await expect(
      this.page.getByText(/Pusat Kendali Attendance/i),
    ).toBeVisible();
    await expect(this.page.getByText(/Section Aktif/i).first()).toBeVisible();
  }

  async switchSection(label: RegExp | string) {
    await this.page.getByRole("tab", { name: label }).click();
  }

  async expectTabActive(label: RegExp | string) {
    await expect(this.page.getByRole("tab", { name: label })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }

  async expectQrSection() {
    await expect(
      this.page.getByRole("heading", { name: /QR Attendance/i }),
    ).toBeVisible();
  }

  async expectManualSection() {
    await expect(
      this.page.getByRole("heading", { name: /Input Manual/i }),
    ).toBeVisible();
  }

  async expectHistorySection() {
    await expect(
      this.page.getByRole("heading", { name: /Log Absensi/i }),
    ).toBeVisible();
  }
}
