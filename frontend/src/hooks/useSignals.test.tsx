import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSignals } from "./useSignals";

vi.mock("@/lib/api", () => ({
  api: { getSignals: vi.fn() },
}));

import { api } from "@/lib/api";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useSignals", () => {
  it("returns signals data on success", async () => {
    vi.mocked(api.getSignals).mockResolvedValue([{ date: "2024-01-20" }]);

    const { result } = renderHook(() => useSignals(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ date: "2024-01-20" }]);
  });
});
