import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// 并行端点：基金信息 + 净值 + 持久化信号 + 策略状态（不调用 /detail）
type FetchMock = {
  mockImplementation(fn: (input: RequestInfo | URL) => Promise<Response>): unknown;
};

function mockDetailApi(
  fetchSpy: FetchMock,
  overrides: Partial<{ fund: FundDetailType; nav: NavPoint[]; signals: SignalResponse[]; strategies: StrategyState[] }> = {},
) {
  const fund = overrides.fund ?? mockFund;
  const nav = overrides.nav ?? mockNav;
  const signals = overrides.signals ?? mockSignals;
  const strategies = overrides.strategies ?? mockStrategies;
  const qdiiPredict = {
    code: "000001",
    t1_value: 1.24,
    t1_date: "2024-01-02",
    t0_value: 1.235,
    t0_date: "2024-01-01",
  };
  fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/funds/000001/nav")) return json(nav);
    if (url.includes("/api/signals")) return json(signals);
    if (url.includes("/api/funds/000001/strategies")) return json(strategies);
    if (url.includes("/api/funds/000001")) return json(fund);
    if (url.includes("/api/qdii/")) return json(qdiiPredict);
    return json({ detail: "not found" }, 404);
  });
}

describe("FundDetail", () => {
  it("shows loading skeleton initially", () => {
    const { container } = render(<FundDetail />, { wrapper: createWrapper("000001") });
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
    mockDetailApi(fetchSpy);

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
    mockDetailApi(fetchSpy);

    render(<FundDetail />, { wrapper: createWrapper("000001") });

    await waitFor(() => {
      expect(screen.getByText("历史信号")).toBeInTheDocument();
    });
    const matches = screen.getAllByText("indicator_cross");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2024-01-03")).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it("renders strategies sidebar", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    mockDetailApi(fetchSpy);

    render(<FundDetail />, { wrapper: createWrapper("000001") });

    await waitFor(() => {
      expect(screen.getByText("运行策略")).toBeInTheDocument();
    });

    fetchSpy.mockRestore();
  });

  it("shows empty signals text when no signals", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    mockDetailApi(fetchSpy, { signals: [] });

    render(<FundDetail />, { wrapper: createWrapper("000001") });

    await waitFor(() => {
      expect(screen.getByText("暂无历史信号")).toBeInTheDocument();
    });

    fetchSpy.mockRestore();
  });

  it("renders backtest entry link", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    mockDetailApi(fetchSpy);

    render(<FundDetail />, { wrapper: createWrapper("000001") });

    await waitFor(() => {
      expect(screen.getByText("测试基金A")).toBeInTheDocument();
    });
    const link = screen.getByRole("link", { name: "回测" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/funds/000001/backtest");

    fetchSpy.mockRestore();
  });

  it("quick range switch updates chart data range and range stats", async () => {
    const fullNav: NavPoint[] = Array.from({ length: 130 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 1 + i));
      return { date: d.toISOString().slice(0, 10), netvalue: Number((1 + i * 0.01).toFixed(4)) };
    });
    const signals: SignalResponse[] = [
      { ...mockSignals[0], date: fullNav[5].date },
      { ...mockSignals[0], date: fullNav[125].date, signal_type: "sell" },
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    mockDetailApi(fetchSpy, { nav: fullNav, signals });

    render(<FundDetail />, { wrapper: createWrapper("000001") });

    await waitFor(() => {
      expect(screen.getByTestId("range-stats")).toBeInTheDocument();
    });
    // 默认全部：区间涨跌 +129.00%，区间信号数 2
    expect(screen.getByTestId("range-return").textContent).toBe("+129.00%");
    expect(screen.getByTestId("range-signal-count").textContent).toBe("2");
    expect(screen.getByTestId("chart-date-range").textContent).toContain(fullNav[0].date);

    // 切换近1月 → 主图数据范围与区间统计联动
    fireEvent.click(screen.getByRole("button", { name: "近1月" }));

    await waitFor(() => {
      expect(screen.getByTestId("range-return").textContent).not.toBe("+129.00%");
    });
    expect(screen.getByTestId("range-signal-count").textContent).toBe("1");
    expect(screen.getByTestId("chart-date-range").textContent).toContain(fullNav[109].date);

    fetchSpy.mockRestore();
  });

  describe("QDII Prediction", () => {
    const qdiiFund = { ...mockFund, type: "QDII", name: "QDII测试基金" };

    it("shows prediction card for QDII funds", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      mockDetailApi(fetchSpy, { fund: qdiiFund });

      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await screen.findByText("QDII测试基金", undefined, { timeout: 5000 });
      const cardOrError = await screen.findByTestId(/^qdii-/, undefined, { timeout: 5000 });
      expect(cardOrError).toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it("hides prediction for non-QDII funds", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      mockDetailApi(fetchSpy);

      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => {
        expect(screen.getByText(mockFund.name)).toBeInTheDocument();
      });
      expect(screen.queryByText("QDII 净值预测")).not.toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it("shows error state on QDII prediction failure", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      mockDetailApi(fetchSpy, { fund: qdiiFund });
      fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/qdii/")) return json({ detail: "error" }, 502);
        if (url.includes("/api/funds/000001/nav")) return json(mockNav);
        if (url.includes("/api/signals")) return json(mockSignals);
        if (url.includes("/api/funds/000001/strategies")) return json(mockStrategies);
        if (url.includes("/api/funds/000001")) return json(qdiiFund);
        return json({ detail: "not found" }, 404);
      });

      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => {
        expect(screen.getByText("预测数据暂时不可用")).toBeInTheDocument();
      });

      fetchSpy.mockRestore();
    });
  });
});
