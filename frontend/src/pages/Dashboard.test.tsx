import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    expect(document.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders signal summary and table with data", async () => {
    vi.mocked(api.getSignals).mockResolvedValueOnce(mockSignals);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("测试基金A")).toBeInTheDocument();
    });

    // Summary stats and badge both exist
    expect(screen.getAllByText("买入").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("卖出").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("基金代码")).toBeInTheDocument();
  });

  it("shows empty state when no signals", async () => {
    vi.mocked(api.getSignals).mockResolvedValueOnce([]);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/暂无信号/)).toBeInTheDocument();
    });
  });

  it("shows error state and retry button", async () => {
    vi.mocked(api.getSignals).mockRejectedValueOnce(new Error("fail"));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/加载失败/)).toBeInTheDocument();
    });

    expect(screen.getByText("重试")).toBeInTheDocument();
  });
});
