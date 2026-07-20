import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Watchlists } from "./Watchlists";

function renderWatchlists() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Watchlists />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Watchlists page", () => {
  it("renders loading skeleton", () => {
    vi.spyOn(window, "fetch").mockImplementation(() => new Promise(() => {}));
    renderWatchlists();
    expect(document.querySelectorAll(".skel").length).toBeGreaterThan(0);
  });

  it("renders empty state with CTA button", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText(/开始你的量化信号之旅/i)).toBeInTheDocument();
    });
  });

  it("renders watchlist items with all columns", async () => {
    const items = [
      { code: "CN-AM-001", name: "Alpha 动量", daily_change: 2.31, signal_type: "buy" as const, strategy_name: "动量交叉", confidence: 0.88 },
      { code: "CN-BV-003", name: "Beta 价值", daily_change: -0.45, signal_type: "hold" as const, strategy_name: "价值回归", confidence: 0.52 },
    ];
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(items), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText("CN-AM-001")).toBeInTheDocument();
      expect(screen.getByText("CN-BV-003")).toBeInTheDocument();
    });
    expect(screen.getByText("买入")).toBeInTheDocument();
    expect(screen.getByText("持有")).toBeInTheDocument();
    expect(screen.getByText("+2.31%")).toBeInTheDocument();
    expect(screen.getByText("-0.45%")).toBeInTheDocument();
  });

  it("filters by search query", async () => {
    const items = [
      { code: "CN-AM-001", name: "Alpha 动量", daily_change: 2.31, signal_type: "buy" as const, strategy_name: "动量交叉", confidence: 0.88 },
      { code: "CN-BV-003", name: "Beta 价值", daily_change: -0.45, signal_type: "hold" as const, strategy_name: "价值回归", confidence: 0.52 },
    ];
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(items), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText("CN-AM-001")).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText(/筛选/i);
    fireEvent.change(input, { target: { value: "Beta" } });
    await waitFor(() => {
      expect(screen.queryByText("CN-AM-001")).not.toBeInTheDocument();
      expect(screen.getByText("CN-BV-003")).toBeInTheDocument();
    });
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => {
      expect(screen.getByText("CN-AM-001")).toBeInTheDocument();
    });
  });

  it("shows no-results when search has no match", async () => {
    const items = [
      { code: "CN-AM-001", name: "Alpha 动量", daily_change: 2.31, signal_type: "buy" as const, strategy_name: "动量交叉", confidence: 0.88 },
    ];
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(items), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText("CN-AM-001")).toBeInTheDocument();
    });
    const input = screen.getByPlaceholderText(/筛选/i);
    fireEvent.change(input, { target: { value: "zzz" } });
    await waitFor(() => {
      expect(screen.getByText(/无匹配结果/i)).toBeInTheDocument();
    });
  });

  it("removes a fund on confirm", async () => {
    const items = [
      { code: "CN-AM-001", name: "Alpha 动量", daily_change: 2.31, signal_type: "buy" as const, strategy_name: "动量交叉", confidence: 0.88 },
    ];
    const fetchMock = vi.spyOn(window, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(items), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    fetchMock.mockResolvedValueOnce(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText("CN-AM-001")).toBeInTheDocument();
    });
    const removeBtn = screen.getByRole("button", { name: /移除/i });
    fireEvent.click(removeBtn);
    expect(screen.getByRole("button", { name: /确认/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /确认/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/funds/CN-AM-001", { method: "DELETE" });
    });
  });

  it("renders error state with retry", async () => {
    vi.spyOn(window, "fetch").mockRejectedValue(new Error("Network error"));
    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText(/数据加载失败/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /重试/i })).toBeInTheDocument();
    });
  });

  it("searches and adds a fund via dropdown", async () => {
    const items: { code: string; name: string; daily_change: number; signal_type: "buy"; strategy_name: string; confidence: number }[] = [];
    const fetchMock = vi.spyOn(window, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(items), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText(/添加基金/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /添加基金/i }));
    expect(screen.getByPlaceholderText(/搜索基金代码或名称/i)).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ code: "CN-AM-001", name: "Alpha 动量", type: "股票型" }]), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const addSearchInput = screen.getByPlaceholderText(/搜索基金代码或名称/i);
    fireEvent.change(addSearchInput, { target: { value: "Alpha" } });
    await waitFor(() => {
      expect(screen.getByText("CN-AM-001")).toBeInTheDocument();
    });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "CN-AM-001" }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ code: "CN-AM-001", name: "Alpha 动量", daily_change: 2.31, signal_type: "buy", strategy_name: "动量交叉", confidence: 0.88 }]), { status: 200 }),
    );
    fireEvent.click(screen.getByText("Alpha 动量"));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/funds", expect.objectContaining({ method: "POST" }));
    });
  });
});
