/**
 * Runtime environment detection for EduCore (2026 Elite Pattern)
 *
 * Uses multiple checks to ensure accurate Tauri detection:
 * 1. Check for __TAURI_INTERNALS__
 * 2. Check for __TAURI__ (main Tauri global)
 * 3. Check if we're in a secure context (Tauri windows are secure)
 */

export const isTauri = (): boolean => {
  // Check if we're in a browser environment
  if (typeof window === "undefined") {
    return false;
  }

  // Primary check: Look for Tauri globals
  // __TAURI_INTERNALS__ is set by Tauri at runtime
  // __TAURI__ is the main Tauri global object
  const hasTauriInternals = window.__TAURI_INTERNALS__ !== undefined;
  const hasTauriGlobal = window.__TAURI__ !== undefined;

  // For development, also check if we're in a Tauri-specific iframe
  // or if the protocol is non-http (like tauri://)
  const isTauriProtocol =
    typeof window.location !== "undefined" &&
    window.location.protocol === "tauri:";

  return hasTauriInternals || hasTauriGlobal || isTauriProtocol;
};

export const isWeb = (): boolean => {
  return !isTauri();
};

export const getPlatform = () => {
  if (isTauri()) return "desktop";
  return "web";
};
