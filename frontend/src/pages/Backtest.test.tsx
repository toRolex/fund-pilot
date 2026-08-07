import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Backtest } from "./Backtest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  api: {
    getStrategies: vi.fn(),
    runBacktest: vi.fn(),
  },
}));

import { api } from "@/lib/api";

const mockStrategies = [
  {
    name: "indicator_cross",
    description: "均线交叉策略：短期均线上穿长期均线买入，下穿卖出",
    params_schema: {
      short_window: { type: "int", default: 5, description: "短期均线窗口" },
      long_window: { type: "int", default: 20, description: "长期均线窗口" },
    },
    enabled: true,
  },
  {
    name: "pe_percentile",
    description: "PE 百分位策略：PE 处于历史低位买入，高位卖出",
    params_schema: {
      low_pct: { type: "float", default: 0.2, description: "低估阈值" },
      high_pct: { type: "float", default: 0.8, description: "高估阈值" },
    },
    enabled: true,
  },
  {
    name: "grid",
    description: "网格策略：价格在网格区间内穿越网格线时触发买入/卖出",
    params_schema: {
      low: { type: "float", required: true, description: "网格下界" },
      high: { type: "float", required: true, description: "网格上界" },
      n_grids: { type: "int", default: 10, description: "网格分段数" },
    },
    enabled: true,
  },
  {
    name: "momentum",
    description: "动量轮动策略：按 N 日收益率排名多只基金，rank_1 持有、rank_2+ 观望",
    params_schema: {
      n_days: { type: "int", default: 20, description: "回看天数" },
    },
    enabled: true,
  },
];

const mockApiResult = {
  metrics: {
    total_return: 0.1523,
    annualized_return: 0.0891,
    max_drawdown: -0.124,
    win_rate: 0.611,
    sharpe_ratio: 1.34,
    trade_count: 18,
  },
  trades: [
    { date: "2024-01-10", type: "buy", price: 1.05, shares: 3000, amount: 3150 },
    { date: "2024-01-20", type: "sell", price: 1.12, shares: 3000, amount: 3360 },
  ],
  equity_curve: [
    { date: "2024-01-01", equity: 1.0 },
    { date: "2024-01-02", equity: 1.01 },
  ],
};

function createQueryWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function renderBacktest(code = "000001") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/funds/${code}/backtest`]}>
        <Routes>
          <Route path="/funds/:code/backtest" element={<Backtest />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Wait for strategies to load so the select has real options */
async function waitForStrategies() {
  await screen.findByText(/均线交叉策略/);
}

describe("Backtest", () => {
  beforeEach(() => {
    vi.mocked(api.getStrategies).mockReset();
    vi.mocked(api.runBacktest).mockReset();
    vi.mocked(api.getStrategies).mockResolvedValue(mockStrategies);
    vi.mocked(api.runBacktest).mockResolvedValue(mockApiResult);
  });

  it("renders the strategy dropdown with options from API", async () => {
    renderBacktest();
    await waitForStrategies();
    const select = screen.getByRole("combobox", { name: /策略/i });
    expect(select).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveValue("indicator_cross");
    expect(options[1]).toHaveValue("pe_percentile");
    expect(options[2]).toHaveValue("grid");
    expect(screen.queryByText("momentum")).not.toBeInTheDocument();
  });

  it("filters the multi-fund momentum strategy out of the strategy dropdown", async () => {
    renderBacktest();
    await waitForStrategies();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options.map((o) => o as HTMLOptionElement).map((o) => o.value)).toEqual([
      "indicator_cross",
      "pe_percentile",
      "grid",
    ]);
    expect(screen.queryByRole("option", { name: "momentum" })).not.toBeInTheDocument();
  });

  it("shows empty state in the result area initially", async () => {
    renderBacktest();
    expect(await screen.findByText(/在左侧面板配置策略后运行回测/)).toBeInTheDocument();
  });

  it("displays the back link with fund code", async () => {
    renderBacktest("000001");
    const link = await screen.findByRole("link", { name: /返回基金详情/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/funds/000001");
  });

  it("shows the strategy description when a strategy is selected", async () => {
    renderBacktest();
    expect(await screen.findByText(/均线交叉策略/)).toBeInTheDocument();
  });

  it("updates param form when switching strategies", async () => {
    renderBacktest();
    await waitForStrategies();
    const select = screen.getByRole("combobox", { name: /策略/i });
    await userEvent.selectOptions(select, "pe_percentile");
    expect(await screen.findByText(/PE 百分位策略/)).toBeInTheDocument();
    expect(screen.getByText(/低估阈值/)).toBeInTheDocument();
  });

  it("has date range inputs", async () => {
    renderBacktest();
    const dateInputs = await screen.findAllByDisplayValue(/2024/);
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("shows loading state when backtest is running", async () => {
    // never resolve so we can capture loading state
    vi.mocked(api.runBacktest).mockImplementation(() => new Promise(() => {}));
    renderBacktest();
    await waitForStrategies();
    const button = screen.getByRole("button", { name: /运行回测/ });
    await userEvent.click(button);
    // "运行中..." appears on the button, "回测运行中..." in the spinner row
    await waitFor(() => {
      expect(screen.getByText("回测运行中...")).toBeInTheDocument();
    });
    expect(button).toBeDisabled();
  });

  it("shows result metrics after running backtest", async () => {
    renderBacktest();
    await waitForStrategies();
    const button = screen.getByRole("button", { name: /运行回测/ });
    await userEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText(/总收益/)).toBeInTheDocument();
    });
    expect(screen.getByText("15.23%")).toBeInTheDocument();
    expect(screen.getByText("8.91%")).toBeInTheDocument();
  });

  it("shows trade table after running backtest", async () => {
    renderBacktest();
    await waitForStrategies();
    const button = screen.getByRole("button", { name: /运行回测/ });
    await userEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText(/交易记录/)).toBeInTheDocument();
    });
    expect(screen.getByText("2024-01-10")).toBeInTheDocument();
    expect(screen.getByText("2024-01-20")).toBeInTheDocument();
  });

  it("shows equity chart after running backtest", async () => {
    renderBacktest();
    await waitForStrategies();
    const button = screen.getByRole("button", { name: /运行回测/ });
    await userEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText("净值曲线")).toBeInTheDocument();
    });
  });

  it("shows error state when API call fails", async () => {
    vi.mocked(api.runBacktest).mockRejectedValue(new Error("服务器错误"));
    renderBacktest();
    await waitForStrategies();
    const button = screen.getByRole("button", { name: /运行回测/ });
    await userEvent.click(button);
    // error text appears in both left alert and right ErrorState
    await waitFor(() => {
      expect(screen.getAllByText("服务器错误").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows retry button on error and retries", async () => {
    vi.mocked(api.runBacktest)
      .mockRejectedValueOnce(new Error("服务器错误"))
      .mockResolvedValueOnce(mockApiResult);
    renderBacktest();
    await waitForStrategies();
    const button = screen.getByRole("button", { name: /运行回测/ });
    await userEvent.click(button);
    // ErrorState has a "重试" button, the left panel also has one
    await waitFor(() => {
      const retries = screen.getAllByRole("button", { name: /重试/ });
      expect(retries.length).toBeGreaterThanOrEqual(1);
    });
    const retry = screen.getAllByRole("button", { name: /重试/ })[0];
    await userEvent.click(retry);
    await waitFor(() => {
      expect(screen.getByText(/总收益/)).toBeInTheDocument();
    });
  });

  it("shows empty trades hint when no trades", async () => {
    vi.mocked(api.runBacktest).mockResolvedValue({
      ...mockApiResult,
      trades: [],
      metrics: { ...mockApiResult.metrics, trade_count: 0 },
    });
    renderBacktest();
    await waitForStrategies();
    const button = screen.getByRole("button", { name: /运行回测/ });
    await userEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText("暂无交易记录")).toBeInTheDocument();
    });
  });

  it("calls runBacktest with correct params", async () => {
    renderBacktest("110011");
    await waitForStrategies();
    const button = screen.getByRole("button", { name: /运行回测/ });
    await userEvent.click(button);
    await waitFor(() => {
      expect(api.runBacktest).toHaveBeenCalledWith({
        fund_code: "110011",
        strategy: "indicator_cross",
        params: {},
        start_date: "2024-01-01",
        end_date: "2024-12-31",
      });
    });
  });

  it("refetches strategies from API on mount", async () => {
    renderBacktest();
    await waitFor(() => {
      expect(api.getStrategies).toHaveBeenCalled();
    });
  });
});
