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
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
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
    expect(screen.getByText("Strategies")).toBeInTheDocument();
  });

  it("renders 404 on unknown path", () => {
    renderWithRouter("/unknown");
    expect(screen.getByText("404")).toBeInTheDocument();
  });
});
