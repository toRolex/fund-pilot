import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRoutes } from "./App";

function renderWithRouter(path: string) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("App", () => {
  it("renders dashboard on /", () => {
    renderWithRouter("/");
    expect(screen.getByText("信号仪表盘")).toBeInTheDocument();
  });

  it("renders holdings on /holdings", () => {
    renderWithRouter("/holdings");
    expect(screen.getAllByText("持仓").length).toBeGreaterThanOrEqual(1);
  });

  it("renders watchlists on /watchlists", () => {
    renderWithRouter("/watchlists");
    expect(screen.getByText("关注列表")).toBeInTheDocument();
  });

  it("renders signals on /signals", () => {
    renderWithRouter("/signals");
    expect(screen.getByText("Signals")).toBeInTheDocument();
  });

  it("renders strategies on /strategies", () => {
    renderWithRouter("/strategies");
    expect(screen.getByText("策略管理")).toBeInTheDocument();
  });

  it("renders 404 on unknown path", () => {
    renderWithRouter("/unknown");
    expect(screen.getByText("404")).toBeInTheDocument();
  });
});
