import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { resetSupabaseMock } from "./helpers/supabase";

vi.mock("@/lib/supabase", async () => {
  const { supabaseMock } = await import("./helpers/supabase");
  return { supabase: supabaseMock };
});

beforeEach(() => {
  resetSupabaseMock();
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Network access is disabled in tests."))));
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", "/");
  vi.stubGlobal("matchMedia", vi.fn((media: string) => ({
    matches: false, media, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  // jsdom has no pointer capture or layout observer; the real components still run.
  Object.defineProperty(Element.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => {
  if (typeof document !== "undefined") cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
