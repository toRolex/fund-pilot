import "@testing-library/jest-dom/vitest";

// ponytail: global ResizeObserver mock for Recharts in jsdom, export from recharts/test if available
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
