import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useFundDetail } from "./useFund";

vi.mock("@/lib/api", () => ({
  api: { getFundDetailMerged: vi.fn() },
}));

import { api } from "@/lib/api";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const mockMerged = {
  detail: { code: "000001", name: "Test Fund", latest_nav: 1.5, daily_change: 0.5 },
  nav: [{ date: "2024-01-01", netvalue: 1.0 }],
  signals: [{ date: "2024-01-03", signal_type: "buy", fund_code: "000001", fund_name: "Test Fund", strategy_name: "test", confidence: 0.75, daily_change: 0.5 }],
  strategies: [{ name: "test", description: "Test strategy", enabled: true }],
};

describe("useFundDetail", () => {
  it("returns merged fund detail on success", async () => {
    vi.mocked(api.getFundDetailMerged).mockResolvedValue(mockMerged);

    const { result } = renderHook(() => useFundDetail("000001"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockMerged);
    expect(result.current.data?.detail.code).toBe("000001");
    expect(result.current.data?.nav).toHaveLength(1);
    expect(result.current.data?.signals).toHaveLength(1);
    expect(result.current.data?.strategies).toHaveLength(1);
  });

  it("is not enabled when code is empty", () => {
    const { result } = renderHook(() => useFundDetail(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });
});
