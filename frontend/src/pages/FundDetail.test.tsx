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

  describe("Strategy panel (T5)", () => {
    const fullNav: NavPoint[] = Array.from({ length: 130 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 1 + i));
      return { date: d.toISOString().slice(0, 10), netvalue: Number((1 + i * 0.01).toFixed(4)) };
    });

    const allOff: StrategyState[] = [
      { name: "indicator_cross", description: "均线交叉策略", enabled: false },
      { name: "pe_percentile", description: "PE 百分位策略", enabled: false },
      { name: "grid", description: "网格策略", enabled: false },
    ];

    function makeSignalsFor(name: string): SignalResponse[] {
      return [
        { date: fullNav[5].date, fund_code: "000001", fund_name: mockFund.name, strategy_name: name, signal_type: "buy", confidence: 0.8, daily_change: 0.5 },
        { date: fullNav[125].date, fund_code: "000001", fund_name: mockFund.name, strategy_name: name, signal_type: "sell", confidence: 0.7, daily_change: 0.3 },
      ];
    }

    // 有状态 mock：enable → POST run（生成信号）；disable → PUT 关；GET /signals 返回当前信号库
    function mockToggleApi(initial: { strategies?: StrategyState[]; signals?: SignalResponse[] } = {}) {
      const strategies: StrategyState[] = initial.strategies ?? allOff;
      const signals: SignalResponse[] = initial.signals ?? [];
      const calls: { url: string; method: string }[] = [];
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ url, method });

        const runMatch = url.match(/\/api\/funds\/000001\/strategies\/([^/]+)\/run$/);
        if (method === "POST" && runMatch) {
          const name = runMatch[1];
          const s = strategies.find((x) => x.name === name);
          if (s) s.enabled = true;
          const gen = makeSignalsFor(name);
          signals.length = 0;
          signals.push(...gen);
          return json(gen);
        }

        const putMatch = url.match(/\/api\/funds\/000001\/strategies\/([^/]+)$/);
        if (method === "PUT" && putMatch) {
          const name = putMatch[1];
          const s = strategies.find((x) => x.name === name);
          if (s) s.enabled = false;
          return json({ name, enabled: false });
        }

        if (url.includes("/api/funds/000001/strategies")) return json(strategies);
        if (url.includes("/api/signals")) return json(signals);
        if (url.includes("/api/funds/000001/nav")) return json(fullNav);
        if (url.includes("/api/qdii/")) return json({ code: "000001", t1_value: 1.24, t1_date: "2024-01-02", t0_value: 1.235, t0_date: "2024-01-01" });
        if (url.includes("/api/funds/000001")) return json(mockFund);
        return json({ detail: "not found" }, 404);
      });
      return { fetchSpy, calls };
    }

    it("renders three non-multi_fund switches, all off, no chart markers", async () => {
      // 信号存在于接口，但策略默认全关 → 图上不打标、信号流为空
      const { fetchSpy } = mockToggleApi({ signals: makeSignalsFor("indicator_cross") });
      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(3));
      screen.getAllByRole("switch").forEach((sw) => expect(sw).toHaveAttribute("aria-checked", "false"));
      expect(screen.queryByTestId(/signal-marker-/)).not.toBeInTheDocument();
      expect(screen.getByText("暂无历史信号")).toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it("enabling a strategy calls run endpoint and shows markers + signal flow", async () => {
      const { fetchSpy, calls } = mockToggleApi();
      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(3));
      fireEvent.click(screen.getByRole("switch", { name: "均线" }));

      await waitFor(() => {
        expect(calls.some((c) => c.method === "POST" && c.url.includes("/strategies/indicator_cross/run"))).toBe(true);
      });
      await waitFor(() => expect(screen.getAllByTestId("signal-marker-buy").length).toBeGreaterThan(0));
      expect(screen.getAllByTestId("signal-marker-sell").length).toBeGreaterThan(0);
      await waitFor(() => expect(screen.getAllByText("indicator_cross").length).toBeGreaterThan(0));

      fetchSpy.mockRestore();
    });

    it("disabling an enabled strategy hides its markers and clears signal flow", async () => {
      const { fetchSpy, calls } = mockToggleApi({
        strategies: [
          { name: "indicator_cross", description: "均线交叉策略", enabled: true },
          { name: "pe_percentile", description: "PE 百分位策略", enabled: false },
          { name: "grid", description: "网格策略", enabled: false },
        ],
        signals: makeSignalsFor("indicator_cross"),
      });
      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => expect(screen.getAllByTestId("signal-marker-buy").length).toBeGreaterThan(0));
      fireEvent.click(screen.getByRole("switch", { name: "均线" }));

      await waitFor(() => {
        expect(calls.some((c) => c.method === "PUT" && c.url.includes("/strategies/indicator_cross"))).toBe(true);
      });
      await waitFor(() => expect(screen.queryAllByTestId(/signal-marker-/)).toHaveLength(0));
      expect(screen.getByText("暂无历史信号")).toBeInTheDocument();
      expect(screen.queryByText("indicator_cross")).not.toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it("shows default params tooltip on hover over a strategy switch", async () => {
      const { fetchSpy } = mockToggleApi();
      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(3));
      expect(screen.queryByTestId("strategy-hint-indicator_cross")).not.toBeInTheDocument();

      fireEvent.mouseEnter(screen.getByTestId("strategy-item-indicator_cross"));
      expect(screen.getByTestId("strategy-hint-indicator_cross")).toHaveTextContent("均线 5/20");

      fetchSpy.mockRestore();
    });

    it("does not render inline parameter forms", async () => {
      const { fetchSpy } = mockToggleApi();
      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(3));
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

      fetchSpy.mockRestore();
    });

    it("reads back persisted enabled state without triggering run", async () => {
      const { fetchSpy, calls } = mockToggleApi({
        strategies: [
          { name: "indicator_cross", description: "均线交叉策略", enabled: true },
          { name: "pe_percentile", description: "PE 百分位策略", enabled: false },
          { name: "grid", description: "网格策略", enabled: false },
        ],
        signals: makeSignalsFor("indicator_cross"),
      });
      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => {
        expect(screen.getByRole("switch", { name: "均线" })).toHaveAttribute("aria-checked", "true");
      });
      // 读回持久化状态，不触发 run
      expect(calls.some((c) => c.method === "POST" && c.url.includes("/run"))).toBe(false);
      expect(screen.getAllByTestId("signal-marker-buy").length).toBeGreaterThan(0);

      fetchSpy.mockRestore();
    });
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

  describe("Keyboard shortcuts (T6)", () => {
    const nav: NavPoint[] = Array.from({ length: 260 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 1 + i));
      return { date: d.toISOString().slice(0, 10), netvalue: Number((1 + i * 0.005).toFixed(4)) };
    });

    const allOff: StrategyState[] = [
      { name: "indicator_cross", description: "均线交叉策略", enabled: false },
      { name: "pe_percentile", description: "PE 百分位策略", enabled: false },
      { name: "grid", description: "网格策略", enabled: false },
    ];

    function makeSignalsFor(name: string): SignalResponse[] {
      return [
        { date: nav[5].date, fund_code: "000001", fund_name: mockFund.name, strategy_name: name, signal_type: "buy", confidence: 0.8, daily_change: 0.5 },
        { date: nav[125].date, fund_code: "000001", fund_name: mockFund.name, strategy_name: name, signal_type: "sell", confidence: 0.7, daily_change: 0.3 },
      ];
    }

    function mockKeyboardApi(initial: { strategies?: StrategyState[]; signals?: SignalResponse[] } = {}) {
      const strategies: StrategyState[] = initial.strategies ?? allOff;
      const signals: SignalResponse[] = initial.signals ?? [];
      const calls: { url: string; method: string }[] = [];
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ url, method });

        const runMatch = url.match(/\/api\/funds\/000001\/strategies\/([^/]+)\/run$/);
        if (method === "POST" && runMatch) {
          const name = runMatch[1];
          const s = strategies.find((x) => x.name === name);
          if (s) s.enabled = true;
          const gen = makeSignalsFor(name);
          signals.length = 0;
          signals.push(...gen);
          return json(gen);
        }

        const putMatch = url.match(/\/api\/funds\/000001\/strategies\/([^/]+)$/);
        if (method === "PUT" && putMatch) {
          const name = putMatch[1];
          const s = strategies.find((x) => x.name === name);
          if (s) s.enabled = false;
          return json({ name, enabled: false });
        }

        if (url.includes("/api/funds/000001/strategies")) return json(strategies);
        if (url.includes("/api/signals")) return json(signals);
        if (url.includes("/api/funds/000001/nav")) return json(nav);
        if (url.includes("/api/qdii/")) return json({ code: "000001", t1_value: 1.24, t1_date: "2024-01-02", t0_value: 1.235, t0_date: "2024-01-01" });
        if (url.includes("/api/funds/000001")) return json(mockFund);
        return json({ detail: "not found" }, 404);
      });
      return { fetchSpy, calls };
    }

    it("shows a visible shortcut help panel with shortcut descriptions", async () => {
      const { fetchSpy } = mockKeyboardApi();
      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => expect(screen.getByTestId("range-stats")).toBeInTheDocument());
      expect(screen.queryByTestId("shortcut-help")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /快捷键/ }));
      const help = screen.getByTestId("shortcut-help");
      expect(help).toBeInTheDocument();
      expect(help.textContent).toContain("平移");
      expect(help.textContent).toContain("近1月");
      expect(help.textContent).toContain("近3月");
      expect(help.textContent).toContain("近半年");
      expect(help.textContent).toContain("近1年");
      expect(help.textContent).toContain("全部");
      expect(help.textContent).toContain("均线");
      expect(help.textContent).toContain("PE");
      expect(help.textContent).toContain("网格");

      fetchSpy.mockRestore();
    });

    it("ArrowLeft/ArrowRight pan the visible chart window", async () => {
      const { fetchSpy } = mockKeyboardApi();
      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => expect(screen.getByTestId("chart-date-range")).toBeInTheDocument());

      // 先切到近1月（窗口 [239, 259]），再向左平移 → [237, 257]
      fireEvent.keyDown(window, { key: "1" });
      await waitFor(() => {
        const range = screen.getByTestId("chart-date-range").textContent ?? "";
        expect(range).toContain(nav[239].date);
        expect(range).toContain(nav[259].date);
      });

      fireEvent.keyDown(window, { key: "ArrowLeft" });
      await waitFor(() => {
        const range = screen.getByTestId("chart-date-range").textContent ?? "";
        expect(range).toContain(nav[237].date);
        expect(range).not.toContain(nav[259].date);
      });

      fireEvent.keyDown(window, { key: "ArrowRight" });
      await waitFor(() => {
        const range = screen.getByTestId("chart-date-range").textContent ?? "";
        expect(range).toContain(nav[259].date);
      });

      fetchSpy.mockRestore();
    });

    it("digits 1-5 switch quick ranges and sync segmented controls", async () => {
      const { fetchSpy } = mockKeyboardApi();
      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => expect(screen.getByTestId("range-stats")).toBeInTheDocument());

      const cases: [string, string, string][] = [
        ["1", "近1月", nav[239].date],
        ["2", "近3月", nav[197].date],
        ["3", "近半年", nav[134].date],
        ["4", "近1年", nav[8].date],
        ["5", "全部", nav[0].date],
      ];

      for (const [key, label, startDate] of cases) {
        fireEvent.keyDown(window, { key });
        await waitFor(() => {
          expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
        });
        await waitFor(() => {
          const range = screen.getByTestId("chart-date-range").textContent ?? "";
          expect(range).toContain(startDate);
        });
      }

      fetchSpy.mockRestore();
    });

    it("E/V/N toggle the three panel strategies via run/disable endpoints", async () => {
      const { fetchSpy, calls } = mockKeyboardApi();
      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(3));
      screen.getAllByRole("switch").forEach((sw) => expect(sw).toHaveAttribute("aria-checked", "false"));

      // E → indicator_cross 开启（run 端点）
      fireEvent.keyDown(window, { key: "e" });
      await waitFor(() => {
        expect(calls.some((c) => c.method === "POST" && c.url.includes("/strategies/indicator_cross/run"))).toBe(true);
      });
      await waitFor(() => expect(screen.getByRole("switch", { name: "均线" })).toHaveAttribute("aria-checked", "true"));

      // V → pe_percentile 开启
      fireEvent.keyDown(window, { key: "v" });
      await waitFor(() => {
        expect(calls.some((c) => c.method === "POST" && c.url.includes("/strategies/pe_percentile/run"))).toBe(true);
      });
      await waitFor(() => expect(screen.getByRole("switch", { name: "PE 估值" })).toHaveAttribute("aria-checked", "true"));

      // N → grid 开启
      fireEvent.keyDown(window, { key: "n" });
      await waitFor(() => {
        expect(calls.some((c) => c.method === "POST" && c.url.includes("/strategies/grid/run"))).toBe(true);
      });
      await waitFor(() => expect(screen.getByRole("switch", { name: "网格" })).toHaveAttribute("aria-checked", "true"));

      // 再次按 E → 关闭（PUT 端点）
      fireEvent.keyDown(window, { key: "e" });
      await waitFor(() => {
        expect(calls.some((c) => c.method === "PUT" && c.url.includes("/strategies/indicator_cross"))).toBe(true);
      });
      await waitFor(() => expect(screen.getByRole("switch", { name: "均线" })).toHaveAttribute("aria-checked", "false"));

      fetchSpy.mockRestore();
    });

    it("ignores shortcuts when typing in an input", async () => {
      const { fetchSpy, calls } = mockKeyboardApi();
      render(<FundDetail />, { wrapper: createWrapper("000001") });

      await waitFor(() => expect(screen.getAllByRole("switch")).toHaveLength(3));
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      fireEvent.keyDown(input, { key: "e" });
      fireEvent.keyDown(input, { key: "1" });

      expect(calls.some((c) => c.method === "POST" && c.url.includes("/run"))).toBe(false);

      input.remove();
      fetchSpy.mockRestore();
    });
  });
});
