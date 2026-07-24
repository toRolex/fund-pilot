import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Dashboard } from "./Dashboard";

const mockSignals = [
  {
    date: "2024-01-20",
    fund_code: "000001",
    fund_name: "测试基金A",
    strategy_name: "indicator_cross",
    signal_type: "buy" as const,
    confidence: 0.85,
    daily_change: 0.5,
  },
  {
    date: "2024-01-20",
    fund_code: "110001",
    fund_name: "测试基金B",
    strategy_name: "indicator_cross",
    signal_type: "sell" as const,
    confidence: 0.72,
    daily_change: -0.3,
  },
];

vi.mock("@/lib/api", () => ({
  api: {
    getSignals: vi.fn(),
    getStrategies: vi.fn(),
    runSignals: vi.fn(),
  },
}));

import { api } from "@/lib/api";

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Dashboard", () => {
  it("shows loading skeleton initially", () => {
    vi.mocked(api.getSignals).mockImplementationOnce(() => new Promise(() => {}));
    renderDashboard();
    expect(screen.getByText("信号仪表盘")).toBeInTheDocument();
    expect(document.querySelector(".skel")).toBeTruthy();
  });

  it("renders signal summary and table with data", async () => {
    vi.mocked(api.getSignals).mockResolvedValueOnce(mockSignals);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("测试基金A")).toBeInTheDocument();
    });

    // Stat badges
    expect(screen.getAllByText("买入").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("卖出").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("持有").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/共 2 只基金/)).toBeInTheDocument();

    // Table headers
    expect(screen.getByText("代码")).toBeInTheDocument();
    expect(screen.getByText("最新信号")).toBeInTheDocument();
    expect(screen.getByText("置信度")).toBeInTheDocument();
  });

  it("shows empty state when no signals", async () => {
    vi.mocked(api.getSignals).mockResolvedValueOnce([]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("暂无信号数据")).toBeInTheDocument();
    });
  });

  it("shows error state and retry button", async () => {
    vi.mocked(api.getSignals).mockRejectedValueOnce(new Error("fail"));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("数据加载失败")).toBeInTheDocument();
    });

    expect(screen.getByText("重试")).toBeInTheDocument();
  });

  describe("manual signal button", () => {
    it("renders idle button and calls runSignals on click", async () => {
      vi.mocked(api.getSignals).mockResolvedValue(mockSignals);
      vi.mocked(api.runSignals).mockResolvedValue({ status: "ok" });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("测试基金A")).toBeInTheDocument();
      });

      const btn = screen.getByRole("button", { name: /运行信号/ });
      expect(btn).not.toBeDisabled();

      fireEvent.click(btn);

      await waitFor(() => {
        expect(vi.mocked(api.runSignals)).toHaveBeenCalledTimes(1);
      });
    });

    it("shows disabled loading state while running", async () => {
      vi.mocked(api.getSignals).mockResolvedValue(mockSignals);
      vi.mocked(api.runSignals).mockImplementation(() => new Promise(() => {}));

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("测试基金A")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /运行信号/ }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /运行中/ })).toBeDisabled();
      });
    });

    it("refetches signals on success", async () => {
      const getSignals = vi.mocked(api.getSignals).mockResolvedValue(mockSignals);
      vi.mocked(api.runSignals).mockResolvedValue({ status: "ok" });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("测试基金A")).toBeInTheDocument();
      });

      getSignals.mockClear();
      getSignals.mockResolvedValue(mockSignals);

      fireEvent.click(screen.getByRole("button", { name: /运行信号/ }));

      await waitFor(() => {
        expect(getSignals).toHaveBeenCalled();
      });
    });

    it("shows error feedback on failure", async () => {
      vi.mocked(api.getSignals).mockResolvedValue(mockSignals);
      vi.mocked(api.runSignals).mockRejectedValue(new Error("fail"));

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("测试基金A")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /运行信号/ }));

      await waitFor(() => {
        expect(screen.getByText(/信号运行失败/)).toBeInTheDocument();
      });

      // Button is clickable again
      expect(screen.getByRole("button", { name: /运行信号/ })).not.toBeDisabled();
    });
  });
});
