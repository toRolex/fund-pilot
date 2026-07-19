import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FundDetail } from "./FundDetail";
import type { FundDetail as FundDetailType, NavPoint, SignalResponse, StrategyState } from "@/types";

function createWrapper(code: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/funds/${code}`]}>
          <Routes>
            <Route path="/funds/:code" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const mockFund: FundDetailType = {
  code: "000001",
  name: "测试基金A",
  type: "股票型",
  scale: 12.5,
  established_date: "2020-01-01",
  latest_nav: 1.2345,
  latest_nav_date: "2024-06-01",
  daily_change: 0.56,
};

const mockNav: NavPoint[] = [
  { date: "2024-01-01", netvalue: 1.0 },
  { date: "2024-01-02", netvalue: 1.02 },
  { date: "2024-01-03", netvalue: 1.01 },
];

const mockSignals: SignalResponse[] = [
  {
    date: "2024-01-03",
    fund_code: "000001",
    fund_name: "测试基金A",
    strategy_name: "indicator_cross",
    signal_type: "buy",
    confidence: 0.75,
    daily_change: 0.56,
  },
];

const mockStrategies: StrategyState[] = [
  { name: "indicator_cross", description: "均线交叉策略", enabled: true },
];

describe("FundDetail", () => {
  it("shows loading skeleton initially", () => {
    const { container } = render(<FundDetail />, { wrapper: createWrapper("000001") });
    // Loading skeleton has animate-pulse class
    const skeleton = container.querySelector(".animate-pulse");
    expect(skeleton).toBeInTheDocument();
  });

  it("shows not found when 404", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockRejectedValue(new Error("API error: 404"));

    render(<FundDetail />, { wrapper: createWrapper("999999") });
    await waitFor(() => {
      expect(screen.getByText(/基金 999999 不存在/)).toBeInTheDocument();
    });

    fetchSpy.mockRestore();
  });

  it("renders fund name and meta info", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(mockFund), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockNav), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockSignals), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockStrategies), { status: 200 }));

    render(<FundDetail />, { wrapper: createWrapper("000001") });

    await waitFor(() => {
      expect(screen.getByText("测试基金A")).toBeInTheDocument();
    });
    expect(screen.getByText("000001")).toBeInTheDocument();
    expect(screen.getByText("1.2345")).toBeInTheDocument();
    expect(screen.getByText("12.5亿")).toBeInTheDocument();
    expect(screen.getByText("2020-01-01")).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it("renders signal table", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(mockFund), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockNav), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockSignals), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockStrategies), { status: 200 }));

    render(<FundDetail />, { wrapper: createWrapper("000001") });

    await waitFor(() => {
      expect(screen.getByText("历史信号")).toBeInTheDocument();
    });
    // indicator_cross appears in two columns (策略 + 策略详情)
    const matches = screen.getAllByText("indicator_cross");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2024-01-03")).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it("renders strategies sidebar", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(mockFund), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockNav), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockSignals), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockStrategies), { status: 200 }));

    render(<FundDetail />, { wrapper: createWrapper("000001") });

    await waitFor(() => {
      expect(screen.getByText("运行策略")).toBeInTheDocument();
    });

    fetchSpy.mockRestore();
  });

  it("shows empty signals text when no signals", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(mockFund), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockNav), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(mockStrategies), { status: 200 }));

    render(<FundDetail />, { wrapper: createWrapper("000001") });

    await waitFor(() => {
      expect(screen.getByText("暂无历史信号")).toBeInTheDocument();
    });

    fetchSpy.mockRestore();
  });
});
