import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Holdings } from "./Holdings";

const mockHoldings = [
  {
    fund_code: "000001",
    fund_name: "测试基金A",
    shares: 1000,
    cost_price: 1.25,
    current_value: 1.35,
    cost_basis: 1250,
    pl_amount: 100,
    pl_percent: 8.0,
    has_signal: true,
  },
  {
    fund_code: "110001",
    fund_name: "测试基金B",
    shares: 500,
    cost_price: 2.0,
    current_value: 1.8,
    cost_basis: 1000,
    pl_amount: -100,
    pl_percent: -10.0,
    has_signal: false,
  },
];

function renderHoldings() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Holdings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Holdings page", () => {
  it("renders loading skeleton", () => {
    vi.spyOn(window, "fetch").mockImplementation(() => new Promise(() => {}));
    renderHoldings();
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders empty state with guidance and import button", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderHoldings();
    await waitFor(() => {
      expect(screen.getByText(/暂无持仓数据/)).toBeInTheDocument();
    });
    const importButtons = screen.getAllByText(/导入持仓/);
    expect(importButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders holdings from API", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockHoldings), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderHoldings();
    await waitFor(() => {
      expect(screen.getByText("000001")).toBeInTheDocument();
      expect(screen.getByText("110001")).toBeInTheDocument();
    });
    expect(screen.getByText("测试基金A")).toBeInTheDocument();
    expect(screen.getByText("测试基金B")).toBeInTheDocument();
  });

  it("shows green P&L for positive and red for negative", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockHoldings), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderHoldings();
    await waitFor(() => {
      // Positive P&L should have emerald text
      const positiveCells = screen.getAllByText("+100.00");
      expect(positiveCells.length).toBeGreaterThan(0);
      positiveCells.forEach((el) => {
        expect(el.className).toContain("emerald");
      });
      // Negative P&L should have red text
      const negativeCells = screen.getAllByText("-100.00");
      expect(negativeCells.length).toBeGreaterThan(0);
      negativeCells.forEach((el) => {
        expect(el.className).toContain("red");
      });
    });
  });

  it("shows signal badge for funds with active signals", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockHoldings), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderHoldings();
    await waitFor(() => {
      const signals = screen.getAllByText("信号");
      // "信号" appears as both a column header and badge content
      const badges = signals.filter((el) => el.className.includes("emerald"));
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows error state with retry", async () => {
    vi.spyOn(window, "fetch").mockRejectedValue(new Error("Network error"));
    renderHoldings();
    await waitFor(() => {
      expect(screen.getByText(/加载失败/)).toBeInTheDocument();
    });
  });

  it("has import button in the header", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockHoldings), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderHoldings();
    await waitFor(() => {
      const importButtons = screen.getAllByText("导入持仓");
      expect(importButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("has sample CSV download button", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockHoldings), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderHoldings();
    await waitFor(() => {
      expect(screen.getByText("示例")).toBeInTheDocument();
    });
  });

  it("renders file input hidden", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderHoldings();
    await waitFor(() => {
      expect(screen.getByText(/暂无持仓数据/)).toBeInTheDocument();
    });
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveClass("hidden");
  });
});
