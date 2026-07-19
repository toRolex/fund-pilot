import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignalBadge } from "./SignalBadge";

describe("SignalBadge", () => {
  it("renders buy badge with green styling", () => {
    render(<SignalBadge type="buy" />);
    const badge = screen.getByText("买入");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("emerald");
  });

  it("renders sell badge with orange styling", () => {
    render(<SignalBadge type="sell" />);
    const badge = screen.getByText("卖出");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("orange");
  });

  it("renders hold badge with yellow styling", () => {
    render(<SignalBadge type="hold" />);
    const badge = screen.getByText("持有");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("yellow");
  });

  it("includes tooltip content with strategy info", () => {
    render(<SignalBadge type="buy" confidence={0.85} strategy="indicator_cross" />);
    expect(screen.getByText("买入")).toBeInTheDocument();
    // Tooltip should be in the DOM (rendered via CSS hover)
    expect(screen.getByText(/indicator_cross/)).toBeInTheDocument();
    expect(screen.getByText(/85%/)).toBeInTheDocument();
  });
});
