import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from "./sidebar-storage";

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
}

describe("sidebar-storage", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    (globalThis as any).window = { localStorage: createMemoryStorage() };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it("defaults to false when nothing stored", () => {
    expect(getStoredSidebarCollapsed()).toBe(false);
  });

  it("round-trips true", () => {
    setStoredSidebarCollapsed(true);
    expect(getStoredSidebarCollapsed()).toBe(true);
  });

  it("round-trips back to false", () => {
    setStoredSidebarCollapsed(true);
    setStoredSidebarCollapsed(false);
    expect(getStoredSidebarCollapsed()).toBe(false);
  });

  it("returns false when window is undefined (SSR)", () => {
    (globalThis as any).window = undefined;
    expect(getStoredSidebarCollapsed()).toBe(false);
  });
});
