import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useFundSignals } from "./useFund";

vi.mock("@/lib/api", () => ({
  api: { getFundSignals: vi.fn() },
}));

import { api } from "@/lib/api";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useFundSignals", () => {
  it("returns fund signals on success", async () => {
    vi.mocked(api.getFundSignals).mockResolvedValue([
      { date: "2024-01-20", signal_type: "buy" },
    ]);

    const { result } = renderHook(() => useFundSignals("000001"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ date: "2024-01-20", signal_type: "buy" }]);
  });
});
