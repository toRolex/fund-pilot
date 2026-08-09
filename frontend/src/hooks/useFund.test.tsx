import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useFundDetail } from "./useFund";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const mockDetail = {
  code: "000001",
  name: "Test Fund",
  type: "股票型",
  scale: 12.5,
  established_date: "2020-01-01",
  latest_nav: 1.5,
  latest_nav_date: "2024-06-01",
  daily_change: 0.5,
};
const mockNav = [
  { date: "2024-01-01", netvalue: 1.0 },
  { date: "2024-01-02", netvalue: 1.02 },
];
const mockSignals = [
  { date: "2024-01-03", signal_type: "buy", fund_code: "000001", fund_name: "Test Fund", strategy_name: "test", confidence: 0.75, daily_change: 0.5 },
];
const mockStrategies = [{ name: "test", description: "Test strategy", enabled: true }];

function mockParallelEndpoints() {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  const calls: string[] = [];
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/api/funds/000001/nav")) {
      return new Response(JSON.stringify(mockNav), { status: 200 });
    }
    if (url.includes("/api/signals")) {
      return new Response(JSON.stringify(mockSignals), { status: 200 });
    }
    if (url.includes("/api/funds/000001/strategies")) {
      return new Response(JSON.stringify(mockStrategies), { status: 200 });
    }
    if (url.includes("/api/funds/000001")) {
      return new Response(JSON.stringify(mockDetail), { status: 200 });
    }
    return new Response(JSON.stringify({ detail: "not found" }), { status: 404 });
  });
  return { fetchMock, calls };
}

describe("useFundDetail", () => {
  it("fetches detail, nav, signals and strategies in parallel without /detail", async () => {
    const { fetchMock, calls } = mockParallelEndpoints();

    const { result } = renderHook(() => useFundDetail("000001"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.detail.code).toBe("000001");
    expect(result.current.data?.nav).toHaveLength(2);
    expect(result.current.data?.signals).toHaveLength(1);
    expect(result.current.data?.strategies).toHaveLength(1);

    expect(calls).toContain("/api/funds/000001");
    expect(calls).toContain("/api/funds/000001/nav");
    expect(calls).toContain("/api/signals?fund_code=000001&all_history=true");
    expect(calls).toContain("/api/funds/000001/strategies");
    // 不再依赖现算合并端点
    expect(calls.some((u) => u.includes("/detail"))).toBe(false);

    fetchMock.mockRestore();
  });

  it("is not enabled when code is empty", () => {
    const { result } = renderHook(() => useFundDetail(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });
});
