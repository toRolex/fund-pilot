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
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders empty state with guidance", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText(/添加你的第一支基金/i)).toBeInTheDocument();
    });
  });

  it("renders funds from API", async () => {
    const funds = [
      { code: "000001", name: "测试基金A", type: "股票型" },
      { code: "110001", name: "测试基金B", type: "混合型" },
    ];
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(funds), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText("000001")).toBeInTheDocument();
      expect(screen.getByText("110001")).toBeInTheDocument();
    });
  });

  it("renders error state with retry", async () => {
    vi.spyOn(window, "fetch").mockRejectedValue(new Error("Network error"));
    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText(/加载失败/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /重试/i })).toBeInTheDocument();
    });
  });

  it("removes a fund on confirm", async () => {
    const funds = [{ code: "000001", name: "测试基金A", type: "股票型" }];
    const fetchMock = vi.spyOn(window, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(funds), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    // Refetch after invalidate
    fetchMock.mockResolvedValueOnce(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText("000001")).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole("button", { name: /删除/i });
    fireEvent.click(removeBtn);

    expect(screen.getByRole("button", { name: /确认/i })).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /确认/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/funds/000001", { method: "DELETE" });
    });
  });

  it("sorts by column click", async () => {
    const funds = [
      { code: "000001", name: "A基金", type: "股票型" },
      { code: "110001", name: "B基金", type: "混合型" },
    ];
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(funds), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByText("A基金")).toBeInTheDocument();
    });

    const nameHeader = screen.getByText(/基金名称/i);
    fireEvent.click(nameHeader);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(
        (c) => typeof c[0] === "string" && (c[0] as string).includes("sort_by=name"),
      );
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  it("search input exists", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    renderWatchlists();
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/搜索基金代码或名称/i)).toBeInTheDocument();
    });
  });
});
