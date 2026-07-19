import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "./StatusBar";

function renderStatusBar() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <StatusBar />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("StatusBar", () => {
  it("shows connected state with update time", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          last_update: "2026-07-20T10:30:00+08:00",
          strategies_running: 2,
          funds_watched: 3,
          connected: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    renderStatusBar();

    await waitFor(() => {
      expect(screen.getByText("运行中")).toBeInTheDocument();
      expect(screen.getByText("策略: 2 个运行中")).toBeInTheDocument();
      expect(screen.getByText("基金: 3 只关注")).toBeInTheDocument();
    });
  });

  it("shows offline when fetch fails", async () => {
    vi.spyOn(window, "fetch").mockRejectedValue(new Error("Network error"));
    renderStatusBar();

    await waitFor(() => {
      expect(screen.getByText("离线")).toBeInTheDocument();
    });
  });

  it("shows '暂无' when last_update is null", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          last_update: null,
          strategies_running: 0,
          funds_watched: 0,
          connected: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    renderStatusBar();

    await waitFor(() => {
      expect(screen.getByText("暂无", { exact: false })).toBeInTheDocument();
    });
  });
});
