import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidenceBar } from "./ConfidenceBar";

describe("ConfidenceBar", () => {
  it("renders percentage text", () => {
    render(<ConfidenceBar value={0.75} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("renders high confidence with emerald (green) fill", () => {
    const { container } = render(<ConfidenceBar value={0.85} />);
    const fill = container.querySelector(".conf-fill");
    expect(fill).toBeInTheDocument();
    expect(fill!.className).toContain("high");
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("renders mid confidence with yellow fill", () => {
    const { container } = render(<ConfidenceBar value={0.55} />);
    const fill = container.querySelector(".conf-fill");
    expect(fill).toBeInTheDocument();
    expect(fill!.className).toContain("mid");
    expect(screen.getByText("55%")).toBeInTheDocument();
  });

  it("renders low confidence with orange fill", () => {
    const { container } = render(<ConfidenceBar value={0.3} />);
    const fill = container.querySelector(".conf-fill");
    expect(fill).toBeInTheDocument();
    expect(fill!.className).toContain("low");
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("renders full width bar for 100%", () => {
    const { container } = render(<ConfidenceBar value={1} />);
    const fill = container.querySelector(".conf-fill") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("renders zero width bar for 0%", () => {
    const { container } = render(<ConfidenceBar value={0} />);
    const fill = container.querySelector(".conf-fill") as HTMLElement;
    expect(fill.style.width).toBe("0%");
  });
});
