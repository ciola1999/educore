import { beforeEach, describe, expect, it, vi } from "vitest";

function createMockStorage() {
  const state = new Map<string, string>();

  return {
    getItem: (key: string) => state.get(key) ?? null,
    setItem: (key: string, value: string) => {
      state.set(key, value);
    },
    removeItem: (key: string) => {
      state.delete(key);
    },
    clear: () => {
      state.clear();
    },
  };
}

async function loadStorageModule(isTauriRuntime: boolean) {
  vi.resetModules();
  vi.doMock("@/core/env", () => ({
    isTauri: () => isTauriRuntime,
  }));

  return import("./storage");
}

describe("desktop sync storage boundary", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createMockStorage(),
      configurable: true,
      writable: true,
    });
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("does not expose sync credentials when runtime is web", async () => {
    const storage = await loadStorageModule(false);
    window.localStorage.setItem(
      storage.DESKTOP_SYNC_URL_KEY,
      "https://example.turso.io",
    );
    window.localStorage.setItem(storage.DESKTOP_SYNC_TOKEN_KEY, "secret-token");

    expect(storage.readDesktopSyncStorageConfig()).toBeNull();
  });

  it("stores and reads sync credentials only when runtime is tauri", async () => {
    const storage = await loadStorageModule(true);

    storage.writeDesktopSyncStorageConfig({
      url: " https://example.turso.io ",
      authToken: " token-123 ",
    });

    expect(storage.readDesktopSyncStorageConfig()).toEqual({
      url: "https://example.turso.io",
      authToken: "token-123",
    });
  });

  it("ignores writes when runtime is web", async () => {
    const storage = await loadStorageModule(false);

    storage.writeDesktopSyncStorageConfig({
      url: "https://example.turso.io",
      authToken: "token-123",
    });

    expect(
      window.localStorage.getItem(storage.DESKTOP_SYNC_URL_KEY),
    ).toBeNull();
    expect(
      window.localStorage.getItem(storage.DESKTOP_SYNC_TOKEN_KEY),
    ).toBeNull();
  });
});
