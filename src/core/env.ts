/**
 * Runtime environment detection for EduCore (2026 Elite Pattern)
 */

export const isTauri = (): boolean => {
  return (
    typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined
  );
};

export const isWeb = (): boolean => {
  return !isTauri();
};

export const getPlatform = () => {
  if (isTauri()) return "desktop";
  return "web";
};
