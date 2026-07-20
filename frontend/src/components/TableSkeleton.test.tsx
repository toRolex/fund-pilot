import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TableSkeleton } from "./TableSkeleton";

describe("TableSkeleton", () => {
  it("renders 5 skeleton rows by default", () => {
    const { container } = render(<TableSkeleton />);
    const rows = container.querySelectorAll(".skel-row");
    expect(rows.length).toBe(5);
  });

  it("renders specified number of rows", () => {
    const { container } = render(<TableSkeleton rows={3} />);
    const rows = container.querySelectorAll(".skel-row");
    expect(rows.length).toBe(3);
  });

  it("includes a title bar skeleton", () => {
    const { container } = render(<TableSkeleton />);
    expect(container.querySelector(".skel-title-bar")).toBeTruthy();
  });

  it("each row contains skel children", () => {
    const { container } = render(<TableSkeleton rows={1} />);
    const row = container.querySelector(".skel-row");
    expect(row).toBeTruthy();
    expect(row!.querySelectorAll(".skel").length).toBeGreaterThan(0);
  });
});
