import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignalBadge, SignalBuyMarker, SignalSellMarker, SignalHoldMarker } from "./SignalBadge";

function renderInSvg(el: React.ReactElement) {
  return render(<svg>{el}</svg>);
}

describe("SignalBadge", () => {
  it("renders buy badge with green styling", () => {
    const { container } = render(<SignalBadge type="buy" />);
    const badge = screen.getByText("买入");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("emerald");
    expect(container.querySelector(".buy-shape")).toBeInTheDocument();
  });

  it("renders sell badge with orange styling", () => {
    const { container } = render(<SignalBadge type="sell" />);
    const badge = screen.getByText("卖出");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("orange");
    expect(container.querySelector(".sell-shape")).toBeInTheDocument();
  });

  it("renders hold badge with yellow styling", () => {
    const { container } = render(<SignalBadge type="hold" />);
    const badge = screen.getByText("持有");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("yellow");
    expect(container.querySelector(".hold-shape")).toBeInTheDocument();
  });

  it("renders distinct geometric shapes for each signal type", () => {
    const buy = render(<SignalBadge type="buy" />);
    expect(buy.container.querySelector(".buy-shape")).toBeInTheDocument();
    expect(buy.container.querySelector(".sell-shape")).toBeNull();
    expect(buy.container.querySelector(".hold-shape")).toBeNull();

    const sell = render(<SignalBadge type="sell" />);
    expect(sell.container.querySelector(".sell-shape")).toBeInTheDocument();
    expect(sell.container.querySelector(".buy-shape")).toBeNull();
    expect(sell.container.querySelector(".hold-shape")).toBeNull();

    const hold = render(<SignalBadge type="hold" />);
    expect(hold.container.querySelector(".hold-shape")).toBeInTheDocument();
    expect(hold.container.querySelector(".buy-shape")).toBeNull();
    expect(hold.container.querySelector(".sell-shape")).toBeNull();
  });

  it("includes tooltip content with strategy info", () => {
    render(<SignalBadge type="buy" confidence={0.85} strategy="indicator_cross" />);
    expect(screen.getByText("买入")).toBeInTheDocument();
    expect(screen.getByText(/indicator_cross/)).toBeInTheDocument();
    expect(screen.getByText(/85%/)).toBeInTheDocument();
  });
});

describe("Signal SVG markers", () => {
  it("SignalBuyMarker renders circles", () => {
    const { container } = renderInSvg(<SignalBuyMarker cx={10} cy={20} />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(2);
    expect(circles[0].getAttribute("cx")).toBe("10");
    expect(circles[1].getAttribute("cy")).toBe("20");
  });

  it("SignalSellMarker renders a polygon", () => {
    const { container } = renderInSvg(<SignalSellMarker cx={10} cy={20} />);
    const poly = container.querySelector("polygon");
    expect(poly).toBeInTheDocument();
    expect(poly!.getAttribute("points")).toContain("10");
  });

  it("SignalHoldMarker renders a rect", () => {
    const { container } = renderInSvg(<SignalHoldMarker cx={10} cy={20} />);
    const rect = container.querySelector("rect");
    expect(rect).toBeInTheDocument();
    expect(rect!.getAttribute("x")).toBe("7");
    expect(rect!.getAttribute("y")).toBe("17");
  });
});
