import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "./AppShell";

function renderAppShell(initialPath = "/") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route
              path="/"
              element={<div data-testid="page-content">Dashboard Page</div>}
            />
            <Route
              path="/watchlists"
              element={<div data-testid="page-content">Watchlists Page</div>}
            />
            <Route
              path="/strategies"
              element={<div data-testid="page-content">Strategies Page</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  it("renders 5 navigation items", () => {
    renderAppShell("/");
    expect(screen.getByText("仪表盘")).toBeInTheDocument();
    expect(screen.getByText("观察列表")).toBeInTheDocument();
    expect(screen.getByText("基金详情")).toBeInTheDocument();
    expect(screen.getByText("策略")).toBeInTheDocument();
    expect(screen.getByText("持仓")).toBeInTheDocument();
  });

  it("highlights nav item matching current route", () => {
    renderAppShell("/watchlists");
    const activeLinks = document.querySelectorAll('a[aria-current="page"]');
    expect(activeLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Outlet child content", () => {
    renderAppShell("/");
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.getByText("Dashboard Page")).toBeInTheDocument();
  });

  it("renders different page via route change", () => {
    renderAppShell("/strategies");
    expect(screen.getByTestId("page-content")).toBeInTheDocument();
    expect(screen.getByText("Strategies Page")).toBeInTheDocument();
  });

  it("renders topbar with search input placeholder", () => {
    renderAppShell("/");
    expect(screen.getByPlaceholderText("搜索基金")).toBeInTheDocument();
  });

  it("renders connection status indicator in topbar", () => {
    renderAppShell("/");
    expect(screen.getAllByText("运行中").length).toBeGreaterThanOrEqual(1);
  });

  it("renders statusbar footer section", () => {
    const { container } = renderAppShell("/");
    const footer = container.querySelector("footer");
    expect(footer).toBeInTheDocument();
  });
});
