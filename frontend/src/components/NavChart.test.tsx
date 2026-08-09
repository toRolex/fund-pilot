import { describe, it, expect } from "vitest";
import { act, createRef } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NavChart } from "./NavChart";
import type { NavChartHandle } from "./NavChart";
import type { NavPoint, SignalResponse } from "@/types";

function makeNav(n = 260): NavPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    return { date: d.toISOString().slice(0, 10), netvalue: Number((1 + i * 0.005).toFixed(4)) };
  });
}

function makeSignals(nav: NavPoint[]): SignalResponse[] {
  const base = {
    fund_code: "000001",
    fund_name: "测试基金A",
    strategy_name: "indicator_cross",
    confidence: 0.75,
    daily_change: 0.56,
  };
  return [
    { ...base, date: nav[5].date, signal_type: "buy" as const },
    { ...base, date: nav[250].date, signal_type: "sell" as const },
  ];
}

function mockRect(el: Element, width: number, height: number) {
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

describe("NavChart", () => {
  it("renders empty state when no nav data", () => {
    render(<NavChart nav={[]} signals={[]} />);
    expect(screen.getByText("暂无净值数据")).toBeInTheDocument();
  });

  it("renders 5 quick range buttons with all active by default", () => {
    render(<NavChart nav={makeNav()} signals={[]} />);
    const group = screen.getByRole("group", { name: "快捷时间区间" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(5);
    expect(buttons.map((b) => b.textContent)).toEqual(["近1月", "近3月", "近半年", "近1年", "全部"]);
    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switching quick range changes chart data range and range stats", async () => {
    const nav = makeNav();
    render(<NavChart nav={nav} signals={makeSignals(nav)} />);

    // 默认全部：显示全量日期范围 + 全区间统计
    await waitFor(() => {
      const range = screen.getByTestId("chart-date-range").textContent ?? "";
      expect(range).toContain(nav[0].date);
      expect(range).toContain(nav[259].date);
    });
    expect(screen.getByTestId("range-return").textContent).toBe("+129.50%");
    expect(screen.getByTestId("range-signal-count").textContent).toBe("2");

    // 切换到近1月：主图数据范围与统计联动
    fireEvent.click(screen.getByRole("button", { name: "近1月" }));

    await waitFor(() => {
      const range = screen.getByTestId("chart-date-range").textContent ?? "";
      expect(range).toContain(nav[239].date);
      expect(range).toContain(nav[259].date);
    });
    expect(screen.getByTestId("range-return").textContent).toBe("+4.56%");
    expect(screen.getByTestId("range-mdd").textContent).toBe("0.00%");
    expect(screen.getByTestId("range-signal-count").textContent).toBe("1");
  });

  it("brush selection focuses main chart on selected window", () => {
    const nav = makeNav();
    render(<NavChart nav={nav} signals={makeSignals(nav)} />);

    const brush = screen.getByTestId("nav-brush");
    mockRect(brush, 700, 48);

    const before = screen.getByTestId("chart-date-range").textContent ?? "";
    expect(before).toContain(nav[259].date);

    // 按住右侧把手向左拖动 → 主图聚焦 [0, 142]
    fireEvent.pointerDown(brush, { pointerId: 1, clientX: 695, buttons: 1 });
    fireEvent.pointerMove(brush, { pointerId: 1, clientX: 400, buttons: 1 });
    fireEvent.pointerUp(brush, { pointerId: 1 });

    const after = screen.getByTestId("chart-date-range").textContent ?? "";
    expect(after).not.toContain(nav[259].date);
    expect(after).toContain(nav[142].date);
  });

  it("shows crosshair reading on hover over main chart", () => {
    const nav = makeNav();
    render(<NavChart nav={nav} signals={makeSignals(nav)} />);
    const chart = screen.getByTestId("nav-main-chart");
    mockRect(chart, 700, 280);

    fireEvent.pointerMove(chart, { clientX: 300, clientY: 100 });

    const crosshair = screen.getByTestId("nav-crosshair");
    expect(crosshair).toBeInTheDocument();
    expect(crosshair.textContent).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(crosshair.textContent).toMatch(/\d+\.\d{4}/);
  });

  it("keeps quick range controls usable on narrow screens", () => {
    render(<NavChart nav={makeNav()} signals={[]} />);
    const group = screen.getByRole("group", { name: "快捷时间区间" });
    // 快捷区间控件可换行（flex-wrap），不固定像素宽度
    expect(group.className).toContain("range-btns");
    const chart = screen.getByTestId("nav-main-chart");
    // 图表用 viewBox 响应式缩放，无固定像素 width
    expect(chart).toHaveAttribute("viewBox", "0 0 700 280");
    expect(chart.hasAttribute("width")).toBe(false);
  });
});

describe("NavChart keyboard imperative API (T6)", () => {
  it("setRange via ref updates the window and syncs segmented control", () => {
    const nav = makeNav();
    const ref = createRef<NavChartHandle>();
    render(<NavChart ref={ref} nav={nav} signals={makeSignals(nav)} />);

    act(() => ref.current?.setRange("1m"));

    expect(screen.getByRole("button", { name: "近1月" })).toHaveAttribute("aria-pressed", "true");
    const range = screen.getByTestId("chart-date-range").textContent ?? "";
    expect(range).toContain(nav[239].date);
  });

  it("pan via ref shifts the visible window left and right", () => {
    const nav = makeNav();
    const ref = createRef<NavChartHandle>();
    render(<NavChart ref={ref} nav={nav} signals={makeSignals(nav)} />);

    // 近1月 → 窗口 [239, 259]；向左平移 2 → [237, 257]
    act(() => ref.current?.setRange("1m"));
    act(() => ref.current?.pan(-1));

    const left = screen.getByTestId("chart-date-range").textContent ?? "";
    expect(left).toContain(nav[237].date);
    expect(left).not.toContain(nav[259].date);

    // 向右平移 2 → 回到 [239, 259]
    act(() => ref.current?.pan(1));

    const right = screen.getByTestId("chart-date-range").textContent ?? "";
    expect(right).toContain(nav[259].date);
  });
});
