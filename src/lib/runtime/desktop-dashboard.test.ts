import { afterEach, describe, expect, it } from "vitest";
import {
  getRuntimeDefaultDashboardPath,
  getRuntimeSupportedDashboardLabels,
  getRuntimeSupportedDashboardPaths,
  isRuntimeSupportedDashboardPath,
} from "./desktop-dashboard";

function setTauriRuntime(active: boolean) {
  const tauriWindow = window as Window & {
    __TAURI_INTERNALS__?: Record<string, unknown>;
  };

  if (active) {
    tauriWindow.__TAURI_INTERNALS__ = {};
    return;
  }

  delete tauriWindow.__TAURI_INTERNALS__;
}

afterEach(() => {
  setTauriRuntime(false);
});

describe("desktop dashboard runtime policy", () => {
  it("keeps web runtime paths untouched", () => {
    expect(
      getRuntimeSupportedDashboardPaths([
        "/dashboard",
        "/dashboard/students",
        "/dashboard/attendance",
      ]),
    ).toEqual(["/dashboard", "/dashboard/students", "/dashboard/attendance"]);
  });

  it("filters desktop runtime to local-safe dashboard paths", () => {
    setTauriRuntime(true);

    expect(
      getRuntimeSupportedDashboardPaths([
        "/dashboard",
        "/dashboard/students",
        "/dashboard/attendance",
        "/dashboard/courses",
      ]),
    ).toEqual(["/dashboard", "/dashboard/attendance", "/dashboard/courses"]);
    expect(isRuntimeSupportedDashboardPath("/dashboard")).toBe(true);
    expect(isRuntimeSupportedDashboardPath("/dashboard/students")).toBe(false);
  });

  it("keeps desktop default redirect on a supported path", () => {
    setTauriRuntime(true);

    expect(getRuntimeDefaultDashboardPath("admin", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(
      getRuntimeDefaultDashboardPath("student", "/dashboard/students"),
    ).toBe("/dashboard/attendance");
  });

  it("describes only the dashboard pages supported in desktop runtime", () => {
    setTauriRuntime(true);

    expect(
      getRuntimeSupportedDashboardLabels([
        "/dashboard",
        "/dashboard/students",
        "/dashboard/settings",
      ]),
    ).toEqual(["Overview", "Settings"]);
  });
});
