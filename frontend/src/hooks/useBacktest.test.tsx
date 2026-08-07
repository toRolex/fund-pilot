import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useBacktest } from "./useBacktest";
import type { BacktestApiResponse } from "@/types";

vi.mock("@/lib/api", () => ({
  api: { runBacktest: vi.fn() },
}));

import { api } from "@/lib/api";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

// Backend real schema: metrics.total_trades + equity_curve[].total_value
const mockRaw: BacktestApiResponse = {
  metrics: {
    total_return: 0.1523,
    annualized_return: 0.0891,
    max_drawdown: -0.124,
    win_rate: 0.611,
    sharpe_ratio: 1.34,
    total_trades: 18,
  },
  trades: [
    { date: "2024-01-10", type: "buy", price: 1.05, shares: 3000, amount: 3150 },
    { date: "2024-01-20", type: "sell", price: 1.12, shares: 3000, amount: 3360 },
  ],
  equity_curve: [
    { date: "2024-01-01", total_value: 1.0 },
    { date: "2024-01-02", total_value: 1.01 },
  ],
};

const params = {
  fund_code: "110011",
  strategy: "indicator_cross",
  params: {},
  start_date: "2024-01-01",
  end_date: "2024-12-31",
};

describe("useBacktest", () => {
  it("maps backend total_trades into metrics.total_trades", async () => {
    vi.mocked(api.runBacktest).mockResolvedValue(mockRaw);

    const { result } = renderHook(() => useBacktest(), { wrapper: createWrapper() });

    result.current.mutate(params);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.metrics.total_trades).toBe(18);
  });

  it("maps backend equity_curve[].total_value into equity[].value", async () => {
    vi.mocked(api.runBacktest).mockResolvedValue(mockRaw);

    const { result } = renderHook(() => useBacktest(), { wrapper: createWrapper() });

    result.current.mutate(params);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.equity).toEqual([
      { date: "2024-01-01", value: 1.0 },
      { date: "2024-01-02", value: 1.01 },
    ]);
  });
});
