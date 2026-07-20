import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Strategies } from "./Strategies";

const mockStrategies = [
  {
    name: "indicator_cross",
    description: "均线交叉策略",
    params_schema: {
      short_window: { type: "int", default: 5, description: "短期均线窗口" },
      long_window: { type: "int", default: 20, description: "长期均线窗口" },
    },
    enabled: true,
  },
  {
    name: "rsi_strategy",
    description: "RSI 超买超卖策略",
    params_schema: {
      period: { type: "int", default: 14, description: "RSI 周期" },
    },
    enabled: false,
  },
];

const mockLogs = [
  { timestamp: "2024-01-20 10:00:00", message: "策略已注册: indicator_cross" },
  { timestamp: "2024-01-20 10:01:00", message: "策略已启用: indicator_cross" },
];

vi.mock("@/lib/api", () => ({
  api: {
    getStrategies: vi.fn(),
    toggleStrategy: vi.fn(),
    getStrategyLogs: vi.fn(),
  },
}));

import { api } from "@/lib/api";

function renderStrategies() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Strategies />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Strategies Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton", () => {
    vi.mocked(api.getStrategies).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.getStrategyLogs).mockReturnValue(new Promise(() => {}));
    renderStrategies();
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders page title", async () => {
    vi.mocked(api.getStrategies).mockResolvedValueOnce(mockStrategies);
    vi.mocked(api.getStrategyLogs).mockResolvedValueOnce(mockLogs);

    renderStrategies();

    await waitFor(() => {
      expect(screen.getByText("策略管理")).toBeInTheDocument();
    });
  });

  it("renders strategy cards with name, description and params", async () => {
    vi.mocked(api.getStrategies).mockResolvedValueOnce(mockStrategies);
    vi.mocked(api.getStrategyLogs).mockResolvedValueOnce(mockLogs);

    renderStrategies();

    await waitFor(() => {
      expect(screen.getByText("indicator_cross")).toBeInTheDocument();
      expect(screen.getByText("均线交叉策略")).toBeInTheDocument();
    });

    expect(screen.getByText("short_window")).toBeInTheDocument();
    expect(screen.getByText("long_window")).toBeInTheDocument();
  });

  it('shows "已启用" for enabled and "已禁用" for disabled strategies', async () => {
    vi.mocked(api.getStrategies).mockResolvedValueOnce(mockStrategies);
    vi.mocked(api.getStrategyLogs).mockResolvedValueOnce(mockLogs);

    renderStrategies();

    await waitFor(() => {
      expect(screen.getByText("已启用")).toBeInTheDocument();
      expect(screen.getByText("已禁用")).toBeInTheDocument();
    });
  });

  it("renders logs panel with log entries", async () => {
    vi.mocked(api.getStrategies).mockResolvedValueOnce(mockStrategies);
    vi.mocked(api.getStrategyLogs).mockResolvedValueOnce(mockLogs);

    renderStrategies();

    await waitFor(() => {
      expect(screen.getByText("运行日志")).toBeInTheDocument();
    });

    expect(screen.getByText(/策略已注册: indicator_cross/)).toBeInTheDocument();
    expect(screen.getByText("2024-01-20 10:00:00")).toBeInTheDocument();
  });

  it("toggles strategy on switch click", async () => {
    vi.mocked(api.getStrategies).mockResolvedValueOnce(mockStrategies);
    vi.mocked(api.getStrategyLogs).mockResolvedValueOnce(mockLogs);
    vi.mocked(api.toggleStrategy).mockResolvedValueOnce({ ...mockStrategies[0], enabled: false });

    renderStrategies();

    await waitFor(() => {
      expect(screen.getByText("indicator_cross")).toBeInTheDocument();
    });

    const toggles = screen.getAllByRole("switch");
    await userEvent.click(toggles[0]);

    await waitFor(() => {
      expect(api.toggleStrategy).toHaveBeenCalledWith("indicator_cross", false);
    });
  });

  it("shows empty state when no strategies registered", async () => {
    vi.mocked(api.getStrategies).mockResolvedValueOnce([]);
    vi.mocked(api.getStrategyLogs).mockResolvedValueOnce([]);

    renderStrategies();

    await waitFor(() => {
      expect(screen.getByText("暂无已注册策略")).toBeInTheDocument();
    });
    expect(screen.getByText("查阅文档")).toBeInTheDocument();
  });

  it("has a link to add strategy documentation", async () => {
    vi.mocked(api.getStrategies).mockResolvedValueOnce(mockStrategies);
    vi.mocked(api.getStrategyLogs).mockResolvedValueOnce(mockLogs);

    renderStrategies();

    await waitFor(() => {
      expect(screen.getByText("添加策略")).toBeInTheDocument();
    });
  });
});
