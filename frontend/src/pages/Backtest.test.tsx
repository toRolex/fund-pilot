import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Backtest } from "./Backtest";

function renderBacktest(code = "000001") {
  return render(
    <MemoryRouter initialEntries={[`/funds/${code}/backtest`]}>
      <Routes>
        <Route path="/funds/:code/backtest" element={<Backtest />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Backtest", () => {
  it("renders the strategy dropdown with 3 options excluding momentum", () => {
    renderBacktest();
    const select = screen.getByRole("combobox", { name: /策略/i });
    expect(select).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveValue("indicator_cross");
    expect(options[1]).toHaveValue("pe_percentile");
    expect(options[2]).toHaveValue("grid");
    expect(screen.queryByText("momentum")).not.toBeInTheDocument();
  });

  it("shows empty state in the result area initially", () => {
    renderBacktest();
    expect(screen.getByText(/在左侧面板配置策略后运行回测/)).toBeInTheDocument();
  });

  it("displays the back link with fund code", () => {
    renderBacktest("000001");
    const link = screen.getByRole("link", { name: /返回基金详情/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/funds/000001");
  });

  it("shows the strategy description when a strategy is selected", () => {
    renderBacktest();
    expect(screen.getByText(/均线交叉策略/)).toBeInTheDocument();
  });

  it("updates param form when switching strategies", async () => {
    renderBacktest();
    const select = screen.getByRole("combobox", { name: /策略/i });
    await userEvent.selectOptions(select, "pe_percentile");
    expect(screen.getByText(/PE 百分位策略/)).toBeInTheDocument();
    expect(screen.getByText(/低估阈值/)).toBeInTheDocument();
  });

  it("has date range inputs", () => {
    renderBacktest();
    const dateInputs = screen.getAllByDisplayValue(/2024/);
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("disables the run button when no strategy selected", () => {
    renderBacktest();
    const button = screen.getByRole("button", { name: /运行回测/ });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("shows result metrics after running backtest", async () => {
    renderBacktest();
    const button = screen.getByRole("button", { name: /运行回测/ });
    await userEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText(/总收益/)).toBeInTheDocument();
    });
  });

  it("shows loading state when backtest is running", async () => {
    renderBacktest();
    const button = screen.getByRole("button", { name: /运行回测/ });
    await userEvent.click(button);
    expect(screen.getByText(/回测运行中/)).toBeInTheDocument();
  });

  it("shows trade table after running backtest", async () => {
    renderBacktest();
    const button = screen.getByRole("button", { name: /运行回测/ });
    await userEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText(/交易记录/)).toBeInTheDocument();
    });
  });
});
